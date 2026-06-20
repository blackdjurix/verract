function CREATE_RESOLVE_TRIGGER_MULTI() {
  var config = collectResolveConfigFromPrompts_();
  if (!config) {
    return;
  }

  var result = startResolveAutomation_(config);

  SpreadsheetApp
    .getActiveSpreadsheet()
    .toast(
      result.message,
      'RESOLVE STARTED',
      5
    );
}

function collectResolveConfigFromPrompts_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var range = sheet.getActiveRange();

  if (!range) {
    SpreadsheetApp
      .getUi()
      .alert(
        'Pilih range row yang mau di-Resolve dulu.'
      );
    return null;
  }

  var ui = SpreadsheetApp.getUi();

  var pathPrompt = ui.prompt(
    'Path Column(s)',
    'Masukkan kolom path kandidat.\nContoh: D-F atau J',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    pathPrompt.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var pathText =
    pathPrompt
      .getResponseText()
      .trim()
      .toUpperCase();

  var pathColumns =
    parseResolveColumnSpec_(pathText);

  if (pathColumns.length === 0) {
    ui.alert('Path column tidak valid.');
    return null;
  }

  var filePrompt = ui.prompt(
    'File Column',
    'Masukkan huruf kolom file.\nKosongkan jika tidak ada.',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    filePrompt.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var fileText =
    filePrompt
      .getResponseText()
      .trim()
      .toUpperCase();

  var fileColumn =
    fileText
      ? convertLetterToColumn(fileText)
      : -1;

  var extPrompt = ui.prompt(
    'Extension Column',
    'Masukkan huruf kolom extension.\nKosongkan jika tidak ada.',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    extPrompt.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var extText =
    extPrompt
      .getResponseText()
      .trim()
      .toUpperCase();

  var extColumn =
    extText
      ? convertLetterToColumn(extText)
      : -1;

  var rootPrompt = ui.prompt(
    'RootID Column',
    'Masukkan huruf kolom RootID.\nContoh: C',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    rootPrompt.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var rootText =
    rootPrompt
      .getResponseText()
      .trim()
      .toUpperCase();

  if (!isValidColumnLetter_(rootText)) {
    ui.alert('RootID column tidak valid.');
    return null;
  }

  var verifyPrompt = ui.prompt(
    'Verify Output Start Column',
    'Masukkan huruf kolom awal output Verify.\nContoh: J / K\n\nUrutan Verify harus:\nExists | FileID | FileType | ParentID | VerifiedFilePath | MatchedPathColumn | CheckedPathCount | Error',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    verifyPrompt.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var verifyText =
    verifyPrompt
      .getResponseText()
      .trim()
      .toUpperCase();

  if (!isValidColumnLetter_(verifyText)) {
    ui.alert('Verify output column tidak valid.');
    return null;
  }

  var targetPrompt = ui.prompt(
    'Resolve Output Start Column',
    'Masukkan huruf kolom awal output Resolve.\n\nOutput:\nResolveStatus | ResolvedID | ResolvedType | ResolvedPath | MatchCount | MatchMethod | Confidence | ResolveNote',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    targetPrompt.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var targetText =
    targetPrompt
      .getResponseText()
      .trim()
      .toUpperCase();

  if (!isValidColumnLetter_(targetText)) {
    ui.alert('Resolve output column tidak valid.');
    return null;
  }

  var batchPrompt = ui.prompt(
    'Resolve Batch Size',
    'Masukkan jumlah row per batch.',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    batchPrompt.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var batchSize =
    parseInt(
      batchPrompt.getResponseText(),
      10
    );

  if (
    isNaN(batchSize) ||
    batchSize < RESOLVE_MIN_BATCH_SIZE
  ) {
    batchSize = RESOLVE_DEFAULT_BATCH_SIZE;
  }

  if (batchSize > RESOLVE_MAX_BATCH_SIZE) {
    ui.alert(
      'Batch terlalu besar. Maksimal: ' +
        RESOLVE_MAX_BATCH_SIZE
    );
    return null;
  }

  var gapPrompt = ui.prompt(
    'Interval Menit',
    'Minimal 5 menit.',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    gapPrompt.getSelectedButton() !==
    ui.Button.OK
  ) {
    return null;
  }

  var gap =
    parseInt(
      gapPrompt.getResponseText(),
      10
    );

  if (
    isNaN(gap) ||
    gap < RESOLVE_MIN_TRIGGER_GAP_MINUTES
  ) {
    gap = RESOLVE_DEFAULT_TRIGGER_GAP_MINUTES;
  }

  if (gap > RESOLVE_MAX_TRIGGER_GAP_MINUTES) {
    ui.alert(
      'Interval terlalu besar. Maksimal: ' +
        RESOLVE_MAX_TRIGGER_GAP_MINUTES +
        ' menit.'
    );
    return null;
  }

  return {
    startRow: range.getRow(),
    endRow:
      range.getRow() +
      range.getNumRows() -
      1,
    pathColumns: pathColumns,
    fileColumn: fileColumn,
    extensionColumn: extColumn,
    rootIdColumn:
      convertLetterToColumn(rootText),
    verifyOutputColumn:
      convertLetterToColumn(verifyText),
    resolveOutputColumn:
      convertLetterToColumn(targetText),
    batchSize: batchSize,
    triggerGapMinutes: gap,
    spreadsheetId: ss.getId(),
    sheetName: sheet.getName()
  };
}

function startResolveAutomation_(config) {
  var lock =
    LockService.getScriptLock();

  var lockReleased = false;

  if (!lock.tryLock(2000)) {
    throw new Error(
      'Server sedang sibuk.'
    );
  }

  try {
    var normalizedConfig =
      normalizeResolveAutomationConfig_(
        config
      );

    var props =
      PropertiesService.getScriptProperties();

    checkEngineHeartbeat_();

    if (
      props.getProperty(ENGINE_STATE_KEY) ===
      'TRUE'
    ) {
      throw new Error(
        'Automation masih aktif.'
      );
    }

    deleteExistingTriggers_();

    props.deleteProperty('AUTO_LAST_ERROR');
    props.deleteProperty('AUTO_BACKOFF_UNTIL');

    var timestampNow =
      Date.now().toString();

    props.setProperty(
      ENGINE_STATE_KEY,
      'TRUE'
    );

    props.setProperties({
      RESOLVE_CURRENT_ROW:
        normalizedConfig.startRow.toString(),
      RESOLVE_END_ROW:
        normalizedConfig.endRow.toString(),
      RESOLVE_PATH_COLUMNS:
        normalizedConfig.pathColumns.join(','),
      RESOLVE_FILE_COLUMN:
        normalizedConfig.fileColumn.toString(),
      RESOLVE_EXTENSION_COLUMN:
        normalizedConfig.extensionColumn.toString(),
      RESOLVE_VERIFY_OUTPUT_COLUMN:
        (normalizedConfig.verifyOutputColumn || 0).toString(),
      RESOLVE_VERIFY_OUTPUT_MAPPING:
        serializeOutputMapping_(
          normalizedConfig.verifyOutputMapping
        ),
      RESOLVE_ROOT_ID_COLUMN:
        normalizedConfig.rootIdColumn.toString(),
      RESOLVE_TARGET_COL:
        (normalizedConfig.resolveOutputColumn || 0).toString(),
      RESOLVE_OUTPUT_MAPPING:
        serializeOutputMapping_(
          normalizedConfig.outputMapping
        ),
      RESOLVE_SPREADSHEET_ID:
        normalizedConfig.spreadsheetId,
      RESOLVE_SHEET_NAME:
        normalizedConfig.sheetName,
      RESOLVE_BATCH_SIZE:
        normalizedConfig.batchSize.toString(),
      RESOLVE_LAST_SUCCESS_TS:
        timestampNow,
      RESOLVE_ENGINE_STARTED_AT:
        timestampNow
    });

    ScriptApp
      .newTrigger(
        'TRIGGER_RESOLVE_BATCH_MULTI'
      )
      .timeBased()
      .everyMinutes(
        normalizedConfig.triggerGapMinutes
      )
      .create();

    lock.releaseLock();
    lockReleased = true;

    TRIGGER_RESOLVE_BATCH_MULTI();

    return {
      success: true,
      mode: 'RESOLVE',
      startRow: normalizedConfig.startRow,
      endRow: normalizedConfig.endRow,
      batchSize: normalizedConfig.batchSize,
      triggerGapMinutes:
        normalizedConfig.triggerGapMinutes,
      message:
        'Resolve automation started.'
    };
  } finally {
    if (!lockReleased) {
      try {
        lock.releaseLock();
      } catch (err) {}
    }
  }
}

function normalizeResolveAutomationConfig_(config) {
  if (!config) {
    throw new Error(
      'Resolve config is required.'
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
      'Resolve row range tidak valid.'
    );
  }

  var pathColumns =
    normalizeResolvePathColumns_(
      config.pathColumns
    );

  if (!pathColumns.length) {
    throw new Error(
      'Path column tidak valid.'
    );
  }

  var fileColumn =
    normalizeResolveOptionalColumn_(
      config.fileColumn
    );

  var extensionColumn =
    normalizeResolveOptionalColumn_(
      config.extensionColumn
    );

  var rootIdColumn =
    normalizeRequiredColumn_(
      config.rootIdColumn
    );

  var hasVerifyMapping =
    config.verifyOutputMapping &&
    config.verifyOutputMapping.Exists;

  var verifyOutputColumn = 0;

  if (!hasVerifyMapping) {
    verifyOutputColumn =
      normalizeRequiredColumn_(
        config.verifyOutputColumn
      );
  }

  var hasExplicitOutputMapping =
    config.outputMapping &&
    Object.keys(config.outputMapping).length > 0;

  var resolveOutputColumn = 0;

  if (!hasExplicitOutputMapping) {
    resolveOutputColumn =
      normalizeRequiredColumn_(
        config.resolveOutputColumn ||
          config.targetColumn
      );
  }

  var batchSize =
    config.batchSize === '' ||
    config.batchSize === null ||
    config.batchSize === undefined
      ? RESOLVE_DEFAULT_BATCH_SIZE
      : parseInt(config.batchSize, 10);

  if (
    isNaN(batchSize) ||
    batchSize < RESOLVE_MIN_BATCH_SIZE
  ) {
    batchSize = RESOLVE_DEFAULT_BATCH_SIZE;
  }

  if (batchSize > RESOLVE_MAX_BATCH_SIZE) {
    throw new Error(
      'Batch terlalu besar. Maksimal: ' +
        RESOLVE_MAX_BATCH_SIZE
    );
  }

  var triggerGapMinutes =
    config.triggerGapMinutes === '' ||
    config.triggerGapMinutes === null ||
    config.triggerGapMinutes === undefined
      ? RESOLVE_DEFAULT_TRIGGER_GAP_MINUTES
      : parseInt(config.triggerGapMinutes, 10);

  if (
    isNaN(triggerGapMinutes) ||
    triggerGapMinutes <
      RESOLVE_MIN_TRIGGER_GAP_MINUTES
  ) {
    triggerGapMinutes =
      RESOLVE_DEFAULT_TRIGGER_GAP_MINUTES;
  }

  if (
    triggerGapMinutes >
    RESOLVE_MAX_TRIGGER_GAP_MINUTES
  ) {
    throw new Error(
      'Interval terlalu besar. Maksimal: ' +
        RESOLVE_MAX_TRIGGER_GAP_MINUTES +
        ' menit.'
    );
  }

  var verifyOutputMapping =
    normalizeOutputMapping_(
      config.verifyOutputMapping,
      VERIFY_OUTPUT_FIELDS,
      verifyOutputColumn
    );

  var outputMapping =
    normalizeOutputMapping_(
      config.outputMapping,
      RESOLVE_OUTPUT_FIELDS,
      resolveOutputColumn || null
    );

  return {
    startRow: startRow,
    endRow: endRow,
    pathColumns: pathColumns,
    fileColumn: fileColumn,
    extensionColumn: extensionColumn,
    rootIdColumn: rootIdColumn,
    verifyOutputColumn: verifyOutputColumn,
    verifyOutputMapping: verifyOutputMapping,
    resolveOutputColumn:
      resolveOutputColumn,
    outputMapping: outputMapping,
    batchSize: batchSize,
    triggerGapMinutes: triggerGapMinutes,
    spreadsheetId: spreadsheetId,
    sheetName: sheetName
  };
}

function normalizeResolvePathColumns_(value) {
  if (Array.isArray(value)) {
    return value
      .map(function(column) {
        return parseInt(column, 10);
      })
      .filter(function(column) {
        return !isNaN(column) && column > 0;
      });
  }

  return parseResolveColumnSpec_(
    value
      .toString()
      .trim()
      .toUpperCase()
  );
}

function normalizeResolveOptionalColumn_(value) {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === 0 ||
    value === -1
  ) {
    return -1;
  }

  if (
    typeof value === 'number' &&
    value > 0
  ) {
    return value;
  }

  if (!isValidColumnLetter_(value)) {
    throw new Error(
      'Optional column tidak valid.'
    );
  }

  return convertLetterToColumn(value);
}


function TRIGGER_RESOLVE_BATCH_MULTI() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(500)) {
    return;
  }
  var props = PropertiesService.getScriptProperties();
  try {
    var now = Date.now();
    var backoffUntil = parseInt(
      props.getProperty('AUTO_BACKOFF_UNTIL') || '0',
      10
    );
    if (now < backoffUntil) {
      return;
    }
    if (props.getProperty(ENGINE_STATE_KEY) !== 'TRUE') {
      return;
    }
    var spreadsheetId = props.getProperty('RESOLVE_SPREADSHEET_ID');
    var sheetName = props.getProperty('RESOLVE_SHEET_NAME');
    if (!spreadsheetId || !sheetName) {
      return;
    }
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Resolve source sheet not found.');
    }
    var currentRow = parseInt(props.getProperty('RESOLVE_CURRENT_ROW'), 10);
    var endRow = parseInt(props.getProperty('RESOLVE_END_ROW'), 10);
    var batchSize = parseInt(props.getProperty('RESOLVE_BATCH_SIZE'), 10);
    if (isNaN(batchSize) || batchSize < RESOLVE_MIN_BATCH_SIZE) {
      batchSize = RESOLVE_DEFAULT_BATCH_SIZE;
    }
    if (currentRow > endRow) {
      if (!advanceMultiPhasePipeline_('RESOLVE')) { CLEAR_TRIGGER_AND_STATE(); }
      return;
    }
    var rowsToProcess = Math.min(
      batchSize,
      endRow - currentRow + 1
    );
    processResolveBatch_(sheet, currentRow, rowsToProcess, props);
    var nextRow = currentRow + rowsToProcess;
    props.setProperty('RESOLVE_CURRENT_ROW', nextRow.toString());
    props.setProperty('RESOLVE_LAST_SUCCESS_TS', Date.now().toString());
    if (nextRow > endRow) {
      if (!advanceMultiPhasePipeline_('RESOLVE')) { CLEAR_TRIGGER_AND_STATE(); }
    }
  } catch (err) {
    handleRuntimeError_(err, props);
  } finally {
    lock.releaseLock();
  }
}

function processResolveBatch_(sheet, startRow, numRows, props) {
  var pathColumns = parseStoredResolveColumns_(
    props.getProperty('RESOLVE_PATH_COLUMNS')
  );
  var fileColumn = parseInt(
    props.getProperty('RESOLVE_FILE_COLUMN') || '-1',
    10
  );
  var extColumn = parseInt(
    props.getProperty('RESOLVE_EXTENSION_COLUMN') || '-1',
    10
  );
  var verifyOutputColumn = parseInt(
    props.getProperty('RESOLVE_VERIFY_OUTPUT_COLUMN'),
    10
  );
  var verifyOutputMapping =
    parseStoredOutputMapping_(
      props.getProperty(
        'RESOLVE_VERIFY_OUTPUT_MAPPING'
      ),
      VERIFY_OUTPUT_FIELDS,
      verifyOutputColumn
    );
  var rootIdColumn = parseInt(
    props.getProperty('RESOLVE_ROOT_ID_COLUMN'),
    10
  );
  var targetColumn = parseInt(
    props.getProperty('RESOLVE_TARGET_COL'),
    10
  );
  var outputMapping =
    parseStoredOutputMapping_(
      props.getProperty(
        'RESOLVE_OUTPUT_MAPPING'
      ),
      RESOLVE_OUTPUT_FIELDS,
      targetColumn
    );
  var lastColumn = sheet.getLastColumn();
  var rowValues = sheet
    .getRange(startRow, 1, numRows, lastColumn)
    .getValues();
  var existingOutput =
    readMappedOutputRows_(
      sheet,
      startRow,
      numRows,
      outputMapping,
      RESOLVE_OUTPUT_FIELDS
    );
  var output = [];
  var batchCache = {};

  var existsColumn =
    verifyOutputMapping.Exists ||
    verifyOutputColumn;
  var errorColumn =
    verifyOutputMapping.Error || 0;

  for (var i = 0; i < rowValues.length; i++) {
    var row = rowValues[i];

    var existsValue =
      getResolveRowValue_(
        row,
        existsColumn - 1
      );

    var errorValue =
      getResolveRowValue_(
        row,
        errorColumn - 1
      );

    var existsText =
      existsValue === null ||
      existsValue === undefined
        ? ''
        : existsValue
            .toString()
            .trim()
            .toUpperCase();

    var errorText =
      errorValue === null ||
      errorValue === undefined
        ? ''
        : errorValue
            .toString()
            .trim();

    if (!existsText && !errorText) {
      output.push(existingOutput[i]);
      continue;
    }

    if (existsText === 'TRUE') {
      output.push(
        convertResolveRowToObject_(
          convertResolveResultToRow_(
            buildResolveResult_(
              'SKIPPED_ALREADY_VERIFIED',
              '',
              '',
              '',
              0,
              '',
              '',
              'Verify result is not failed.'
            )
          )
        )
      );
      continue;
    }

    if (
      getMappedValue_(
        existingOutput[i],
        'ResolveStatus'
      ) !== ''
    ) {
      output.push(existingOutput[i]);
      continue;
    }

    if (!isFailedVerifyRow_(existsValue, errorValue)) {
      output.push(
        convertResolveRowToObject_(
          convertResolveResultToRow_(
            buildResolveResult_(
              'SKIPPED',
              '',
              '',
              '',
              0,
              '',
              '',
              'Verify result is not ready for Resolve.'
            )
          )
        )
      );
      continue;
    }

    var rootId =
      getResolveRowValue_(
        row,
        rootIdColumn - 1
      );

    var objectTarget =
      extractResolveObjectTargetFromInputRow_(
        row,
        pathColumns,
        fileColumn,
        extColumn
      );

    var verifyContext =
      extractResolveTargetFromError_(
        errorValue
      );

    if (!rootId) {
      output.push(
        convertResolveRowToObject_(
          convertResolveResultToRow_(
            buildResolveResult_(
              'ERROR',
              '',
              '',
              '',
              0,
              objectTarget.method,
              '',
              'Missing RootID.'
            )
          )
        )
      );
      continue;
    }

    if (!objectTarget.shouldSearch) {
      output.push(
        convertResolveRowToObject_(
          convertResolveResultToRow_(
            buildResolveResultFromSearch_(
              objectTarget,
              {
                matches: [],
                matchCount: 0,
                error: ''
              },
              verifyContext
            )
          )
        )
      );
      continue;
    }

    var cacheKey =
      buildResolveSearchCacheKey_(
        rootId,
        objectTarget.type,
        objectTarget.target
      );

    if (!batchCache[cacheKey]) {
      batchCache[cacheKey] =
        searchResolveObjectsByDriveIndex_(
          rootId,
          objectTarget.target,
          objectTarget.type
        );
    }

    var result =
      buildResolveResultFromSearch_(
        objectTarget,
        batchCache[cacheKey],
        verifyContext
      );

    output.push(
      convertResolveRowToObject_(
        convertResolveResultToRow_(
          result
        )
      )
    );
  }

  writeMappedOutputRows_(
    sheet,
    startRow,
    output,
    outputMapping,
    RESOLVE_OUTPUT_FIELDS
  );
}

function extractResolveTargetFromError_(errorValue) {
  var errorText = errorValue ? errorValue.toString().trim() : '';
  if (!errorText) {
    return {
      target: '',
      type: '',
      method: 'NO_ERROR',
      shouldSearch: false,
      note: 'Missing Verify error.'
    };
  }
  if (/^missing candidate path\.?$/i.test(errorText)) {
    return {
      target: '',
      type: '',
      method: 'MISSING_CANDIDATE_PATH',
      shouldSearch: false,
      note: 'Missing candidate path. Resolve skipped.'
    };
  }
  if (/^missing filename\.?$/i.test(errorText)) {
    return {
      target: '',
      type: '',
      method: 'MISSING_FILENAME',
      shouldSearch: false,
      note: 'Missing filename. Resolve skipped.'
    };
  }
  var missingFolderMatch = errorText.match(/^missing folder\s*:\s*(.+)$/i);
  if (missingFolderMatch && missingFolderMatch[1]) {
    var folderTarget = cleanResolveTarget_(missingFolderMatch[1]);
    return {
      target: folderTarget,
      type: 'folder',
      method: 'VERIFY_ERROR_MISSING_FOLDER',
      shouldSearch: false,
      note: 'Verify failed at folder: ' + folderTarget
    };
  }
  var fileNotFoundMatch = errorText.match(/^file not found\s*:\s*(.+)$/i);
  if (fileNotFoundMatch && fileNotFoundMatch[1]) {
    var fileTarget = cleanResolveTarget_(fileNotFoundMatch[1]);
    return {
      target: fileTarget,
      type: 'file',
      method: 'VERIFY_ERROR_FILE_NOT_FOUND',
      shouldSearch: false,
      note: 'Verify failed at file: ' + fileTarget
    };
  }
  return {
    target: '',
    type: '',
    method: 'UNSUPPORTED_ERROR',
    shouldSearch: false,
    note: 'Unsupported Verify error: ' + errorText
  };
}

function extractResolveObjectTargetFromInputRow_(
  row,
  pathColumns,
  fileColumn,
  extColumn
) {
  var fileValue = fileColumn > 0
    ? getResolveRowValue_(row, fileColumn - 1)
    : '';
  var extValue = extColumn > 0
    ? getResolveRowValue_(row, extColumn - 1)
    : '';
  var fileTarget = buildResolveFileTarget_(fileValue, extValue);
  if (fileTarget) {
    return {
      target: fileTarget,
      type: 'file',
      method: 'INPUT_FILE_TARGET',
      shouldSearch: true,
      note: ''
    };
  }
  for (var i = 0; i < pathColumns.length; i++) {
    var pathValue = getResolveRowValue_(row, pathColumns[i] - 1);
    var pathTarget = extractLastSegmentFromPath_(pathValue);
    if (pathTarget) {
      return {
        target: pathTarget,
        type: guessResolveObjectTypeFromName_(pathTarget),
        method: 'INPUT_PATH_LAST_OBJECT',
        shouldSearch: true,
        note: ''
      };
    }
  }
  return {
    target: '',
    type: '',
    method: 'NO_OBJECT_TARGET',
    shouldSearch: false,
    note: 'No object target found from input row.'
  };
}

function searchResolveObjectsByDriveIndex_(rootId, target, type) {
  if (type === 'folder') {
    return searchResolveFoldersByDriveIndex_(rootId, target);
  }
  return searchResolveFilesByDriveIndex_(rootId, target);
}

function searchResolveFilesByDriveIndex_(rootId, target) {
  var result = {
    matches: [],
    matchCount: 0,
    error: '',
    stoppedByLimit: false
  };
  if (!target) {
    result.error = 'Missing Resolve target.';
    return result;
  }
  try {
    var queryTarget = escapeDriveSearchText_(target);
    var query =
      "title = '" +
      queryTarget +
      "' and trashed = false";
    var files = DriveApp.searchFiles(query);
    while (
      files.hasNext() &&
      result.matches.length < RESOLVE_MAX_CANDIDATES_PER_ROW
    ) {
      var file = files.next();
      if (isDriveObjectUnderRoot_(file, rootId)) {
        result.matches.push({
          id: file.getId(),
          type: 'file',
          name: file.getName(),
          path: buildDriveObjectPath_(file, rootId),
          pathId: getResolveParentPathId_(file)
        });
      }
    }
    if (files.hasNext()) {
      result.stoppedByLimit = true;
    }
    result.matchCount = result.matches.length;
    return result;
  } catch (err) {
    result.error = err.toString();
    result.matchCount = result.matches.length;
    return result;
  }
}

function searchResolveFoldersByDriveIndex_(rootId, target) {
  var result = {
    matches: [],
    matchCount: 0,
    error: '',
    stoppedByLimit: false
  };
  if (!target) {
    result.error = 'Missing Resolve target.';
    return result;
  }
  try {
    var queryTarget = escapeDriveSearchText_(target);
    var query =
      "title = '" +
      queryTarget +
      "' and trashed = false";
    var folders = DriveApp.searchFolders(query);
    while (
      folders.hasNext() &&
      result.matches.length < RESOLVE_MAX_CANDIDATES_PER_ROW
    ) {
      var folder = folders.next();
      if (isDriveObjectUnderRoot_(folder, rootId)) {
        result.matches.push({
          id: folder.getId(),
          type: 'folder',
          name: folder.getName(),
          path: buildDriveObjectPath_(folder, rootId),
          pathId: folder.getId()
        });
      }
    }
    if (folders.hasNext()) {
      result.stoppedByLimit = true;
    }
    result.matchCount = result.matches.length;
    return result;
  } catch (err) {
    result.error = err.toString();
    result.matchCount = result.matches.length;
    return result;
  }
}

function buildResolveResultFromSearch_(objectTarget, searchResult, verifyContext) {
  var contextNote =
    verifyContext && verifyContext.note
      ? ' | ' + verifyContext.note
      : '';
  if (!objectTarget || !objectTarget.shouldSearch) {
    return buildResolveResult_(
      'SKIPPED',
      '',
      '',
      '',
      0,
      objectTarget ? objectTarget.method : '',
      '',
      objectTarget ? objectTarget.note : 'No Resolve target.'
    );
  }
  if (searchResult.error) {
    return buildResolveResult_(
      'ERROR',
      '',
      '',
      '',
      searchResult.matchCount || 0,
      objectTarget.method,
      '',
      searchResult.error + contextNote
    );
  }
  if (searchResult.matchCount === 0) {
    return buildResolveResult_(
      'NEEDS_HUMAN_INPUT',
      '',
      '',
      '',
      0,
      objectTarget.method,
      'Low',
      'Object not found by Drive index: ' +
        objectTarget.target +
        contextNote
    );
  }
  var firstMatch = searchResult.matches[0];
  if (searchResult.matchCount === 1) {
    return buildResolveResult_(
      'FOUND_SINGLE',
      firstMatch.id,
      firstMatch.type,
      firstMatch.path,
      1,
      objectTarget.method,
      'High',
      'Single candidate found by Drive index.' + contextNote,
      firstMatch.pathId || ''
    );
  }
  return buildResolveResult_(
    'FOUND_MULTIPLE',
    firstMatch.id,
    firstMatch.type,
    firstMatch.path,
    searchResult.matchCount,
    objectTarget.method,
    'Low',
    searchResult.matchCount +
      ' candidates found by Drive index. Manual review required.' +
      contextNote
  );
}

function isDriveObjectUnderRoot_(object, rootId) {
  if (!rootId) {
    return true;
  }
  if (object.getId && object.getId() === rootId) {
    return true;
  }
  var parents = object.getParents();
  while (parents.hasNext()) {
    var parent = parents.next();
    if (parent.getId() === rootId) {
      return true;
    }
    if (isDriveObjectUnderRoot_(parent, rootId)) {
      return true;
    }
  }
  return false;
}


function getResolveParentPathId_(object) {
  if (!object) {
    return '';
  }

  try {
    var parents = object.getParents();

    if (parents.hasNext()) {
      return parents.next().getId();
    }
  } catch (err) {}

  return '';
}

function buildDriveObjectPath_(object, rootId) {
  var names = [object.getName()];
  var current = object;
  while (true) {
    var parents = current.getParents();
    if (!parents.hasNext()) {
      break;
    }
    var parent = parents.next();
    names.unshift(parent.getName());
    if (parent.getId() === rootId) {
      break;
    }
    current = parent;
  }
  return names.join('\\');
}

function parseResolveColumnSpec_(text) {
  var result = [];
  if (!text) {
    return result;
  }
  var parts = text.split(',');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim().toUpperCase();
    if (!part) {
      continue;
    }
    if (part.indexOf('-') !== -1) {
      var rangeParts = part.split('-');
      var start = convertLetterToColumn(rangeParts[0].trim());
      var end = convertLetterToColumn(rangeParts[1].trim());
      if (start > 0 && end >= start) {
        for (var col = start; col <= end; col++) {
          if (result.indexOf(col) === -1) {
            result.push(col);
          }
        }
      }
    } else if (isValidColumnLetter_(part)) {
      var singleCol = convertLetterToColumn(part);
      if (result.indexOf(singleCol) === -1) {
        result.push(singleCol);
      }
    }
  }
  return result;
}

function parseStoredResolveColumns_(text) {
  if (!text) {
    return [];
  }
  return text
    .split(',')
    .map(function(value) {
      return parseInt(value, 10);
    })
    .filter(function(value) {
      return !isNaN(value) && value > 0;
    });
}

function buildResolveSearchCacheKey_(rootId, type, target) {
  return [
    rootId || '',
    type || '',
    target ? target.toString().toLowerCase() : ''
  ].join('|');
}

function isFailedVerifyRow_(existsValue, errorValue) {
  var existsText = existsValue
    ? existsValue.toString().trim().toUpperCase()
    : '';

  var hasError =
    errorValue !== '' &&
    errorValue !== null &&
    errorValue !== undefined;

  if (existsText === 'FALSE') {
    return true;
  }

  return existsText !== 'TRUE' && hasError;
}

function getResolveRowValue_(row, index) {
  if (
    index === null ||
    index === undefined ||
    index < 0
  ) {
    return '';
  }
  return row[index];
}

function buildResolveFileTarget_(fileValue, extValue) {
  var fileText = fileValue ? fileValue.toString().trim() : '';
  var extText = extValue ? extValue.toString().trim() : '';
  if (!fileText) {
    return '';
  }
  if (/\.[^\\\/.]+$/.test(fileText)) {
    return fileText;
  }
  if (extText) {
    return fileText + '.' + extText.replace(/^\./, '');
  }
  return fileText;
}

function extractLastSegmentFromPath_(pathValue) {
  var pathText = pathValue ? pathValue.toString().trim() : '';
  if (!pathText) {
    return '';
  }
  var parts = pathText
    .replace(/[\/]+/g, '\\')
    .replace(/[\\]+$/g, '')
    .split('\\');
  return parts.length ? parts[parts.length - 1].trim() : '';
}

function guessResolveObjectTypeFromName_(name) {
  if (/\.[^\\\/.]+$/.test(name)) {
    return 'file';
  }
  return 'folder';
}

function cleanResolveTarget_(value) {
  return value
    .toString()
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[\\\/]+$/g, '')
    .trim();
}

function escapeDriveSearchText_(value) {
  return value
    .toString()
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function buildResolveResult_(
  status,
  resolvedId,
  resolvedType,
  resolvedPath,
  matchCount,
  matchMethod,
  confidence,
  note,
  pathId
) {
  return {
    status: status || '',
    resolvedId: resolvedId || '',
    resolvedType: resolvedType || '',
    resolvedPath: resolvedPath || '',
    matchCount: matchCount || 0,
    matchMethod: matchMethod || '',
    confidence: confidence || '',
    note: note || '',
    pathId: pathId || ''
  };
}

function convertResolveResultToRow_(result) {
  return [
    result.status,
    result.resolvedId,
    result.resolvedType,
    result.resolvedPath,
    result.matchCount,
    result.matchMethod,
    result.confidence,
    result.note,
    result.pathId || ''
  ];
}

function TEST_SEARCH_RESOLVE_FILES_BY_DRIVE_INDEX() {
  var rootId = '1Sv48s_-d0R9pG-w02-gzbTeD7i39960f';
  var target =
    'Buy Sell Rent Bandung_Rangka Samping_445x145 cm_231221_.ai';
  var result =
    searchResolveFilesByDriveIndex_(
      rootId,
      target
    );
  Logger.log(JSON.stringify(result, null, 2));
}

function TEST_RESOLVE_SEARCH_RESULT_BUILD() {
  var rootId = '1Sv48s_-d0R9pG-w02-gzbTeD7i39960f';
  var objectTarget = {
    target: 'Buy Sell Rent Bandung_Rangka Samping_445x145 cm_231221_.ai',
    type: 'file',
    method: 'INPUT_FILE_TARGET',
    shouldSearch: true,
    note: ''
  };
  var verifyContext =
    extractResolveTargetFromError_(
      'Missing folder: Marketing Tool'
    );
  var searchResult =
    searchResolveFilesByDriveIndex_(
      rootId,
      objectTarget.target
    );
  var result =
    buildResolveResultFromSearch_(
      objectTarget,
      searchResult,
      verifyContext
    );
  Logger.log(JSON.stringify(result, null, 2));
}

function inspectResolvedObject_(objectId) {
  return inspectDriveObjectById_(objectId);
}
