function CREATE_RESOLVE_TRIGGER_MULTI() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Run Resolve',
    'Use the sidebar for the contract-reset Resolve runner.',
    ui.ButtonSet.OK
  );
  return response;
}

function TRIGGER_RESOLVE_BATCH_MULTI() {
  var config = getVerractConfigState_();
  if (!config || config.phase !== VERRACT_PHASE_RESOLVE) return;
  runResolveRows_(config);
}

function runResolveRows_(config) {
  var sheet = getRunSheet_(config);
  var lastColumn = sheet.getLastColumn();
  var startTime = Date.now();
  var rowRanges = getConfigRowRanges_(config);
  var processed = 0;

  for (var rangeIndex = 0; rangeIndex < rowRanges.length; rangeIndex++) {
    var activeRange = rowRanges[rangeIndex];

    for (var row = activeRange.startRow; row <= activeRange.endRow; row++) {
      if (processed >= config.batchSize) return;
      if (Date.now() - startTime > VERRACT_TIME_BUDGET_MS) return;
      if (isRowHiddenForRun_(sheet, row)) continue;

      runResolveRow_(sheet, row, lastColumn, config);
      processed++;
    }
  }
}

function runResolveRow_(sheet, row, lastColumn, config) {
  var rowValues = getRowValues_(sheet, row, lastColumn);
  var verifyReport = readMappedObject_(rowValues, config.verifyMapping);

  if (isVerifyTrue_(verifyReport.Exists)) {
    writeMappedObject_(sheet, row, config.resolveMapping, {
      ResolveStatus: RESOLVE_STATUSES.SKIPPED_VERIFY_TRUE,
      ResolveID: '',
      ResolveCandidateCount: 0,
      ResolveNote: 'Verify Exists is TRUE.'
    });
    return;
  }

  var input = buildInputFromRow_(rowValues, config);
  var result = resolveExactPair_(input);
  var status = mapResolveStatusFromResult_(result);

  var resolveReport = {
    ResolveStatus: status,
    ResolveID: result.fileId || '',
    ResolveCandidateCount: result.candidateCount || 0,
    ResolveNote: result.note || ''
  };

  var sharedOutput = buildSharedObject_(
    result.pathId,
    result.fileId,
    result.path,
    result.filename,
    VERRACT_PHASE_RESOLVE
  );

  writeMappedObject_(sheet, row, config.resolveMapping, resolveReport);
  writeMappedObject_(sheet, row, config.sharedMapping, sharedOutput);
}

function mapResolveStatusFromResult_(result) {
  if (!result) return RESOLVE_STATUSES.INVALID_INPUT;
  if (result.status === 'RESOLVED') return RESOLVE_STATUSES.RESOLVED;
  if (result.status === 'PATH_FOUND_FILE_MISSING') return RESOLVE_STATUSES.PATH_FOUND_FILE_MISSING;
  if (result.status === 'PATH_NOT_FOUND') return RESOLVE_STATUSES.PATH_NOT_FOUND;
  if (result.status === 'FILE_NOT_FOUND') return RESOLVE_STATUSES.FILE_NOT_FOUND;
  if (result.status === 'AMBIGUOUS') return RESOLVE_STATUSES.AMBIGUOUS;
  if (result.status === 'INVALID_INPUT') return RESOLVE_STATUSES.INVALID_INPUT;
  return result.status || RESOLVE_STATUSES.INVALID_INPUT;
}

function TEST_SEARCH_RESOLVE_FILES_BY_DRIVE_INDEX() {
  throw new Error('Legacy test removed in contract reset.');
}

function TEST_RESOLVE_SEARCH_RESULT_BUILD() {
  throw new Error('Legacy test removed in contract reset.');
}
