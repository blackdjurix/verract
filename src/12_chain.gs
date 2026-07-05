function START_CHAIN_FROM_SIDEBAR(config) {
  saveOutputMappingFromConfig_(config || {});

  var normalized = normalizeChainRunConfig_(config || {});
  normalized.runId = createRunId_('chain');

  initializeVerractRunState_(normalized);
  runChainRows_(normalized);

  return {
    ok: true,
    phase: VERRACT_PHASE_CHAIN,
    runId: normalized.runId,
    startRow: normalized.startRow,
    endRow: normalized.endRow,
    enableResolve: normalized.enableResolve,
    enableAction: normalized.enableAction
  };
}

function TRIGGER_CHAIN_BATCH_MULTI() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  var config;
  try {
    config = getVerractConfigState_();
    if (!config || config.phase !== VERRACT_PHASE_CHAIN) return;
    if (!isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) return;

    var status = getVerractState_(VERRACT_STATE_KEYS.LAST_STATUS);
    var nextRunAt = Number(getVerractState_(VERRACT_STATE_KEYS.NEXT_RUN_AT) || 0);

    if (status !== 'WAITING_CONTINUATION') return;
    if (nextRunAt && Date.now() < nextRunAt) return;

    setVerractState_(VERRACT_STATE_KEYS.LAST_STATUS, 'RUNNING');
    deleteVerractState_(VERRACT_STATE_KEYS.NEXT_RUN_AT);
  } finally {
    lock.releaseLock();
  }

  runChainRows_(config);
}

function runChainRows_(config) {
  if (!isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) return;

  var sheet = getRunSheet_(config);
  var lastColumn = sheet.getLastColumn();
  var startTime = Date.now();
  var rowRanges = getConfigRowRanges_(config);
  var rangeIndex = Number(
    getVerractState_(VERRACT_STATE_KEYS.RANGE_INDEX) || 0
  );
  var currentRow = Number(
    getVerractState_(VERRACT_STATE_KEYS.CURRENT_ROW) ||
    rowRanges[rangeIndex].startRow
  );
  var processed = 0;

  while (rangeIndex < rowRanges.length) {
    if (processed >= config.batchSize) break;
    if (Date.now() - startTime > VERRACT_TIME_BUDGET_MS) break;
    if (!isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) return;

    var activeRange = rowRanges[rangeIndex];
    if (currentRow < activeRange.startRow) currentRow = activeRange.startRow;

    if (currentRow > activeRange.endRow) {
      rangeIndex++;
      setVerractState_(VERRACT_STATE_KEYS.RANGE_INDEX, rangeIndex);
      if (rangeIndex < rowRanges.length) {
        currentRow = rowRanges[rangeIndex].startRow;
        setVerractState_(VERRACT_STATE_KEYS.CURRENT_ROW, currentRow);
      }
      continue;
    }

    if (isRowHiddenForRun_(sheet, currentRow)) {
      currentRow++;
      setVerractState_(VERRACT_STATE_KEYS.CURRENT_ROW, currentRow);
      continue;
    }

    runChainRow_(sheet, currentRow, lastColumn, config);
    processed++;

    if (!isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) return;

    currentRow++;
    setVerractState_(VERRACT_STATE_KEYS.CURRENT_ROW, currentRow);
  }

  if (!isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) return;

  if (rangeIndex >= rowRanges.length) {
    completeVerractRun_(VERRACT_PHASE_CHAIN, config.runId);
    return;
  }

  var finalRange = rowRanges[rangeIndex];
  if (
    rangeIndex === rowRanges.length - 1 &&
    currentRow > finalRange.endRow
  ) {
    completeVerractRun_(VERRACT_PHASE_CHAIN, config.runId);
    return;
  }

  var delayMs = config.continuationGapMinutes * 60 * 1000;
  setVerractState_(VERRACT_STATE_KEYS.LAST_STATUS, 'WAITING_CONTINUATION');
  setVerractState_(VERRACT_STATE_KEYS.NEXT_RUN_AT, Date.now() + delayMs);
  scheduleVerractContinuation_('TRIGGER_CHAIN_BATCH_MULTI', delayMs);
}

function runChainRow_(sheet, row, lastColumn, config) {
  setVerractState_(VERRACT_STATE_KEYS.CURRENT_STEP, VERRACT_PHASE_VERIFY);
  runVerifyRow_(sheet, row, lastColumn, config);

  if (!isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) return;

  if (config.enableResolve && shouldResolveChainRow_(sheet, row, lastColumn, config)) {
    setVerractState_(VERRACT_STATE_KEYS.CURRENT_STEP, VERRACT_PHASE_RESOLVE);
    runResolveRow_(sheet, row, lastColumn, config);
  }

  if (!isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) return;

  if (config.enableAction) {
    setVerractState_(VERRACT_STATE_KEYS.CURRENT_STEP, VERRACT_PHASE_ACTION);
    runActionRow_(sheet, row, lastColumn, config);
  }

  deleteVerractState_(VERRACT_STATE_KEYS.CURRENT_STEP);
}

function shouldResolveChainRow_(sheet, row, lastColumn, config) {
  var rowValues = getRowValues_(sheet, row, lastColumn);
  var verifyReport = readMappedObject_(rowValues, config.verifyMapping);
  return !isVerifyTrue_(verifyReport.Exists);
}
