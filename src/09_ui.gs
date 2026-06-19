// ======================================================
// verract
// Version : 0.3.4
// Author  : blackdjurix
//
// Feature : Shared File Output & UI Cleanup
//
// Highlights:
// - Opens verract sidebar control panel
// - Supports persistent Set Selection workflow
// - Starts Verify and Resolve from sidebar form config
// - Saves Verify, Resolve, and Shared output mappings
// - Keeps Shared PathID/FileID/Path/Filename/Source mapping global
// - Provides sidebar-safe status, diagnostics, and reset actions
// - Keeps Verify and Resolve engines server-side
// ======================================================

var VERRACT_SELECTION_PROPERTY =
  'VERRACT_SELECTION_SNAPSHOT';

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
  var endRow =
    startRow + range.getNumRows() - 1;

  var selection = {
    success: true,
    spreadsheetId: ss.getId(),
    sheetName: sheet.getName(),
    a1Notation: range.getA1Notation(),
    startRow: startRow,
    endRow: endRow,
    numRows: range.getNumRows()
  };

  saveVerractSelection_(selection);

  return selection;
}

function GET_VERRACT_SAVED_SELECTION() {
  var jsonText =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        VERRACT_SELECTION_PROPERTY
      );

  if (!jsonText) {
    return {
      success: false,
      message: 'No saved selection.'
    };
  }

  try {
    var selection = JSON.parse(jsonText);

    if (
      !selection ||
      !selection.spreadsheetId ||
      !selection.sheetName ||
      !selection.startRow ||
      !selection.endRow
    ) {
      throw new Error(
        'Invalid saved selection.'
      );
    }

    selection.success = true;
    return selection;
  } catch (err) {
    CLEAR_VERRACT_SAVED_SELECTION();

    return {
      success: false,
      message: 'Saved selection is invalid.'
    };
  }
}

function CLEAR_VERRACT_SAVED_SELECTION() {
  PropertiesService
    .getScriptProperties()
    .deleteProperty(
      VERRACT_SELECTION_PROPERTY
    );

  return {
    success: true,
    message: 'Selection cleared.'
  };
}

function saveVerractSelection_(selection) {
  PropertiesService
    .getScriptProperties()
    .setProperty(
      VERRACT_SELECTION_PROPERTY,
      JSON.stringify(selection)
    );
}

function GET_VERRACT_OUTPUT_MAPPING_SETTINGS() {
  return {
    success: true,
    verify:
      loadSidebarOutputMapping_(
        VERIFY_OUTPUT_MAPPING_PROPERTY,
        VERIFY_BASE_OUTPUT_FIELDS
      ),
    resolve:
      loadSidebarOutputMapping_(
        RESOLVE_OUTPUT_MAPPING_PROPERTY,
        RESOLVE_BASE_OUTPUT_FIELDS
      ),
    shared:
      loadSidebarOutputMapping_(
        SHARED_OUTPUT_MAPPING_PROPERTY,
        SHARED_OUTPUT_FIELDS
      )
  };
}

function START_VERIFY_FROM_SIDEBAR(config) {
  var preparedConfig =
    normalizeSidebarConfig_(config);

  var verifyMapping =
    normalizeOutputMapping_(
      preparedConfig.verifyOutputMapping || {},
      VERIFY_BASE_OUTPUT_FIELDS,
      null
    );

  var sharedMapping =
    normalizeOutputMappingAllowEmpty_(
      preparedConfig.sharedOutputMapping || {},
      SHARED_OUTPUT_FIELDS
    );

  preparedConfig.outputMapping =
    mergeOutputMappings_(
      verifyMapping,
      sharedMapping
    );

  validateOutputMapping_(
    preparedConfig.outputMapping,
    VERIFY_OUTPUT_FIELDS
  );

  saveSidebarOutputMappingAllowEmpty_(
    VERIFY_OUTPUT_MAPPING_PROPERTY,
    verifyMapping,
    VERIFY_BASE_OUTPUT_FIELDS
  );

  saveSidebarOutputMappingAllowEmpty_(
    SHARED_OUTPUT_MAPPING_PROPERTY,
    sharedMapping,
    SHARED_OUTPUT_FIELDS
  );

  var result =
    startVerifyAutomation_(
      preparedConfig
    );

  return {
    success: true,
    mode: result.mode || 'VERIFY',
    startRow: result.startRow,
    endRow: result.endRow,
    batchSize: result.batchSize,
    triggerGapMinutes:
      result.triggerGapMinutes,
    message:
      result.message ||
      'Verify automation started.'
  };
}

function START_RESOLVE_FROM_SIDEBAR(config) {
  var preparedConfig =
    normalizeSidebarConfig_(config);

  var resolveMapping =
    normalizeOutputMapping_(
      preparedConfig.resolveOutputMapping || {},
      RESOLVE_BASE_OUTPUT_FIELDS,
      null
    );

  var sharedMapping =
    normalizeOutputMappingAllowEmpty_(
      preparedConfig.sharedOutputMapping || {},
      SHARED_OUTPUT_FIELDS
    );

  preparedConfig.outputMapping =
    mergeOutputMappings_(
      resolveMapping,
      sharedMapping
    );

  validateOutputMapping_(
    preparedConfig.outputMapping,
    RESOLVE_OUTPUT_FIELDS
  );

  var savedVerifyMapping =
    loadSidebarOutputMappingAsNumbers_(
      VERIFY_OUTPUT_MAPPING_PROPERTY,
      VERIFY_BASE_OUTPUT_FIELDS
    );

  if (!savedVerifyMapping.Exists) {
    throw new Error(
      'Resolve requires Verify Exists output mapping. Run or save Verify mapping with Exists selected first.'
    );
  }

  preparedConfig.verifyOutputMapping =
    savedVerifyMapping;

  saveSidebarOutputMappingAllowEmpty_(
    RESOLVE_OUTPUT_MAPPING_PROPERTY,
    resolveMapping,
    RESOLVE_BASE_OUTPUT_FIELDS
  );

  saveSidebarOutputMappingAllowEmpty_(
    SHARED_OUTPUT_MAPPING_PROPERTY,
    sharedMapping,
    SHARED_OUTPUT_FIELDS
  );

  var result =
    startResolveAutomation_(
      preparedConfig
    );

  return {
    success: true,
    mode: result.mode || 'RESOLVE',
    startRow: result.startRow,
    endRow: result.endRow,
    batchSize: result.batchSize,
    triggerGapMinutes:
      result.triggerGapMinutes,
    message:
      result.message ||
      'Resolve automation started.'
  };
}

function GET_VERRACT_ENGINE_STATUS() {
  var props =
    PropertiesService
      .getScriptProperties();

  var isRunning =
    props.getProperty(
      ENGINE_STATE_KEY
    ) === 'TRUE';

  var mode = '';

  if (
    props.getProperty(
      'AUTO_CURRENT_ROW'
    )
  ) {
    mode = 'VERIFY';
  }

  if (
    props.getProperty(
      'RESOLVE_CURRENT_ROW'
    )
  ) {
    mode = 'RESOLVE';
  }

  return {
    running: isRunning,
    status:
      isRunning
        ? 'Running ' + (mode || 'Engine')
        : 'Idle',
    mode: mode,
    spreadsheetId:
      props.getProperty(
        'AUTO_SPREADSHEET_ID'
      ) ||
      props.getProperty(
        'RESOLVE_SPREADSHEET_ID'
      ) ||
      '',
    sheetName:
      props.getProperty(
        'AUTO_SHEET_NAME'
      ) ||
      props.getProperty(
        'RESOLVE_SHEET_NAME'
      ) ||
      '',
    currentRow:
      props.getProperty(
        'AUTO_CURRENT_ROW'
      ) ||
      props.getProperty(
        'RESOLVE_CURRENT_ROW'
      ) ||
      '',
    endRow:
      props.getProperty(
        'AUTO_END_ROW'
      ) ||
      props.getProperty(
        'RESOLVE_END_ROW'
      ) ||
      '',
    batchSize:
      props.getProperty(
        'DYNAMIC_BATCH_SIZE'
      ) ||
      props.getProperty(
        'RESOLVE_BATCH_SIZE'
      ) ||
      '',
    lastSuccessTimestamp:
      props.getProperty(
        'AUTO_LAST_SUCCESS_TS'
      ) ||
      props.getProperty(
        'RESOLVE_LAST_SUCCESS_TS'
      ) ||
      '',
    lastError:
      props.getProperty(
        'AUTO_LAST_ERROR'
      ) ||
      props.getProperty(
        'RESOLVE_LAST_ERROR'
      ) ||
      ''
  };
}

function STOP_VERRACT_FROM_SIDEBAR() {
  CLEAR_TRIGGER_AND_STATE();

  return {
    success: true,
    message:
      'verract stopped and state cleared.'
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
    throw new Error(
      'Missing sidebar config.'
    );
  }

  var startRow =
    parseInt(config.startRow, 10);

  var endRow =
    parseInt(config.endRow, 10);

  if (
    !startRow ||
    !endRow ||
    endRow < startRow
  ) {
    throw new Error(
      'Invalid selected range. Set Selection from the Home page first.'
    );
  }

  if (!config.spreadsheetId) {
    throw new Error(
      'Missing spreadsheet ID from selected range.'
    );
  }

  if (!config.sheetName) {
    throw new Error(
      'Missing sheet name from selected range.'
    );
  }

  config.startRow = startRow;
  config.endRow = endRow;
  config.batchSize =
    parseInt(config.batchSize, 10);
  config.triggerGapMinutes =
    parseInt(
      config.triggerGapMinutes,
      10
    );

  config.pathColumns =
    normalizeSidebarColumnText_(
      config.pathColumns
    );
  config.fileColumn =
    normalizeSidebarColumnText_(
      config.fileColumn
    );
  config.extensionColumn =
    normalizeSidebarColumnText_(
      config.extensionColumn
    );
  config.rootIdColumn =
    normalizeSidebarColumnText_(
      config.rootIdColumn
    );

  return config;
}

function normalizeSidebarColumnText_(value) {
  return value
    ? value.toString().trim().toUpperCase()
    : '';
}

function mergeOutputMappings_(a, b) {
  var result = {};
  var key;

  for (key in a || {}) {
    if (a.hasOwnProperty(key)) {
      result[key] = a[key];
    }
  }

  for (key in b || {}) {
    if (b.hasOwnProperty(key)) {
      result[key] = b[key];
    }
  }

  return result;
}

function normalizeOutputMappingAllowEmpty_(
  mapping,
  allowedFields
) {
  var normalized = {};

  if (!mapping) {
    return normalized;
  }

  for (
    var i = 0;
    i < allowedFields.length;
    i++
  ) {
    var field = allowedFields[i];
    var columnValue = mapping[field];

    if (
      columnValue === null ||
      columnValue === undefined ||
      columnValue === ''
    ) {
      continue;
    }

    normalized[field] =
      normalizeOutputColumnValue_(
        columnValue
      );
  }

  if (Object.keys(normalized).length > 0) {
    var validation =
      validateOutputMapping_(
        normalized,
        allowedFields
      );

    if (!validation.isValid) {
      throw new Error(
        validation.error
      );
    }
  }

  return normalized;
}

function saveSidebarOutputMappingAllowEmpty_(
  propertyName,
  mapping,
  allowedFields
) {
  var normalized =
    normalizeOutputMappingAllowEmpty_(
      mapping,
      allowedFields
    );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      propertyName,
      JSON.stringify(normalized)
    );
}

function loadSidebarOutputMapping_(
  propertyName,
  allowedFields
) {
  var numericMapping =
    loadSidebarOutputMappingAsNumbers_(
      propertyName,
      allowedFields
    );

  return convertOutputMappingToLetters_(
    numericMapping,
    allowedFields
  );
}

function loadSidebarOutputMappingAsNumbers_(
  propertyName,
  allowedFields
) {
  var jsonText =
    PropertiesService
      .getScriptProperties()
      .getProperty(propertyName);

  if (!jsonText) {
    return {};
  }

  try {
    return normalizeOutputMappingAllowEmpty_(
      JSON.parse(jsonText),
      allowedFields
    );
  } catch (err) {
    return {};
  }
}

function convertOutputMappingToLetters_(
  numericMapping,
  allowedFields
) {
  var result = {};

  for (
    var i = 0;
    i < allowedFields.length;
    i++
  ) {
    var field = allowedFields[i];
    var column = numericMapping[field];

    if (column) {
      result[field] =
        convertColumnToLetter_(
          column
        );
    }
  }

  return result;
}
