function CREATE_TIME_TRIGGER_MULTI() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getActiveSheet();
  var range = sheet.getActiveRange();
  if (!range) {
    ui.alert(
      'No Selection',
      'Pilih range data dulu.',
      ui.ButtonSet.OK
    );
    return;
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
    return;
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
    return;
  }
  var pathColumns =
    pathColumnParse.columns;
  if (
    !confirmLargePathColumnSelection_(
      pathColumns.length
    )
  ) {
    return;
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
    return;
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
      return;
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
    return;
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
      return;
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
    return;
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
    return;
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
    return;
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
    return;
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
    return;
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
    return;
  }
  if (
    !confirmOutputWithinSheetBoundary_(
      sheet,
      targetColumn,
      OUTPUT_WIDTH
    )
  ) {
    return;
  }
  if (
    !confirmNonBlankMainOutput_(
      sheet,
      startRow,
      targetColumn,
      numRows
    )
  ) {
    return;
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
    return;
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
  return;
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
    return;
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
    return;
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
  return;
}
  var props =
    PropertiesService.getScriptProperties();
  if (
    props.getProperty(ENGINE_STATE_KEY) ===
    'TRUE'
  ) {
    ui.alert(
      'Engine Locked',
      'Engine masih aktif. Jalankan Stop & Reset dulu.',
      ui.ButtonSet.OK
    );
    return;
  }
  deleteExistingTriggers_();
  props.setProperties({
    AUTO_CURRENT_ROW: startRow.toString(),
    AUTO_END_ROW: endRow.toString(),
    AUTO_PATH_COLUMNS: JSON.stringify(
      pathColumns
    ),
    AUTO_FILE_COLUMN: fileColumn.toString(),
    AUTO_EXTENSION_COLUMN:
      extensionColumn.toString(),
    AUTO_ROOT_ID_COLUMN:
      rootIdColumn.toString(),
    AUTO_TARGET_COL:
      targetColumn.toString(),
    AUTO_SPREADSHEET_ID:
      SpreadsheetApp
        .getActiveSpreadsheet()
        .getId(),
    AUTO_SHEET_NAME: sheet.getName(),
    DYNAMIC_BATCH_SIZE:
      batchSize.toString(),
    AUTO_ENGINE_STARTED_AT:
      Date.now().toString(),
    AUTO_LAST_SUCCESS_TS:
      Date.now().toString()
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
    .everyMinutes(triggerGap)
    .create();
  SpreadsheetApp
    .getActiveSpreadsheet()
    .toast(
      'File verification started.',
      'VERRACT',
      5
    );
  TRIGGER_BATCH_AUDIT_MULTI();
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
      !targetColumn ||
      !batchSize
    ) {
      throw new Error(
        'Engine metadata incomplete.'
      );
    } if (currentRow > endRow) {
      CLEAR_TRIGGER_AND_STATE();
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
    var existingOutputValues = sheet
      .getRange(
        currentRow,
        targetColumn,
        numRows,
        OUTPUT_WIDTH
      )
      .getValues();
    var outputValues = [];
    var scriptCache =
      CacheService.getScriptCache();
    for (
      var rowOffset = 0;
      rowOffset < numRows;
      rowOffset++
    ) {
      if (
        existingOutputValues[rowOffset][0] !==
        ''
      ) {
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
        outputValues.push([
          false,
          '',
          '',
          '',
          '',
          '',
          0,
          'Missing RootID.'
        ]);
        continue;
      }
      if (!fileReference.isValid) {
        outputValues.push([
          false,
          '',
          '',
          '',
          '',
          '',
          fileReference.checkedPathCount || 0,
          fileReference.error
        ]);
        continue;
      }
      var result =
        verifyFileAcrossCandidatePaths_(
          rootId,
          fileReference.candidatePaths,
          fileReference.filename,
          scriptCache
        );
      outputValues.push([
        result.exists,
        result.fileId,
        result.fileType,
        result.parentId,
        result.verifiedFilePath,
        result.matchedPathColumn,
        result.checkedPathCount,
        result.error
      ]);
    }
    sheet
      .getRange(
        currentRow,
        targetColumn,
        outputValues.length,
        OUTPUT_WIDTH
      )
      .setValues(outputValues);
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
      CLEAR_TRIGGER_AND_STATE();

      SpreadsheetApp
        .openById(spreadsheetId)
        .toast(
          'File verification completed.',
          'VERRACT',
          5
        );
    }
}