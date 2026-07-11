function GET_VERRACT_UI_SETTINGS() {
  return {
    version: VERRACT_VERSION,
    contract: 'VERIFY_RESOLVE_ACTION',
    verifyReportFields: VERIFY_REPORT_FIELDS,
    resolveReportFields: RESOLVE_REPORT_FIELDS,
    sharedOutputFields: SHARED_OUTPUT_FIELDS,
    actionOutputFields: ACTION_OUTPUT_FIELDS,
    traceOutputFields: TRACE_OUTPUT_FIELDS,
    defaultBatchSize: VERRACT_DEFAULT_BATCH_SIZE,
    maxBatchSize: VERRACT_MAX_BATCH_SIZE,
    defaultContinuationGapMinutes: VERRACT_DEFAULT_CONTINUATION_GAP_MINUTES,
    minContinuationGapMinutes: VERRACT_MIN_CONTINUATION_GAP_MINUTES,
    maxContinuationGapMinutes: VERRACT_MAX_CONTINUATION_GAP_MINUTES
  };
}

function SAVE_VERRACT_UI_SETTINGS(payload) {
  PropertiesService.getUserProperties().setProperty(
    'VERRACT_UI_SETTINGS',
    JSON.stringify(payload || {})
  );
  return { ok: true };
}

function GET_VERRACT_SAVED_UI_SETTINGS() {
  var raw = PropertiesService.getUserProperties().getProperty(
    'VERRACT_UI_SETTINGS'
  );
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function OPEN_VERRACT_SIDEBAR() {
  var html = HtmlService
    .createHtmlOutputFromFile('sidebar')
    .setTitle('verract');
  SpreadsheetApp.getUi().showSidebar(html);
}

function GET_VERRACT_ACTIVE_SELECTION() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getActiveSheet();
  var selection = ss.getSelection();
  var rangeList = selection ? selection.getActiveRangeList() : null;
  var ranges = rangeList ? rangeList.getRanges() : [];

  if (!ranges.length) {
    var activeRange = sheet.getActiveRange();
    ranges = activeRange ? [activeRange] : [];
  }

  var rowRanges = ranges.map(function(range) {
    return {
      startRow: range.getRow(),
      endRow: range.getLastRow()
    };
  });

  var normalizedRanges = normalizeSelectionRowRanges_(rowRanges);
  var rowSpec = normalizedRanges.map(function(range) {
    return range.startRow === range.endRow
      ? String(range.startRow)
      : range.startRow + ':' + range.endRow;
  }).join(',');

  return {
    sheetName: sheet.getName(),
    a1Notation: ranges.map(function(range) {
      return range.getA1Notation();
    }).join(','),
    startRow: normalizedRanges.length ? normalizedRanges[0].startRow : 2,
    endRow: normalizedRanges.length
      ? normalizedRanges[normalizedRanges.length - 1].endRow
      : 2,
    rowRanges: rowSpec
  };
}

function normalizeSelectionRowRanges_(ranges) {
  var sorted = (ranges || []).slice().sort(function(a, b) {
    return a.startRow - b.startRow || a.endRow - b.endRow;
  });
  var merged = [];

  sorted.forEach(function(range) {
    var last = merged.length ? merged[merged.length - 1] : null;
    if (!last || range.startRow > last.endRow + 1) {
      merged.push({ startRow: range.startRow, endRow: range.endRow });
      return;
    }
    if (range.endRow > last.endRow) last.endRow = range.endRow;
  });

  return merged;
}

function GET_VERRACT_SAVED_SELECTION() {
  var raw = PropertiesService.getUserProperties().getProperty('VERRACT_SAVED_SELECTION');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function CLEAR_VERRACT_SAVED_SELECTION() {
  PropertiesService.getUserProperties().deleteProperty('VERRACT_SAVED_SELECTION');
  return { ok: true };
}

function GET_VERRACT_OUTPUT_MAPPING_SETTINGS() {
  var raw = PropertiesService.getUserProperties().getProperty('VERRACT_OUTPUT_MAPPING');
  if (!raw) return getDefaultUiMapping_();

  try {
    var parsed = JSON.parse(raw);
    return parsed || getDefaultUiMapping_();
  } catch (err) {
    return getDefaultUiMapping_();
  }
}

function getDefaultUiMapping_() {
  return {
    verifyMapping: {
      Exists: '',
      CheckedPathCount: '',
      MatchedPathColumn: '',
      Error: ''
    },
    resolveMapping: {
      ResolveStatus: '',
      ResolveID: '',
      ResolveCandidateCount: '',
      ResolveNote: ''
    },
    sharedMapping: {
      SharedPathID: '',
      SharedFileID: '',
      SharedPath: '',
      SharedFilename: '',
      SharedSource: ''
    },
    actionMapping: {
      ActionStatus: '',
      ActionID: '',
      ActionAt: '',
      ActionNote: ''
    },
    traceMapping: {
      BatchRunID: '',
      RunPhases: '',
      VerifyStart: '',
      VerifyEnd: '',
      ResolveStart: '',
      ResolveEnd: '',
      ActionStart: '',
      ActionEnd: ''
    }
  };
}

function saveOutputMappingFromConfig_(config) {
  var source = config || {};
  PropertiesService.getUserProperties().setProperty(
    'VERRACT_OUTPUT_MAPPING',
    JSON.stringify({
      verifyMapping: source.verifyMapping || {},
      resolveMapping: source.resolveMapping || {},
      sharedMapping: source.sharedMapping || {},
      actionMapping: source.actionMapping || {},
      traceMapping: source.traceMapping || {}
    })
  );

  PropertiesService.getUserProperties().setProperty(
    'VERRACT_UI_SETTINGS',
    JSON.stringify(source)
  );
}

function START_VERIFY_FROM_UI(config) {
  return START_VERIFY_FROM_SIDEBAR(config);
}

function START_RESOLVE_FROM_UI(config) {
  return START_RESOLVE_FROM_SIDEBAR(config);
}

function START_VERIFY_FROM_SIDEBAR(config) {
  saveOutputMappingFromConfig_(config || {});
  return startVerifyFromUiImpl_(config || {});
}

function START_RESOLVE_FROM_SIDEBAR(config) {
  saveOutputMappingFromConfig_(config || {});
  return startResolveFromUiImpl_(config || {});
}

function START_ACTION_FROM_UI(config) {
  saveOutputMappingFromConfig_(config || {});
  return START_ACTION_FROM_SIDEBAR(config || {});
}

function startVerifyFromUiImpl_(config) {
  var normalized = normalizeBaseRunConfig_(config, VERRACT_PHASE_VERIFY);
  normalized.runId = createRunId_('verify');
  initializeVerractRunState_(normalized);
  runVerifyRows_(normalized);
  return {
    ok: true,
    phase: VERRACT_PHASE_VERIFY,
    runId: normalized.runId,
    startRow: normalized.startRow,
    endRow: normalized.endRow
  };
}

function startResolveFromUiImpl_(config) {
  var normalized = normalizeBaseRunConfig_(config, VERRACT_PHASE_RESOLVE);
  normalized.runId = createRunId_('resolve');
  runResolveRows_(normalized);
  return {
    ok: true,
    phase: VERRACT_PHASE_RESOLVE,
    runId: normalized.runId,
    startRow: normalized.startRow,
    endRow: normalized.endRow
  };
}

function GET_VERRACT_ENGINE_STATUS() {
  return {
    activePhase: getVerractState_(VERRACT_STATE_KEYS.ACTIVE_PHASE) || '',
    currentStep: getVerractState_(VERRACT_STATE_KEYS.CURRENT_STEP) || '',
    currentRow: getVerractState_(VERRACT_STATE_KEYS.CURRENT_ROW) || '',
    endRow: getVerractState_(VERRACT_STATE_KEYS.END_ROW) || '',
    lastStatus: getVerractState_(VERRACT_STATE_KEYS.LAST_STATUS) || ''
  };
}

function STOP_VERRACT_FROM_SIDEBAR() {
  CLEAR_TRIGGER_AND_STATE();
  return { ok: true };
}

function RUN_DIAGNOSTICS_FROM_SIDEBAR() {
  CHECK_SYSTEM_DIAGNOSTICS();
  return { ok: true };
}

function START_MULTI_PHASE_FROM_SIDEBAR(config) {
  return START_CHAIN_FROM_SIDEBAR(config || {});
}
