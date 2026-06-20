function CREATE_TIME_TRIGGER_MULTI() {
  var config = collectVerifyConfigFromPrompts_();
  if (!config) {
    return;
  }

  var result = startVerifyAutomation_(config);

  SpreadsheetApp
    .getActiveSpreadsheet()
    .toast(
      result.message,
      'VERRACT',
      5
    );
}

function collectVerifyConfigFromPrompts_() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var range = sheet.getActiveRange();

  if (!range) {
    ui.alert(
      'No Selection',
      'Pilih range data dulu.',
      ui.ButtonSet.OK
    );
    return null;
  }

  var startRow = range.getRow();
  var numRows = range.getNumRows();
  var endRow = startRow + numRows - 1;

  var pathColumnResponse = ui.prompt(
    'Path Column(s)',
    'Masukkan path column(s).\n\n' +
      'Contoh:\n' +
      'D\n' +
      'D-F\n' +
      'D,E,F\n\n' +
      'Kolom path boleh berisi folder path atau full path\\file.ext.',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    pathColumnResponse.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var pathColumnParse =
    parseColumnSelection_(
      pathColumnResponse.getResponseText()
    );

  if (!pathColumnParse.isValid) {
    ui.alert(
      'Invalid Path Column(s)',
      pathColumnParse.error,
      ui.ButtonSet.OK
    );
    return null;
  }

  var pathColumns = pathColumnParse.columns;

  if (
    !confirmLargePathColumnSelection_(
      pathColumns.length
    )
  ) {
    return null;
  }

  var fileColumnResponse = ui.prompt(
    'File Column',
    'Masukkan file column.\n\n' +
      'Contoh: G\n\n' +
      'Isi boleh file.ext atau nama file tanpa extension jika extension column dipakai.\n\n' +
      'Kosongkan jika path column sudah berisi full path\\file.ext.',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    fileColumnResponse.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var fileColumnText =
    fileColumnResponse
      .getResponseText()
      .toString()
      .trim();

  var fileColumn = 0;

  if (fileColumnText) {
    var fileColumnValidation =
      validateFileColumn_(
        fileColumnText
      );

    if (!fileColumnValidation.isValid) {
      ui.alert(
        'Invalid File Column',
        fileColumnValidation.error,
        ui.ButtonSet.OK
      );
      return null;
    }

    fileColumn =
      fileColumnValidation.column;
  }

  var extensionColumnResponse = ui.prompt(
    'Extension Column',
    'Masukkan extension column jika extension dipisah.\n\n' +
      'Contoh: H\n\n' +
      'Kosongkan jika filename sudah berisi extension, misalnya file.ai.',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    extensionColumnResponse.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var extensionColumnText =
    extensionColumnResponse
      .getResponseText()
      .toString()
      .trim();

  var extensionColumn = 0;

  if (extensionColumnText) {
    var extensionColumnValidation =
      validateOptionalExtensionColumn_(
        extensionColumnText
      );

    if (
      !extensionColumnValidation.isValid
    ) {
      ui.alert(
        'Invalid Extension Column',
        extensionColumnValidation.error,
        ui.ButtonSet.OK
      );
      return null;
    }

    extensionColumn =
      extensionColumnValidation.column;
  }

  var rootIdColumnResponse = ui.prompt(
    'RootID Column',
    'Masukkan RootID column.\n\n' +
      'Contoh: C',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    rootIdColumnResponse.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var rootIdColumnValidation =
    validateFileColumn_(
      rootIdColumnResponse.getResponseText()
    );

  if (!rootIdColumnValidation.isValid) {
    ui.alert(
      'Invalid RootID Column',
      rootIdColumnValidation.error,
      ui.ButtonSet.OK
    );
    return null;
  }

  var rootIdColumn =
    rootIdColumnValidation.column;

  var inputValidation =
    validateInputColumns_(
      pathColumns,
      fileColumn,
      rootIdColumn,
      extensionColumn
    );

  if (!inputValidation.isValid) {
    ui.alert(
      'Invalid Input Columns',
      inputValidation.error,
      ui.ButtonSet.OK
    );
    return null;
  }

  var targetColumnResponse = ui.prompt(
    'Output Column',
    'Masukkan kolom awal output.\n\n' +
      'Contoh: H\n\n' +
      'Output akan memakai ' +
      OUTPUT_WIDTH +
      ' kolom.',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    targetColumnResponse.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var targetColumnValidation =
    validateFileColumn_(
      targetColumnResponse.getResponseText()
    );

  if (!targetColumnValidation.isValid) {
    ui.alert(
      'Invalid Output Column',
      targetColumnValidation.error,
      ui.ButtonSet.OK
    );
    return null;
  }

  var targetColumn =
    targetColumnValidation.column;

  if (
    !confirmOutputDoesNotOverlapInputs_(
      pathColumns,
      fileColumn,
      rootIdColumn,
      extensionColumn,
      targetColumn,
      OUTPUT_WIDTH
    )
  ) {
    return null;
  }

  if (
    !confirmOutputWithinSheetBoundary_(
      sheet,
      targetColumn,
      OUTPUT_WIDTH
    )
  ) {
    return null;
  }

  if (
    !confirmNonBlankMainOutput_(
      sheet,
      startRow,
      targetColumn,
      numRows
    )
  ) {
    return null;
  }

  var batchSizeResponse = ui.prompt(
    'Batch Size',
    'Masukkan batch size.\n\n' +
      'Default: ' +
      DEFAULT_BATCH_SIZE +
      '\n' +
      'Min: ' +
      MIN_BATCH_SIZE +
      '\n' +
      'Max: ' +
      MAX_BATCH_SIZE,
    ui.ButtonSet.OK_CANCEL
  );

  if (
    batchSizeResponse.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var batchSizeText =
    batchSizeResponse
      .getResponseText()
      .toString()
      .trim();

  var batchSize =
    batchSizeText
      ? parseInt(batchSizeText, 10)
      : DEFAULT_BATCH_SIZE;

  if (
    isNaN(batchSize) ||
    batchSize < MIN_BATCH_SIZE ||
    batchSize > MAX_BATCH_SIZE
  ) {
    ui.alert(
      'Invalid Batch Size',
      'Batch size tidak valid.\n\n' +
        'Kosongkan untuk memakai default: ' +
        DEFAULT_BATCH_SIZE +
        '.',
      ui.ButtonSet.OK
    );
    return null;
  }

  var workloadValidation =
    validateVerifyWorkload_(
      batchSize,
      pathColumns.length
    );

  if (!workloadValidation.isValid) {
    ui.alert(
      'Workload Too Large',
      workloadValidation.error,
      ui.ButtonSet.OK
    );
    return null;
  }

  var intervalResponse = ui.prompt(
    'Trigger Interval',
    'Masukkan interval trigger dalam menit.\n\n' +
      'Default: ' +
      DEFAULT_TRIGGER_GAP_MINUTES +
      '\n' +
      'Min: ' +
      MIN_TRIGGER_GAP_MINUTES +
      '\n' +
      'Max: ' +
      MAX_TRIGGER_GAP_MINUTES,
    ui.ButtonSet.OK_CANCEL
  );

  if (
    intervalResponse.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var triggerGapText =
    intervalResponse
      .getResponseText()
      .toString()
      .trim();

  var triggerGap =
    triggerGapText
      ? parseInt(triggerGapText, 10)
      : DEFAULT_TRIGGER_GAP_MINUTES;

  if (
    isNaN(triggerGap) ||
    triggerGap < MIN_TRIGGER_GAP_MINUTES ||
    triggerGap > MAX_TRIGGER_GAP_MINUTES
  ) {
    ui.alert(
      'Invalid Trigger Interval',
      'Interval trigger tidak valid.\n\n' +
        'Kosongkan untuk memakai default: ' +
        DEFAULT_TRIGGER_GAP_MINUTES +
        ' menit.',
      ui.ButtonSet.OK
    );
    return null;
  }

  return {
    startRow: startRow,
    endRow: endRow,
    pathColumns: pathColumns,
    fileColumn: fileColumn,
    extensionColumn: extensionColumn,
    rootIdColumn: rootIdColumn,
    verifyOutputColumn: targetColumn,
    batchSize: batchSize,
    triggerGapMinutes: triggerGap,
    spreadsheetId: ss.getId(),
    sheetName: sheet.getName()
  };
}

function startVerifyAutomation_(config) {
  var normalizedConfig =
    normalizeVerifyAutomationConfig_(config);

  var props =
    PropertiesService.getScriptProperties();

  checkEngineHeartbeat_();

  if (
    props.getProperty(ENGINE_STATE_KEY) ===
    'TRUE'
  ) {
    throw new Error(
      'Engine masih aktif. Jalankan Stop & Reset dulu.'
    );
  }

  deleteExistingTriggers_();

  props.deleteProperty('AUTO_LAST_ERROR');
  props.deleteProperty('AUTO_BACKOFF_UNTIL');

  var timestampNow =
    Date.now().toString();

  props.setProperties({
    AUTO_CURRENT_ROW:
      normalizedConfig.startRow.toString(),
    AUTO_END_ROW:
      normalizedConfig.endRow.toString(),
    AUTO_PATH_COLUMNS:
      JSON.stringify(
        normalizedConfig.pathColumns
      ),
    AUTO_FILE_COLUMN:
      normalizedConfig.fileColumn.toString(),
    AUTO_EXTENSION_COLUMN:
      normalizedConfig.extensionColumn.toString(),
    AUTO_ROOT_ID_COLUMN:
      normalizedConfig.rootIdColumn.toString(),
    AUTO_TARGET_COL:
      (normalizedConfig.verifyOutputColumn || 0).toString(),
    AUTO_OUTPUT_MAPPING:
      serializeOutputMapping_(
        normalizedConfig.outputMapping
      ),
    AUTO_SPREADSHEET_ID:
      normalizedConfig.spreadsheetId,
    AUTO_SHEET_NAME:
      normalizedConfig.sheetName,
    DYNAMIC_BATCH_SIZE:
      normalizedConfig.batchSize.toString(),
    AUTO_ENGINE_STARTED_AT:
      timestampNow,
    AUTO_LAST_SUCCESS_TS:
      timestampNow
  });

  props.setProperty(
    ENGINE_STATE_KEY,
    'TRUE'
  );

  ScriptApp
    .newTrigger(
      'TRIGGER_BATCH_AUDIT_MULTI'
    )
    .timeBased()
    .everyMinutes(
      normalizedConfig.triggerGapMinutes
    )
    .create();

  TRIGGER_BATCH_AUDIT_MULTI();

  return {
    success: true,
    mode: 'VERIFY',
    startRow: normalizedConfig.startRow,
    endRow: normalizedConfig.endRow,
    batchSize: normalizedConfig.batchSize,
    triggerGapMinutes:
      normalizedConfig.triggerGapMinutes,
    message: 'Verify automation started.'
  };
}

function normalizeVerifyAutomationConfig_(config) {
  if (!config) {
    throw new Error(
      'Verify config is required.'
    );
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  var spreadsheetId =
    config.spreadsheetId || ss.getId();

  var sheetName =
    config.sheetName || sheet.getName();

  var startRow =
    parseInt(config.startRow, 10);

  var endRow =
    parseInt(config.endRow, 10);

  if (
    isNaN(startRow) ||
    isNaN(endRow) ||
    startRow < 1 ||
    endRow < startRow
  ) {
    throw new Error(
      'Verify row range tidak valid.'
    );
  }

  var pathColumns =
    normalizeVerifyPathColumns_(
      config.pathColumns
    );

  if (!pathColumns.length) {
    throw new Error(
      'Path column tidak valid.'
    );
  }

  var fileColumn =
    normalizeOptionalColumn_(
      config.fileColumn
    );

  var extensionColumn =
    normalizeOptionalColumn_(
      config.extensionColumn
    );

  var rootIdColumn =
    normalizeRequiredColumn_(
      config.rootIdColumn
    );

  var hasExplicitOutputMapping =
    config.outputMapping &&
    Object.keys(config.outputMapping).length > 0;

  var verifyOutputColumn = 0;

  if (!hasExplicitOutputMapping) {
    verifyOutputColumn =
      normalizeRequiredColumn_(
        config.verifyOutputColumn ||
          config.targetColumn
      );
  }

  var inputValidation =
    validateInputColumns_(
      pathColumns,
      fileColumn,
      rootIdColumn,
      extensionColumn
    );

  if (!inputValidation.isValid) {
    throw new Error(
      inputValidation.error
    );
  }

  var batchSize =
    config.batchSize === '' ||
    config.batchSize === null ||
    config.batchSize === undefined
      ? DEFAULT_BATCH_SIZE
      : parseInt(config.batchSize, 10);

  if (
    isNaN(batchSize) ||
    batchSize < MIN_BATCH_SIZE ||
    batchSize > MAX_BATCH_SIZE
  ) {
    throw new Error(
      'Batch size tidak valid.'
    );
  }

  var workloadValidation =
    validateVerifyWorkload_(
      batchSize,
      pathColumns.length
    );

  if (!workloadValidation.isValid) {
    throw new Error(
      workloadValidation.error
    );
  }

  var triggerGapMinutes =
    config.triggerGapMinutes === '' ||
    config.triggerGapMinutes === null ||
    config.triggerGapMinutes === undefined
      ? DEFAULT_TRIGGER_GAP_MINUTES
      : parseInt(config.triggerGapMinutes, 10);

  if (
    isNaN(triggerGapMinutes) ||
    triggerGapMinutes < MIN_TRIGGER_GAP_MINUTES ||
    triggerGapMinutes > MAX_TRIGGER_GAP_MINUTES
  ) {
    throw new Error(
      'Trigger interval tidak valid.'
    );
  }

  var outputMapping =
    normalizeOutputMapping_(
      config.outputMapping,
      VERIFY_OUTPUT_FIELDS,
      verifyOutputColumn || null
    );

  return {
    startRow: startRow,
    endRow: endRow,
    pathColumns: pathColumns,
    fileColumn: fileColumn,
    extensionColumn: extensionColumn,
    rootIdColumn: rootIdColumn,
    verifyOutputColumn: verifyOutputColumn,
    outputMapping: outputMapping,
    batchSize: batchSize,
    triggerGapMinutes: triggerGapMinutes,
    spreadsheetId: spreadsheetId,
    sheetName: sheetName
  };
}

function normalizeVerifyPathColumns_(value) {
  if (Array.isArray(value)) {
    return value
      .map(function(column) {
        return parseInt(column, 10);
      })
      .filter(function(column) {
        return !isNaN(column) && column > 0;
      });
  }

  var parsed =
    parseColumnSelection_(value);

  if (!parsed.isValid) {
    throw new Error(parsed.error);
  }

  return parsed.columns;
}

function normalizeRequiredColumn_(value) {
  if (
    typeof value === 'number' &&
    value > 0
  ) {
    return value;
  }

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    throw new Error(
      'Required column tidak boleh kosong.'
    );
  }

  var validation =
    validateFileColumn_(value);

  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  return validation.column;
}

function normalizeOptionalColumn_(value) {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === 0 ||
    value === -1
  ) {
    return 0;
  }

  if (
    typeof value === 'number' &&
    value > 0
  ) {
    return value;
  }

  var validation =
    validateFileColumn_(value);

  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  return validation.column;
}


function TRIGGER_BATCH_AUDIT_MULTI() {
  var props =
    PropertiesService.getScriptProperties();
  if (
    props.getProperty(ENGINE_STATE_KEY) !==
    'TRUE'
  ) {
    return;
  }
  var backoffUntil = parseInt(
    props.getProperty('AUTO_BACKOFF_UNTIL') ||
      '0',
    10
  );
  if (
    backoffUntil &&
    Date.now() < backoffUntil
  ) {
    return;
  }
  try {
    checkEngineHeartbeat_();
    var spreadsheetId =
      props.getProperty(
        'AUTO_SPREADSHEET_ID'
      );
    var sheetName =
      props.getProperty(
        'AUTO_SHEET_NAME'
      );
    var sheet =
      SpreadsheetApp
        .openById(spreadsheetId)
        .getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(
        'Sheet not found: ' + sheetName
      );
    }
    var currentRow = parseInt(
      props.getProperty(
        'AUTO_CURRENT_ROW'
      ),
      10
    );
    var endRow = parseInt(
      props.getProperty(
        'AUTO_END_ROW'
      ),
      10
    );
    var pathColumns = JSON.parse(
      props.getProperty(
        'AUTO_PATH_COLUMNS'
      ) || '[]'
    );
    var fileColumn = parseInt(
      props.getProperty(
        'AUTO_FILE_COLUMN'
      ),
      10
    );
    var extensionColumn = parseInt(
      props.getProperty(
        'AUTO_EXTENSION_COLUMN'
      ) || '0',
      10
    );
    var rootIdColumn = parseInt(
      props.getProperty(
        'AUTO_ROOT_ID_COLUMN'
      ),
      10
    );
    var targetColumn = parseInt(
      props.getProperty(
        'AUTO_TARGET_COL'
      ),
      10
    );
    var outputMapping =
      parseStoredOutputMapping_(
        props.getProperty(
          'AUTO_OUTPUT_MAPPING'
        ),
        VERIFY_OUTPUT_FIELDS,
        targetColumn || null
      );
    var batchSize = parseInt(
      props.getProperty(
        'DYNAMIC_BATCH_SIZE'
      ),
      10
    );
    if (
      !currentRow ||
      !endRow ||
      !pathColumns.length ||
      !rootIdColumn ||
      !batchSize
    ) {
      throw new Error(
        'Engine metadata incomplete.'
      );
    } if (currentRow > endRow) {
      if (!advanceMultiPhasePipeline_('VERIFY')) { CLEAR_TRIGGER_AND_STATE(); }
      SpreadsheetApp
        .openById(spreadsheetId)
        .toast(
          'File verification completed.',
          'VERRACT',
          5
        );
      return;
    }
    var lastRow = Math.min(
      currentRow + batchSize - 1,
      endRow
    );
    var numRows =
      lastRow - currentRow + 1;
    var pathValuesByColumn = {};
    for (
      var i = 0;
      i < pathColumns.length;
      i++
    ) {
      var pathColumn =
        pathColumns[i];
      pathValuesByColumn[pathColumn] =
        sheet
          .getRange(
            currentRow,
            pathColumn,
            numRows,
            1
          )
          .getValues();
    }
    var fileValues = null;
    if (fileColumn) {
      fileValues = sheet
        .getRange(
          currentRow,
          fileColumn,
          numRows,
          1
        )
        .getValues();
    }
    var extensionValues = null;
    if (extensionColumn) {
      extensionValues = sheet
        .getRange(
          currentRow,
          extensionColumn,
          numRows,
          1
        )
        .getValues();
    }
    var rootIdValues = sheet
      .getRange(
        currentRow,
        rootIdColumn,
        numRows,
        1
      )
      .getValues();
    var existingOutputValues =
      readMappedOutputRows_(
        sheet,
        currentRow,
        numRows,
        outputMapping,
        VERIFY_OUTPUT_FIELDS
      );
    var outputValues = [];
    var scriptCache =
      CacheService.getScriptCache();
    for (
      var rowOffset = 0;
      rowOffset < numRows;
      rowOffset++
    ) {
      var existingExistsValue =
        getMappedValue_(
          existingOutputValues[rowOffset],
          'Exists'
        );
      var existingExistsText =
        existingExistsValue === null ||
        existingExistsValue === undefined
          ? ''
          : existingExistsValue
              .toString()
              .trim()
              .toUpperCase();
      if (existingExistsText === 'TRUE') {
        outputValues.push(
          existingOutputValues[rowOffset]
        );
        continue;
      }
      var rootId =
        rootIdValues[rowOffset][0];
      var rawPathEntries = [];
      for (
        var pathIndex = 0;
        pathIndex < pathColumns.length;
        pathIndex++
      ) {
        var currentPathColumn =
          pathColumns[pathIndex];
        rawPathEntries.push({
          column: currentPathColumn,
          columnLetter:
            convertColumnToLetter_(
              currentPathColumn
            ),
          value:
            pathValuesByColumn[
              currentPathColumn
            ][rowOffset][0]
        });
      }
      var fileNameValue =
        fileValues
          ? fileValues[rowOffset][0]
          : '';
      var extensionValue =
        extensionValues
          ? extensionValues[rowOffset][0]
          : '';
      var fileReference =
        buildFileReferenceFromRow_({
          rawPathEntries: rawPathEntries,
          fileNameValue: fileNameValue,
          extensionValue: extensionValue
        });
      if (!rootId) {
        outputValues.push(
          buildVerifyOutputObject_(
            false,
            '',
            0,
            '',
            '',
            '',
            '',
            'Missing RootID.'
          )
        );
        continue;
      }
      if (!fileReference.isValid) {
        outputValues.push(
          buildVerifyOutputObject_(
            false,
            '',
            fileReference.checkedPathCount || 0,
            '',
            '',
            '',
            '',
            fileReference.error
          )
        );
        continue;
      }
      var result =
        verifyFileAcrossCandidatePaths_(
          rootId,
          fileReference.candidatePaths,
          fileReference.filename,
          scriptCache
        );
      outputValues.push(
        convertVerifyResultToObject_(
          result
        )
      );
    }
    writeMappedOutputRows_(
      sheet,
      currentRow,
      outputValues,
      outputMapping,
      VERIFY_OUTPUT_FIELDS
    );
    var nextRow = lastRow + 1;
    props.setProperty(
      'AUTO_CURRENT_ROW',
      nextRow.toString()
    );
    props.setProperty(
      'AUTO_LAST_SUCCESS_TS',
      Date.now().toString()
    );
    if (nextRow > endRow) {
      if (!advanceMultiPhasePipeline_('VERIFY')) { CLEAR_TRIGGER_AND_STATE(); }
      SpreadsheetApp
        .openById(spreadsheetId)
        .toast(
          'File verification completed.',
          'VERRACT',
          5
        );
    }
  } catch (err) {
    handleRuntimeError_(
      err,
      props
    );
  }
}

/**
 * Multi-phase orchestration foundation.
 * Runs Verify -> Resolve -> Action Preview using persisted phase configs.
 */
function CREATE_MULTI_PHASE_PIPELINE() {
  throw new Error('Open the verract Control Panel and start Multi-Phase Preview from Home.');
}

function startMultiPhasePipeline_(config) {
  if (!config || !config.verify || !config.resolve || !config.action) {
    throw new Error('Verify, Resolve, and Action configs are required.');
  }
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(ENGINE_STATE_KEY) === 'TRUE') throw new Error('Automation masih aktif.');

  props.setProperties({
    PIPELINE_ENABLED: 'TRUE',
    PIPELINE_PHASE: 'VERIFY',
    PIPELINE_VERIFY_CONFIG: JSON.stringify(config.verify),
    PIPELINE_RESOLVE_CONFIG: JSON.stringify(config.resolve),
    PIPELINE_ACTION_CONFIG: JSON.stringify(config.action),
    PIPELINE_STARTED_AT: Date.now().toString()
  });
  return startVerifyAutomation_(config.verify);
}

function advanceMultiPhasePipeline_(completedPhase) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('PIPELINE_ENABLED') !== 'TRUE') return false;

  var nextPhase = completedPhase === 'VERIFY'
    ? 'RESOLVE'
    : completedPhase === 'RESOLVE'
      ? 'ACTION_PREVIEW'
      : 'COMPLETE';

  props.setProperty('PIPELINE_PHASE', nextPhase);
  deleteExistingTriggers_();
  props.setProperty(ENGINE_STATE_KEY, 'FALSE');
  clearPhaseStateOnly_(completedPhase, props);

  if (nextPhase === 'COMPLETE') {
    CLEAR_TRIGGER_AND_STATE();
    return true;
  }

  ScriptApp.newTrigger('TRIGGER_MULTI_PHASE_TRANSITION')
    .timeBased()
    .after(1000)
    .create();
  return true;
}

function TRIGGER_MULTI_PHASE_TRANSITION() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var phase = props.getProperty('PIPELINE_PHASE');
    deleteExistingTriggers_();

    if (phase === 'RESOLVE') {
      var resolveConfig = JSON.parse(props.getProperty('PIPELINE_RESOLVE_CONFIG') || '{}');
      startResolveAutomation_(resolveConfig);
      return;
    }
    if (phase === 'ACTION_PREVIEW') {
      var actionConfig = JSON.parse(props.getProperty('PIPELINE_ACTION_CONFIG') || '{}');
      actionConfig.pipelineMode = true;
      startActionPreviewAutomation_(actionConfig);
      return;
    }
    CLEAR_TRIGGER_AND_STATE();
  } finally {
    lock.releaseLock();
  }
}

function clearPhaseStateOnly_(phase, props) {
  var keys = phase === 'VERIFY' ? METADATA_KEYS : phase === 'RESOLVE' ? RESOLVE_METADATA_KEYS : ACTION_METADATA_KEYS;
  keys.forEach(function(key) { props.deleteProperty(key); });
}
