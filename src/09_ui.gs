function OPEN_VERRACT_SIDEBAR() {
  var html = HtmlService
    .createHtmlOutputFromFile('sidebar')
    .setTitle('verract');
  SpreadsheetApp
    .getUi()
    .showSidebar(html);
}

function GET_VERRACT_ACTIVE_SELECTION() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var range = sheet.getActiveRange();
  if (!range) {
    return {
      success: false,
      message: 'No active range selected.'
    };
  }
  var startRow = range.getRow();
  var endRow = startRow + range.getNumRows() - 1;
  return {
    success: true,
    spreadsheetId: ss.getId(),
    sheetName: sheet.getName(),
    a1Notation: range.getA1Notation(),
    startRow: startRow,
    endRow: endRow,
    numRows: range.getNumRows()
  };
}

function START_VERIFY_FROM_SIDEBAR(config) {
  var preparedConfig = normalizeSidebarConfig_(config);
  var result = startVerifyAutomation_(preparedConfig);
  return {
    success: true,
    mode: result.mode || 'VERIFY',
    startRow: result.startRow,
    endRow: result.endRow,
    batchSize: result.batchSize,
    triggerGapMinutes: result.triggerGapMinutes,
    message: result.message || 'Verify started.'
  };
}

function START_RESOLVE_FROM_SIDEBAR(config) {
  var preparedConfig = normalizeSidebarConfig_(config);
  var result = startResolveAutomation_(preparedConfig);
  return {
    success: true,
    mode: result.mode || 'RESOLVE',
    startRow: result.startRow,
    endRow: result.endRow,
    batchSize: result.batchSize,
    triggerGapMinutes: result.triggerGapMinutes,
    message: result.message || 'Resolve started.'
  };
}

function GET_VERRACT_ENGINE_STATUS() {
  var props = PropertiesService.getScriptProperties();
  var isRunning = props.getProperty('IS_ENGINE_RUNNING') === 'TRUE';
  var mode = '';
  if (props.getProperty('AUTO_CURRENT_ROW')) {
    mode = 'VERIFY';
  }
  if (props.getProperty('RESOLVE_CURRENT_ROW')) {
    mode = 'RESOLVE';
  }
  return {
    running: isRunning,
    status: isRunning ? 'Running' : 'Idle',
    mode: mode,
    spreadsheetId:
      props.getProperty('AUTO_SPREADSHEET_ID') ||
      props.getProperty('RESOLVE_SPREADSHEET_ID') ||
      '',
    sheetName:
      props.getProperty('AUTO_SHEET_NAME') ||
      props.getProperty('RESOLVE_SHEET_NAME') ||
      '',
    currentRow:
      props.getProperty('AUTO_CURRENT_ROW') ||
      props.getProperty('RESOLVE_CURRENT_ROW') ||
      '',
    endRow:
      props.getProperty('AUTO_END_ROW') ||
      props.getProperty('RESOLVE_END_ROW') ||
      '',
    batchSize:
      props.getProperty('DYNAMIC_BATCH_SIZE') ||
      props.getProperty('RESOLVE_BATCH_SIZE') ||
      '',
    lastSuccessTimestamp:
      props.getProperty('AUTO_LAST_SUCCESS_TS') ||
      props.getProperty('RESOLVE_LAST_SUCCESS_TS') ||
      '',
    lastError:
      props.getProperty('AUTO_LAST_ERROR') ||
      props.getProperty('RESOLVE_LAST_ERROR') ||
      '',
    backoffUntil:
      props.getProperty('AUTO_BACKOFF_UNTIL') ||
      props.getProperty('RESOLVE_BACKOFF_UNTIL') ||
      ''
  };
}

function STOP_VERRACT_FROM_SIDEBAR() {
  CLEAR_TRIGGER_AND_STATE();
  return {
    success: true,
    message: 'verract stopped and state cleared.'
  };
}

function RUN_DIAGNOSTICS_FROM_SIDEBAR() {
  CHECK_SYSTEM_DIAGNOSTICS();
  return {
    success: true,
    message: 'Diagnostics completed.'
  };
}

function normalizeSidebarConfig_(config) {
  if (!config) {
    throw new Error('Missing sidebar config.');
  }
  var startRow = parseInt(config.startRow, 10);
  var endRow = parseInt(config.endRow, 10);
  if (!startRow || !endRow || endRow < startRow) {
    throw new Error('Invalid selected range. Select rows in the sheet, then open the form again.');
  }
  if (!config.spreadsheetId) {
    throw new Error('Missing spreadsheet ID from selected range.');
  }
  if (!config.sheetName) {
    throw new Error('Missing sheet name from selected range.');
  }
  config.startRow = startRow;
  config.endRow = endRow;
  config.batchSize = parseInt(config.batchSize, 10);
  config.triggerGapMinutes = parseInt(config.triggerGapMinutes, 10);
  return config;
}
