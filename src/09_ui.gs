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

var VERRACT_UI_SETTINGS_PROPERTY =
  'VERRACT_UI_SETTINGS_V2';

var VERRACT_UI_SETTINGS_LEGACY_PROPERTY =
  'VERRACT_UI_SETTINGS_V1';

function GET_VERRACT_UI_SETTINGS() {
  var userProps = PropertiesService.getUserProperties();
  var scriptProps = PropertiesService.getScriptProperties();
  var raw = userProps.getProperty(VERRACT_UI_SETTINGS_PROPERTY);
  var migrated = false;

  if (!raw) {
    raw = scriptProps.getProperty(VERRACT_UI_SETTINGS_LEGACY_PROPERTY);
    migrated = !!raw;
  }

  if (!raw) {
    return { success: true, settings: null };
  }

  try {
    var settings = JSON.parse(raw);

    if (migrated) {
      userProps.setProperty(
        VERRACT_UI_SETTINGS_PROPERTY,
        JSON.stringify(settings)
      );
    }

    return {
      success: true,
      settings: settings,
      migrated: migrated
    };
  } catch (err) {
    return {
      success: false,
      settings: null,
      message: 'Saved UI settings are invalid JSON.'
    };
  }
}

function SAVE_VERRACT_UI_SETTINGS(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('UI settings payload is required.');
  }

  payload.savedAt = new Date().toISOString();
  payload.schemaVersion = 2;

  var serialized = JSON.stringify(payload);

  if (serialized.length > 90000) {
    throw new Error('UI settings payload is too large.');
  }

  PropertiesService
    .getUserProperties()
    .setProperty(VERRACT_UI_SETTINGS_PROPERTY, serialized);

  return {
    success: true,
    savedAt: payload.savedAt,
    message: 'UI settings saved for the current account.'
  };
}

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
      ),
    action:
      loadSidebarOutputMapping_(
        'ACTION_OUTPUT_MAPPING',
        ACTION_OUTPUT_FIELDS
      )
  };
}

function START_VERIFY_FROM_SIDEBAR(config) {
  var preparedConfig =
    normalizeSidebarConfig_(config);

  var verifyMapping =
    normalizeOutputMapping_(
      normalizeVerifyOutputMappingAliases_(
        preparedConfig.verifyOutputMapping || {}
      ),
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

  requireOutputMappingFields_(
    verifyMapping,
    VERIFY_REQUIRED_OUTPUT_FIELDS,
    'Verify Output'
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
    normalizeOutputMappingAllowEmpty_(
      preparedConfig.resolveOutputMapping || {},
      RESOLVE_BASE_OUTPUT_FIELDS
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

  if (typeof recoverStaleExecutionState_ === 'function') {
    recoverStaleExecutionState_(props);
  }

  var engineRunning =
    props.getProperty(
      ENGINE_STATE_KEY
    ) === 'TRUE';

  var pipelineEnabled =
    props.getProperty('PIPELINE_ENABLED') === 'TRUE';

  var executionActive =
    props.getProperty('EXECUTION_ACTIVE') === 'TRUE';

  // A Multi-Phase run remains logically active during the short trigger gap
  // between VERIFY, RESOLVE, and ACTION_PREVIEW, even when the phase engine
  // temporarily releases the global running flag.
  var isRunning = engineRunning || pipelineEnabled || executionActive;

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

  if (props.getProperty('ACTION_CURRENT_ROW')) {
    mode = 'ACTION_PREVIEW';
  }

  var pipelinePhase = props.getProperty('PIPELINE_PHASE') || '';
  if (pipelineEnabled && pipelinePhase) {
    mode = 'PIPELINE:' + pipelinePhase;
  }

  if (executionActive) {
    mode = 'EXECUTION';
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
      props.getProperty('ACTION_SPREADSHEET_ID') ||
      props.getProperty('EXECUTION_SPREADSHEET_ID') ||
      '',
    sheetName:
      props.getProperty(
        'AUTO_SHEET_NAME'
      ) ||
      props.getProperty(
        'RESOLVE_SHEET_NAME'
      ) ||
      props.getProperty('ACTION_SHEET_NAME') ||
      props.getProperty('EXECUTION_SHEET_NAME') ||
      '',
    currentRow:
      props.getProperty(
        'AUTO_CURRENT_ROW'
      ) ||
      props.getProperty(
        'RESOLVE_CURRENT_ROW'
      ) ||
      props.getProperty('ACTION_CURRENT_ROW') ||
      props.getProperty('EXECUTION_CURRENT_ROW') ||
      '',
    endRow:
      props.getProperty(
        'AUTO_END_ROW'
      ) ||
      props.getProperty(
        'RESOLVE_END_ROW'
      ) ||
      props.getProperty('ACTION_END_ROW') ||
      props.getProperty('EXECUTION_END_ROW') ||
      '',
    batchSize:
      props.getProperty(
        'DYNAMIC_BATCH_SIZE'
      ) ||
      props.getProperty(
        'RESOLVE_BATCH_SIZE'
      ) ||
      props.getProperty('ACTION_BATCH_SIZE') ||
      props.getProperty('EXECUTION_BATCH_SIZE') ||
      '',
    lastSuccessTimestamp:
      (executionActive
        ? props.getProperty(
            'EXECUTION_LAST_SUCCESS_TS'
          )
        : '') ||
      props.getProperty(
        'AUTO_LAST_SUCCESS_TS'
      ) ||
      props.getProperty(
        'RESOLVE_LAST_SUCCESS_TS'
      ) ||
      props.getProperty('ACTION_LAST_SUCCESS_TS') ||
      props.getProperty('EXECUTION_LAST_SUCCESS_TS') ||
      '',
    lastError:
      props.getProperty(
        'AUTO_LAST_ERROR'
      ) ||
      props.getProperty(
        'RESOLVE_LAST_ERROR'
      ) ||
      props.getProperty('EXECUTION_LAST_ERROR') ||
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

function normalizeVerifyOutputMappingAliases_(
  mapping
) {
  var normalized = {};

  for (var field in mapping || {}) {
    if (mapping.hasOwnProperty(field)) {
      normalized[field] = mapping[field];
    }
  }

  if (
    !normalized.Type &&
    normalized.FileType
  ) {
    normalized.Type =
      normalized.FileType;
  }

  delete normalized.FileType;
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
    var parsedMapping =
      JSON.parse(jsonText);

    if (
      allowedFields.indexOf('Type') >= 0
    ) {
      parsedMapping =
        normalizeVerifyOutputMappingAliases_(
          parsedMapping
        );
    }

    return normalizeOutputMappingAllowEmpty_(
      parsedMapping,
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


function START_ACTION_FROM_SIDEBAR(config) {
  var normalized = normalizeSidebarConfig_(config || {});
  var result = startActionPreviewAutomation_(normalized);
  return result;
}

function START_MULTI_PHASE_FROM_SIDEBAR(config) {
  if (!config) {
    throw new Error(
      'Multi-Phase config is required.'
    );
  }

  var verifyConfig =
    normalizeSidebarConfig_(
      config.verify || {}
    );

  var resolveConfig =
    normalizeSidebarConfig_(
      config.resolve || {}
    );

  var actionConfig =
    normalizeSidebarConfig_(
      config.action || {}
    );

  var phases = config.phases || {};
  var runVerify = phases.verify !== false;
  var runResolve = phases.resolve === true;
  var runAction = phases.action === true;

  if (runResolve || runAction) {
    runVerify = true;
  }

  var verifyMapping =
    normalizeOutputMapping_(
      normalizeVerifyOutputMappingAliases_(
        verifyConfig.verifyOutputMapping || {}
      ),
      VERIFY_BASE_OUTPUT_FIELDS,
      null
    );

  var resolveMapping =
    normalizeOutputMappingAllowEmpty_(
      resolveConfig.resolveOutputMapping || {},
      RESOLVE_BASE_OUTPUT_FIELDS
    );

  var sharedMapping =
    normalizeOutputMappingAllowEmpty_(
      config.workflowSharedMapping ||
      verifyConfig.sharedOutputMapping ||
      resolveConfig.sharedOutputMapping ||
      {},
      SHARED_OUTPUT_FIELDS
    );

  var pipelineMapping =
    normalizeOutputMappingAllowEmpty_(
      config.workflowPipelineMapping ||
      {},
      PIPELINE_OUTPUT_FIELDS
    );

  var actionMapping =
    normalizeOutputMappingAllowEmpty_(
      actionConfig.actionOutputMapping || {},
      ACTION_OUTPUT_FIELDS
    );

  verifyConfig.outputMapping =
    mergeOutputMappings_(
      verifyMapping,
      sharedMapping
    );

  resolveConfig.outputMapping =
    mergeOutputMappings_(
      resolveMapping,
      sharedMapping
    );

  resolveConfig.verifyOutputMapping =
    verifyMapping;

  actionConfig.actionOutputMapping =
    actionMapping;

  actionConfig.workflowOutputMapping =
    pipelineMapping;

  actionConfig.sourcePathIdColumn =
    sharedMapping.SharedPathID;

  actionConfig.sourceFileIdColumn =
    sharedMapping.SharedFileID;

  if (runVerify) {
    validateOutputMapping_(
      verifyConfig.outputMapping,
      VERIFY_OUTPUT_FIELDS
    );
  }

  if (runResolve) {
    validateOutputMapping_(
      resolveConfig.outputMapping,
      RESOLVE_OUTPUT_FIELDS
    );
  }

  if (runAction) {
    validateOutputMapping_(
      actionMapping,
      ACTION_OUTPUT_FIELDS
    );
  }

  if (
    runVerify &&
    !verifyMapping.Exists
  ) {
    throw new Error(
      'Verify Exists mapping is required for the selected phases.'
    );
  }

  if (runResolve || runAction) {
    requireOutputMappingFields_(
      sharedMapping,
      actionConfig.sourceObjectMode === 'FOLDER'
        ? FOLDER_OBJECT_RESULT_REQUIRED_FIELDS
        : FILE_OBJECT_RESULT_REQUIRED_FIELDS,
      'Object Result'
    );
  }

  if (runAction) {
    requireOutputMappingFields_(
      actionMapping,
      ACTION_REQUIRED_OUTPUT_FIELDS,
      'Action Output'
    );
  }

  if (runAction) {
    requireOutputMappingFields_(
      pipelineMapping,
      PIPELINE_REQUIRED_OUTPUT_FIELDS,
      'Workflow Result'
    );
  }

  saveSidebarOutputMappingAllowEmpty_(
    VERIFY_OUTPUT_MAPPING_PROPERTY,
    verifyMapping,
    VERIFY_BASE_OUTPUT_FIELDS
  );

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

  saveSidebarOutputMappingAllowEmpty_(
    'PIPELINE_OUTPUT_MAPPING',
    pipelineMapping,
    PIPELINE_OUTPUT_FIELDS
  );

  saveSidebarOutputMappingAllowEmpty_(
    'ACTION_OUTPUT_MAPPING',
    actionMapping,
    ACTION_OUTPUT_FIELDS
  );

  actionConfig.pipelineMode = true;
  actionConfig.sourceObjectMode = String(
    actionConfig.sourceObjectMode || 'FILE'
  ).trim().toUpperCase();

  actionConfig.verifyExistsColumn =
    verifyMapping.Exists;

  actionConfig.verifyFileIdColumn =
    verifyMapping.FileID || 0;

  actionConfig.verifyPathIdColumn =
    verifyMapping.PathID || 0;

  actionConfig.resolvedIdColumn =
    resolveMapping.ResolvedID || 0;

  actionConfig.resolveStatusColumn =
    resolveMapping.ResolveStatus || 0;

  actionConfig.resolveMatchCountColumn =
    resolveMapping.MatchCount || 0;

  actionConfig.sourceLabelColumn =
    sharedMapping.SharedSource || 0;

  actionConfig.sourcePathColumn =
    sharedMapping.SharedPath || 0;

  actionConfig.sourceObjectNameColumn =
    sharedMapping.SharedFilename || 0;

  return startMultiPhasePipeline_({
    verify: verifyConfig,
    resolve: resolveConfig,
    action: actionConfig,
    phases: {
      verify: runVerify,
      resolve: runResolve,
      action: runAction
    }
  });
}


function GET_EXECUTION_STATUS_FROM_SIDEBAR() {
  var p=PropertiesService.getScriptProperties();
  return {running:p.getProperty('EXECUTION_ACTIVE')==='TRUE',runId:p.getProperty('EXECUTION_RUN_ID')||'',currentRow:p.getProperty('EXECUTION_CURRENT_ROW')||'',endRow:p.getProperty('EXECUTION_END_ROW')||''};
}
