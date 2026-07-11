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
  initializeTraceRow_(sheet, row, config);

  startTracePhase_(sheet, row, config, VERRACT_PHASE_VERIFY);
  setVerractState_(VERRACT_STATE_KEYS.CURRENT_STEP, VERRACT_PHASE_VERIFY);
  runVerifyRow_(sheet, row, lastColumn, config);
  if (isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) {
    endTracePhase_(sheet, row, config, VERRACT_PHASE_VERIFY);
  }

  if (!isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) return;

  if (config.enableResolve) {
    startTracePhase_(sheet, row, config, VERRACT_PHASE_RESOLVE);
    setVerractState_(VERRACT_STATE_KEYS.CURRENT_STEP, VERRACT_PHASE_RESOLVE);
    if (shouldResolveChainRow_(sheet, row, lastColumn, config)) {
      runResolveRow_(sheet, row, lastColumn, config);
    }
    if (isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) {
      endTracePhase_(sheet, row, config, VERRACT_PHASE_RESOLVE);
    }
  }

  if (!isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) return;

  if (config.enableAction) {
    startTracePhase_(sheet, row, config, VERRACT_PHASE_ACTION);
    setVerractState_(VERRACT_STATE_KEYS.CURRENT_STEP, VERRACT_PHASE_ACTION);
    runActionRow_(sheet, row, lastColumn, config);
    if (isVerractRunActive_(VERRACT_PHASE_CHAIN, config.runId)) {
      endTracePhase_(sheet, row, config, VERRACT_PHASE_ACTION);
    }
  }

  deleteVerractState_(VERRACT_STATE_KEYS.CURRENT_STEP);
}

function shouldResolveChainRow_(sheet, row, lastColumn, config) {
  var rowValues = getRowValues_(sheet, row, lastColumn);
  var verifyReport = readMappedObject_(rowValues, config.verifyMapping);
  return !isVerifyTrue_(verifyReport.Exists);
}

function ensureTraceBatchForRow_(config) {
  if (!config) return;
  if (config.traceBatchRunId) return;

  var prefix = getVerractState_(VERRACT_STATE_KEYS.TRACE_RUN_PREFIX) ||
    config.traceRunPrefix ||
    createTraceRunPrefix_();
  var sequence = Number(
    getVerractState_(VERRACT_STATE_KEYS.TRACE_BATCH_SEQUENCE) || 0
  ) + 1;

  setVerractState_(VERRACT_STATE_KEYS.TRACE_RUN_PREFIX, prefix);
  setVerractState_(VERRACT_STATE_KEYS.TRACE_BATCH_SEQUENCE, sequence);

  config.traceRunPrefix = prefix;
  config.traceBatchSequence = sequence;
  config.traceBatchRunId = formatTraceBatchRunId_(prefix, sequence);
  config.runPhases = config.runPhases || buildConfiguredRunPhases_(config).join('|');
}

function writeTraceObject_(sheet, row, mapping, object) {
  Object.keys(object || {}).forEach(function(field) {
    if (!mapping || !mapping[field]) return;

    var value = object[field] === undefined || object[field] === null
      ? ''
      : object[field];

    writeTraceCellWithRetry_(sheet, row, mapping[field], field, value);
  });
}

function writeTraceCellWithRetry_(sheet, row, column, field, value) {
  var attempts = 2;

  for (var attempt = 1; attempt <= attempts; attempt++) {
    try {
      sheet.getRange(row, column).setValue(value);
      return true;
    } catch (err) {
      if (attempt < attempts) {
        Utilities.sleep(100);
        continue;
      }

      Logger.log(
        'verract trace write skipped: row=' + row +
        ', field=' + field +
        ', error=' + err.message
      );
    }
  }

  return false;
}

function initializeTraceRow_(sheet, row, config) {
  ensureTraceBatchForRow_(config);

  var mapping = config.traceMapping || {};
  var trace = {
    BatchRunID: config.traceBatchRunId || '',
    RunPhases: config.runPhases || buildConfiguredRunPhases_(config).join('|')
  };

  if (!config.enableResolve) {
    trace.ResolveStart = '';
    trace.ResolveEnd = '';
  }

  if (!config.enableAction) {
    trace.ActionStart = '';
    trace.ActionEnd = '';
  }

  writeTraceObject_(sheet, row, mapping, trace);
}

function startTracePhase_(sheet, row, config, phase) {
  writeTraceFields_(sheet, row, config, getTracePhaseField_(phase, 'Start'));
}

function endTracePhase_(sheet, row, config, phase) {
  writeTraceFields_(sheet, row, config, getTracePhaseField_(phase, 'End'));
}

function writeTraceFields_(sheet, row, config, field) {
  if (!field) return;
  var mapping = config.traceMapping || {};
  if (!mapping[field]) return;

  var object = {};
  object[field] = nowTraceTimestamp_();
  writeTraceObject_(sheet, row, mapping, object);
}

function getTracePhaseField_(phase, boundary) {
  if (phase === VERRACT_PHASE_VERIFY) return 'Verify' + boundary;
  if (phase === VERRACT_PHASE_RESOLVE) return 'Resolve' + boundary;
  if (phase === VERRACT_PHASE_ACTION) return 'Action' + boundary;
  return '';
}
