function CREATE_TIME_TRIGGER_MULTI() {
  var lock = LockService.getScriptLock();
  var lockReleased = false;
  if (!lock.tryLock(2000)) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Server sedang sibuk.', 'LOCKED', 3);
    return;
  }
  try {
    var props = PropertiesService.getScriptProperties();
    checkEngineHeartbeat_();
    if (props.getProperty(ENGINE_STATE_KEY) === 'TRUE') {
      SpreadsheetApp.getActiveSpreadsheet().toast('Automation masih aktif.', 'LOCKED', 5);
      return;
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var range = sheet.getActiveRange();
    if (!range) {
      SpreadsheetApp.getUi().alert('Pilih range input dulu.');
      return;
    }
    if (range.getNumColumns() < INPUT_WIDTH) {
      SpreadsheetApp.getUi().alert(
        'Range input harus minimal 4 kolom:\nOwner | RootName | RootID | Path'
      );
      return;
    }
    var ui = SpreadsheetApp.getUi();
    var targetColumnPrompt = ui.prompt(
      'Kolom Output',
      'Masukkan huruf kolom awal output.\nOutput: Exists | TargetID | TargetType | ParentID | Error',
      ui.ButtonSet.OK_CANCEL
    );
    if (targetColumnPrompt.getSelectedButton() !== ui.Button.OK) return;
    var targetColumnText = targetColumnPrompt
      .getResponseText()
      .trim()
      .toUpperCase();
    if (!isValidColumnLetter_(targetColumnText)) {
      ui.alert(
        'Invalid Output Column',
        'Masukkan huruf kolom saja.\n\nContoh valid: E, AA, AB\nContoh tidak valid: 1, A1, @@, kosong',
        ui.ButtonSet.OK
      );
      return;
    }
    var targetColumn = convertLetterToColumn(targetColumnText);
    var withinBoundary = confirmOutputWithinSheetBoundary_(
      sheet,
      targetColumn,
      OUTPUT_WIDTH
    );
    if (!withinBoundary) {
      ss.toast(
        'Proses dibatalkan: output melebihi batas sheet.',
        'CANCELLED',
        5
      );
    return;
    }
    var sourceColumn = range.getColumn();
    var noOverlap = confirmOutputDoesNotOverlapSource_(
      sourceColumn,
      INPUT_WIDTH,
      targetColumn,
      OUTPUT_WIDTH
    );
    if (!noOverlap) {
      ss.toast('Proses dibatalkan: output bertabrakan dengan source.', 'CANCELLED', 5);
      return;
    }
    var canContinue = confirmNonBlankMainOutput_(
      sheet,
      range.getRow(),
      targetColumn,
      range.getNumRows()
    );
    if (!canContinue) {
      ss.toast('Proses dibatalkan oleh user.', 'CANCELLED', 5);
      return;
    }
    var batchPrompt = ui.prompt(
      'Batch Size',
      'Masukkan jumlah row per batch:',
      ui.ButtonSet.OK_CANCEL
    );
    if (batchPrompt.getSelectedButton() !== ui.Button.OK) return;
    var batchSize = parseInt(batchPrompt.getResponseText(), 10);
    if (isNaN(batchSize) || batchSize < MIN_BATCH_SIZE) {
      batchSize = DEFAULT_BATCH_SIZE;
    }
    if (batchSize > MAX_BATCH_SIZE) {
      ui.alert(
        '⚠️ Batch Size Too Large',
        'Batch size maksimal adalah ' +
          MAX_BATCH_SIZE +
          ' rows.\n' +
          'Masukkan angka yang lebih kecil, atau ubah MAX_BATCH_SIZE di config jika sedang melakukan stress test.',
        ui.ButtonSet.OK
      );
      return;
    }
   var gapPrompt = ui.prompt(
      'Interval Menit',
      'Minimal 5 menit:',
      ui.ButtonSet.OK_CANCEL
    );
    if (gapPrompt.getSelectedButton() !== ui.Button.OK) return;
    var gap = parseInt(gapPrompt.getResponseText(), 10);
    if (isNaN(gap) || gap < MIN_TRIGGER_GAP_MINUTES) {
      gap = DEFAULT_TRIGGER_GAP_MINUTES;
    }
    if (gap > MAX_TRIGGER_GAP_MINUTES) {
      ui.alert(
        '⚠️ Interval Too Large',
        'Interval maksimal adalah ' +
          MAX_TRIGGER_GAP_MINUTES +
          ' menit.\n\n' +
          'Masukkan interval yang lebih kecil agar automation tetap mudah dipantau.',
        ui.ButtonSet.OK
      );
      return;
    }
    deleteExistingTriggers_();
    props.deleteProperty('AUTO_LAST_ERROR');
    props.deleteProperty('AUTO_BACKOFF_UNTIL');
    try {
      var timestampNow = Date.now().toString();
      var startRow = range.getRow();
      var endRow = startRow + range.getNumRows() - 1;
      var spreadsheetId = ss.getId();
      var sheetName = sheet.getName();
      var stateMap = {
        IS_ENGINE_RUNNING: 'TRUE',
        AUTO_CURRENT_ROW: startRow.toString(),
        AUTO_END_ROW: endRow.toString(),
        AUTO_SOURCE_COL: sourceColumn.toString(),
        AUTO_TARGET_COL: targetColumn.toString(),
        AUTO_SPREADSHEET_ID: spreadsheetId,
        AUTO_SHEET_NAME: sheetName,
        DYNAMIC_BATCH_SIZE: batchSize.toString(),
        AUTO_ENGINE_STARTED_AT: timestampNow,
        AUTO_LAST_SUCCESS_TS: timestampNow
      };
      Object.keys(stateMap).forEach(function(key) {
        props.setProperty(key, stateMap[key]);
      });
    } catch (stateErr) {
      Logger.log('STATE WRITE ERROR: ' + stateErr.toString());
      throw stateErr;
    }
    ScriptApp.newTrigger('TRIGGER_BATCH_AUDIT_MULTI')
      .timeBased()
      .everyMinutes(gap)
      .create();
    lock.releaseLock();
    lockReleased = true;
    TRIGGER_BATCH_AUDIT_MULTI();
    ss.toast('Batch pertama langsung jalan. Batch berikutnya sesuai interval.', 'SUCCESS', 5);
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
  if (!lock.tryLock(500)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var now = Date.now();
    var backoffUntil = parseInt(props.getProperty('AUTO_BACKOFF_UNTIL') || '0', 10);
    if (now < backoffUntil) {
      return;
    }
    if (props.getProperty(ENGINE_STATE_KEY) !== 'TRUE') return;
    var spreadsheetId = props.getProperty('AUTO_SPREADSHEET_ID');
    var sheetName = props.getProperty('AUTO_SHEET_NAME');
    if (!spreadsheetId || !sheetName) return;
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var currentRow = parseInt(props.getProperty('AUTO_CURRENT_ROW'), 10);
    var endRow = parseInt(props.getProperty('AUTO_END_ROW'), 10);
    var sourceColumn = parseInt(props.getProperty('AUTO_SOURCE_COL'), 10);
    var targetColumn = parseInt(props.getProperty('AUTO_TARGET_COL'), 10);
    var batchSize = parseInt(props.getProperty('DYNAMIC_BATCH_SIZE'), 10);
    if (isNaN(currentRow) || isNaN(endRow) || isNaN(sourceColumn) || isNaN(targetColumn)) {
      throw new Error('Invalid engine state: row/column metadata is corrupted.');
    }
    if (isNaN(batchSize) || batchSize < MIN_BATCH_SIZE) {
      batchSize = DEFAULT_BATCH_SIZE;
    }
    if (currentRow > endRow) {
      CLEAR_TRIGGER_AND_STATE();
      return;
    }
    var rowsToProcess = Math.min(batchSize, endRow - currentRow + 1);
    var inputValues = sheet
      .getRange(currentRow, sourceColumn, rowsToProcess, INPUT_WIDTH)
      .getValues();
    var existingOutput = sheet
      .getRange(currentRow, targetColumn, rowsToProcess, OUTPUT_WIDTH)
      .getValues();
    var output = [];
    var localMemoryCache = {};
    var scriptCache = CacheService.getScriptCache();
    for (var i = 0; i < inputValues.length; i++) {
      var rootId = inputValues[i][2];
      var path = inputValues[i][3];
      if (existingOutput[i][0] !== '') {
        output.push(existingOutput[i]);
        continue;
      }
      if (!rootId || !path) {
        output.push([
          false,
          '',
          '',
          rootId || '',
          'Missing RootID or Path'
        ]);
        continue;
      }
      var cleanPath = normalizePathForTraversal_(path.toString());
      var cleanRootId = rootId.toString().trim();
      var cacheKey = generateCacheKey_(cleanRootId + '|' + cleanPath);
      if (localMemoryCache.hasOwnProperty(cacheKey)) {
        output.push(localMemoryCache[cacheKey]);
        continue;
      }
      var cachedResult = scriptCache.get(cacheKey);
      if (cachedResult !== null) {
        try {
          var parsed = JSON.parse(cachedResult);
          localMemoryCache[cacheKey] = parsed;
          output.push(parsed);
          continue;
        } catch (parseErr) {
          scriptCache.remove(cacheKey);
        }
      }
      var result = resolveFromRootId_(cleanRootId, cleanPath, scriptCache);
      localMemoryCache[cacheKey] = result;
      try {
        scriptCache.put(cacheKey, JSON.stringify(result), 7200);
      } catch (cacheErr) {}
      output.push(result);
    }
    sheet
      .getRange(currentRow, targetColumn, rowsToProcess, OUTPUT_WIDTH)
      .setValues(output);
    var nextRow = currentRow + rowsToProcess;
    props.setProperty('AUTO_CURRENT_ROW', nextRow.toString());
    props.setProperty('AUTO_LAST_SUCCESS_TS', Date.now().toString());
    if (nextRow > endRow) {
      CLEAR_TRIGGER_AND_STATE();
    }
  } catch (err) {
    handleRuntimeError_(err, props);
  } finally {
    lock.releaseLock();
  }
}