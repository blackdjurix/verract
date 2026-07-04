function CREATE_TIME_TRIGGER_MULTI() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Run Verify',
    'Use the sidebar for the contract-reset Verify runner.',
    ui.ButtonSet.OK
  );
  return response;
}

function TRIGGER_BATCH_AUDIT_MULTI() {
  var config = getVerractConfigState_();
  if (!config || config.phase !== VERRACT_PHASE_VERIFY) return;
  if (!isVerractRunActive_(VERRACT_PHASE_VERIFY, config.runId)) return;

  setVerractState_(VERRACT_STATE_KEYS.LAST_STATUS, 'RUNNING');
  runVerifyRows_(config);
}

function runVerifyRows_(config) {
  if (!isVerractRunActive_(VERRACT_PHASE_VERIFY, config.runId)) return;

  var sheet = getRunSheet_(config);
  var lastColumn = sheet.getLastColumn();
  var startTime = Date.now();
  var rowRanges = config.rowRanges || [
    { startRow: Number(config.startRow), endRow: Number(config.endRow) }
  ];
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
    if (!isVerractRunActive_(VERRACT_PHASE_VERIFY, config.runId)) return;

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

    runVerifyRow_(sheet, currentRow, lastColumn, config);
    processed++;

    if (!isVerractRunActive_(VERRACT_PHASE_VERIFY, config.runId)) return;

    currentRow++;
    setVerractState_(VERRACT_STATE_KEYS.CURRENT_ROW, currentRow);
  }

  if (!isVerractRunActive_(VERRACT_PHASE_VERIFY, config.runId)) return;

  if (rangeIndex >= rowRanges.length) {
    completeVerractRun_(VERRACT_PHASE_VERIFY, config.runId);
    return;
  }

  var finalRange = rowRanges[rangeIndex];
  if (
    rangeIndex === rowRanges.length - 1 &&
    currentRow > finalRange.endRow
  ) {
    completeVerractRun_(VERRACT_PHASE_VERIFY, config.runId);
    return;
  }

  setVerractState_(VERRACT_STATE_KEYS.LAST_STATUS, 'WAITING_CONTINUATION');
  scheduleVerractContinuation_(
    'TRIGGER_BATCH_AUDIT_MULTI',
    config.continuationGapMinutes * 60 * 1000
  );
}

function runVerifyRow_(sheet, row, lastColumn, config) {
  var rowValues = getRowValues_(sheet, row, lastColumn);
  var existing = readMappedObject_(rowValues, config.verifyMapping);

  if (config.skipExistingTrue && isVerifyTrue_(existing.Exists)) {
    return;
  }

  var input = buildInputFromRow_(rowValues, config);
  var result = verifyExactPair_(input);

  var verifyReport = {
    Exists: result.exists ? true : false,
    CheckedPathCount: result.checkedPathCount,
    MatchedPathColumn: result.matchedPathColumn,
    Error: result.exists ? '' : mapVerifyErrorFromResult_(result)
  };

  var sharedOutput = buildSharedObject_(
    result.pathId,
    result.fileId,
    result.path,
    result.filename,
    VERRACT_PHASE_VERIFY
  );

  writeMappedObject_(sheet, row, config.verifyMapping, verifyReport);
  writeMappedObject_(sheet, row, config.sharedMapping, sharedOutput);
}

function mapVerifyErrorFromResult_(result) {
  if (!result) return VERIFY_ERRORS.DRIVE_ERROR;
  if (result.status === 'RESOLVED') return '';
  if (result.status === 'INVALID_INPUT') return VERIFY_ERRORS.INVALID_INPUT;
  if (result.status === 'AMBIGUOUS') return VERIFY_ERRORS.AMBIGUOUS;
  if (result.status === 'PATH_FOUND_FILE_MISSING') return VERIFY_ERRORS.FILE_NOT_FOUND;
  if (result.status === 'FILE_NOT_FOUND') return VERIFY_ERRORS.FILE_NOT_FOUND;
  if (result.status === 'PATH_NOT_FOUND') return VERIFY_ERRORS.PATH_NOT_FOUND;
  return result.status || VERIFY_ERRORS.DRIVE_ERROR;
}

function CREATE_MULTI_PHASE_PIPELINE() {
  SpreadsheetApp.getUi().alert(
    'Multi-Phase is disabled in the contract reset. Run Verify, then Resolve.'
  );
}

function TRIGGER_MULTI_PHASE_TRANSITION() {
  return;
}
