function CREATE_TIME_TRIGGER_MULTI() {
  var lock = LockService.getScriptLock();
  var lockReleased = false;

  if (!lock.tryLock(2000)) {
    SpreadsheetApp
      .getActiveSpreadsheet()
      .toast('Server sedang sibuk.', 'LOCKED', 3);
    return;
  }

  try {
    var props = PropertiesService.getScriptProperties();

    checkEngineHeartbeat_();

    if (props.getProperty(ENGINE_STATE_KEY) === 'TRUE') {
      SpreadsheetApp
        .getActiveSpreadsheet()
        .toast('Automation masih aktif.', 'LOCKED', 5);
      return;
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var range = sheet.getActiveRange();
    var ui = SpreadsheetApp.getUi();

    if (!range) {
      ui.alert('Pilih range row yang ingin diproses.');
      return;
    }

    var pathColumnPrompt = ui.prompt(
      'Path Columns',
      'Masukkan satu atau beberapa kolom path.\n\n' +
        'Format yang didukung:\n' +
        'B\n' +
        'B,C,F\n' +
        'B-C,F,G-I',
      ui.ButtonSet.OK_CANCEL
    );

    if (
      pathColumnPrompt.getSelectedButton() !==
      ui.Button.OK
    ) {
      return;
    }

    var parsedPathColumns = parseColumnSelection_(
      pathColumnPrompt.getResponseText()
    );

    if (!parsedPathColumns.isValid) {
      ui.alert(
        'Invalid Path Columns',
        parsedPathColumns.error,
        ui.ButtonSet.OK
      );
      return;
    }

    var pathColumns = parsedPathColumns.columns;

    if (
      !confirmLargePathColumnSelection_(
        pathColumns.length
      )
    ) {
      ss.toast(
        'Proses dibatalkan oleh user.',
        'CANCELLED',
        5
      );
      return;
    }

    var fileColumnPrompt = ui.prompt(
      'File Column',
      'Masukkan kolom yang berisi filename lengkap dengan extension.\n\n' +
        'Contoh: J',
      ui.ButtonSet.OK_CANCEL
    );

    if (
      fileColumnPrompt.getSelectedButton() !==
      ui.Button.OK
    ) {
      return;
    }

    var fileColumnResult = validateFileColumn_(
      fileColumnPrompt.getResponseText()
    );

    if (!fileColumnResult.isValid) {
      ui.alert(
        'Invalid File Column',
        fileColumnResult.error,
        ui.ButtonSet.OK
      );
      return;
    }

    var fileColumn = fileColumnResult.column;

    var rootIdColumnPrompt = ui.prompt(
      'RootID Column',
      'Masukkan kolom yang berisi RootID.\n\nContoh: A',
      ui.ButtonSet.OK_CANCEL
    );

    if (
      rootIdColumnPrompt.getSelectedButton() !==
      ui.Button.OK
    ) {
      return;
    }

    var rootIdColumnText = rootIdColumnPrompt
      .getResponseText()
      .trim()
      .toUpperCase();

    if (!isValidColumnLetter_(rootIdColumnText)) {
      ui.alert(
        'Invalid RootID Column',
        'Masukkan huruf kolom saja.\n\nContoh valid: A, D, AA',
        ui.ButtonSet.OK
      );
      return;
    }

    var rootIdColumn = convertLetterToColumn(
      rootIdColumnText
    );

    var inputValidation = validateInputColumns_(
      pathColumns,
      fileColumn,
      rootIdColumn
    );

    if (
      !inputValidation ||
      typeof inputValidation.isValid === 'undefined'
    ) {
      throw new Error(
        'validateInputColumns_ did not return a valid result object.'
      );
    }

    if (!inputValidation.isValid) {
      ui.alert(
        'Invalid Input Columns',
        inputValidation.error,
        ui.ButtonSet.OK
      );

      ss.toast(
        'Proses dibatalkan: konfigurasi input column tidak valid.',
        'CANCELLED',
        5
      );

      return;
    }

    var targetColumnPrompt = ui.prompt(
      'Output Column',
      'Masukkan huruf kolom awal output.\n\n' +
        'Output:\n' +
        'Exists | FileID | FileType | ParentID | VerifiedFilePath | MatchedPathColumn | CheckedPathCount | Error',
      ui.ButtonSet.OK_CANCEL
    );

    if (
      targetColumnPrompt.getSelectedButton() !==
      ui.Button.OK
    ) {
      return;
    }

    var targetColumnText = targetColumnPrompt
      .getResponseText()
      .trim()
      .toUpperCase();

    if (!isValidColumnLetter_(targetColumnText)) {
      ui.alert(
        'Invalid Output Column',
        'Masukkan huruf kolom saja.\n\n' +
          'Contoh valid: K, AA, AB\n' +
          'Contoh tidak valid: 1, A1, @@, kosong',
        ui.ButtonSet.OK
      );
      return;
    }

    var targetColumn = convertLetterToColumn(
      targetColumnText
    );

    if (
      !confirmOutputWithinSheetBoundary_(
        sheet,
        targetColumn,
        OUTPUT_WIDTH
      )
    ) {
      ss.toast(
        'Proses dibatalkan: output melebihi batas sheet.',
        'CANCELLED',
        5
      );
      return;
    }

    if (
      !confirmOutputDoesNotOverlapInputs_(
        pathColumns,
        fileColumn,
        rootIdColumn,
        targetColumn,
        OUTPUT_WIDTH
      )
    ) {
      ss.toast(
        'Proses dibatalkan: output bertabrakan dengan input.',
        'CANCELLED',
        5
      );
      return;
    }

    if (
      !confirmNonBlankMainOutput_(
        sheet,
        range.getRow(),
        targetColumn,
        range.getNumRows()
      )
    ) {
      ss.toast(
        'Proses dibatalkan oleh user.',
        'CANCELLED',
        5
      );
      return;
    }

    var batchPrompt = ui.prompt(
      'Batch Size',
      'Masukkan jumlah row per batch:',
      ui.ButtonSet.OK_CANCEL
    );

    if (
      batchPrompt.getSelectedButton() !==
      ui.Button.OK
    ) {
      return;
    }

    var batchSize = parseInt(
      batchPrompt.getResponseText(),
      10
    );

    if (
      isNaN(batchSize) ||
      batchSize < MIN_BATCH_SIZE
    ) {
      batchSize = DEFAULT_BATCH_SIZE;
    }

    if (batchSize > MAX_BATCH_SIZE) {
      ui.alert(
        '⚠️ Batch Size Too Large',
        'Batch size maksimal adalah ' +
          MAX_BATCH_SIZE +
          ' rows.',
        ui.ButtonSet.OK
      );
      return;
    }

    var workloadResult = validateVerifyWorkload_(
      batchSize,
      pathColumns.length
    );

    if (!workloadResult.isValid) {
      ui.alert(
        '⚠️ Verify Workload Too Large',
        workloadResult.error,
        ui.ButtonSet.OK
      );
      return;
    }

    var gapPrompt = ui.prompt(
      'Interval Menit',
      'Masukkan interval trigger dalam menit.\n' +
        'Minimal: ' +
        MIN_TRIGGER_GAP_MINUTES +
        '\n' +
        'Maksimal: ' +
        MAX_TRIGGER_GAP_MINUTES,
      ui.ButtonSet.OK_CANCEL
    );

    if (
      gapPrompt.getSelectedButton() !==
      ui.Button.OK
    ) {
      return;
    }

    var gap = parseInt(
      gapPrompt.getResponseText(),
      10
    );

    if (
      isNaN(gap) ||
      gap < MIN_TRIGGER_GAP_MINUTES
    ) {
      gap = DEFAULT_TRIGGER_GAP_MINUTES;
    }

    if (gap > MAX_TRIGGER_GAP_MINUTES) {
      ui.alert(
        '⚠️ Interval Too Large',
        'Interval maksimal adalah ' +
          MAX_TRIGGER_GAP_MINUTES +
          ' menit.',
        ui.ButtonSet.OK
      );
      return;
    }

    deleteExistingTriggers_();

    props.deleteProperty('AUTO_LAST_ERROR');
    props.deleteProperty('AUTO_BACKOFF_UNTIL');

    var timestampNow = Date.now().toString();
    var startRow = range.getRow();
    var endRow =
      startRow + range.getNumRows() - 1;

    props.setProperty(
      ENGINE_STATE_KEY,
      'TRUE'
    );

    props.setProperties({
      AUTO_CURRENT_ROW: startRow.toString(),
      AUTO_END_ROW: endRow.toString(),
      AUTO_PATH_COLUMNS: JSON.stringify(pathColumns),
      AUTO_FILE_COLUMN: fileColumn.toString(),
      AUTO_ROOT_ID_COLUMN: rootIdColumn.toString(),
      AUTO_TARGET_COL: targetColumn.toString(),
      AUTO_SPREADSHEET_ID: ss.getId(),
      AUTO_SHEET_NAME: sheet.getName(),
      DYNAMIC_BATCH_SIZE: batchSize.toString(),
      AUTO_ENGINE_STARTED_AT: timestampNow,
      AUTO_LAST_SUCCESS_TS: timestampNow
    });

    ScriptApp
      .newTrigger('TRIGGER_BATCH_AUDIT_MULTI')
      .timeBased()
      .everyMinutes(gap)
      .create();

    lock.releaseLock();
    lockReleased = true;

    TRIGGER_BATCH_AUDIT_MULTI();

    ss.toast(
      'Batch pertama langsung jalan. Batch berikutnya sesuai interval.',
      'SUCCESS',
      5
    );

    return;
  } finally {
    if (!lockReleased) {
      try {
        lock.releaseLock();
      } catch (err) {}
    }
  }
}

function TRIGGER_BATCH_AUDIT_MULTI() {
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(500)) {
    return;
  }

  try {
    var props =
      PropertiesService.getScriptProperties();

    var now = Date.now();

    var backoffUntil = parseInt(
      props.getProperty('AUTO_BACKOFF_UNTIL') ||
        '0',
      10
    );

    if (now < backoffUntil) {
      return;
    }

    if (
      props.getProperty(ENGINE_STATE_KEY) !==
      'TRUE'
    ) {
      return;
    }

    var spreadsheetId = props.getProperty(
      'AUTO_SPREADSHEET_ID'
    );

    var sheetName = props.getProperty(
      'AUTO_SHEET_NAME'
    );

    if (!spreadsheetId || !sheetName) {
      throw new Error(
        'Missing spreadsheet or sheet metadata.'
      );
    }

    var ss = SpreadsheetApp.openById(
      spreadsheetId
    );

    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(
        'Verify source sheet not found.'
      );
    }

    var currentRow = parseInt(
      props.getProperty('AUTO_CURRENT_ROW'),
      10
    );

    var endRow = parseInt(
      props.getProperty('AUTO_END_ROW'),
      10
    );

    var fileColumn = parseInt(
      props.getProperty('AUTO_FILE_COLUMN'),
      10
    );

    var rootIdColumn = parseInt(
      props.getProperty('AUTO_ROOT_ID_COLUMN'),
      10
    );

    var targetColumn = parseInt(
      props.getProperty('AUTO_TARGET_COL'),
      10
    );

    var batchSize = parseInt(
      props.getProperty('DYNAMIC_BATCH_SIZE'),
      10
    );

    var pathColumns;

    try {
      pathColumns = JSON.parse(
        props.getProperty('AUTO_PATH_COLUMNS') ||
          '[]'
      );
    } catch (parseErr) {
      throw new Error(
        'Invalid path-column metadata.'
      );
    }

    if (
      isNaN(currentRow) ||
      isNaN(endRow) ||
      isNaN(fileColumn) ||
      isNaN(rootIdColumn) ||
      isNaN(targetColumn) ||
      !pathColumns.length
    ) {
      throw new Error(
        'Invalid Verify state: row or column metadata is corrupted.'
      );
    }

    if (
      isNaN(batchSize) ||
      batchSize < MIN_BATCH_SIZE
    ) {
      batchSize = DEFAULT_BATCH_SIZE;
    }

    if (currentRow > endRow) {
      CLEAR_TRIGGER_AND_STATE();
      return;
    }

    var rowsToProcess = Math.min(
      batchSize,
      endRow - currentRow + 1
    );

    var pathValuesByColumn = {};

    for (
      var pathIndex = 0;
      pathIndex < pathColumns.length;
      pathIndex++
    ) {
      var pathColumn = pathColumns[pathIndex];

      pathValuesByColumn[pathColumn] = sheet
        .getRange(
          currentRow,
          pathColumn,
          rowsToProcess,
          1
        )
        .getValues();
    }

    var fileValues = sheet
      .getRange(
        currentRow,
        fileColumn,
        rowsToProcess,
        1
      )
      .getValues();

    var rootValues = sheet
      .getRange(
        currentRow,
        rootIdColumn,
        rowsToProcess,
        1
      )
      .getValues();

    var existingOutput = sheet
      .getRange(
        currentRow,
        targetColumn,
        rowsToProcess,
        OUTPUT_WIDTH
      )
      .getValues();

    var output = [];

    var scriptCache =
      CacheService.getScriptCache();

    for (
      var rowIndex = 0;
      rowIndex < rowsToProcess;
      rowIndex++
    ) {
      if (existingOutput[rowIndex][0] !== '') {
        output.push(
          existingOutput[rowIndex]
        );
        continue;
      }

      var filename = fileValues[rowIndex][0];
      var rootId = rootValues[rowIndex][0];

      if (
        filename === '' ||
        filename === null
      ) {
        output.push([
          false,
          '',
          '',
          '',
          '',
          '',
          0,
          'Missing filename.'
        ]);
        continue;
      }

      var candidatePaths = [];

      for (
        var columnIndex = 0;
        columnIndex < pathColumns.length;
        columnIndex++
      ) {
        var sourceColumn =
          pathColumns[columnIndex];

        var pathValue =
          pathValuesByColumn[sourceColumn][
            rowIndex
          ][0];

        candidatePaths.push({
          column: sourceColumn,
          value: pathValue
        });
      }

      if (
        rootId === '' ||
        rootId === null ||
        rootId === undefined
      ) {
        output.push([
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

      var result =
        verifyFileAcrossCandidatePaths_(
          rootId.toString().trim(),
          candidatePaths,
          filename.toString(),
          scriptCache
        );

      output.push([
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
        rowsToProcess,
        OUTPUT_WIDTH
      )
      .setValues(output);

    var nextRow =
      currentRow + rowsToProcess;

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
    }
  } catch (err) {
    handleRuntimeError_(err, props);
  } finally {
    lock.releaseLock();
  }
}