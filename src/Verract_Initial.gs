/**
 * verract v0.1.2-beta
 * Design Files Management Build
 *
 * Release Focus:
 * - Output main-column safety check added
 * - Output non-blank warning dialog added
 * - Output column validation added
 * - Output/source overlap check added
 * - Output sheet-boundary check added
 * - Batch size min/max guard added
 * - Trigger gap min/max guard added
 * - Existing output skip behavior clarified
 *
 * Architecture:
 * - Still monolithic (pre-modularization phase)
 */
 
var ENGINE_STATE_KEY = 'IS_ENGINE_RUNNING';
var INPUT_WIDTH = 4;
var OUTPUT_WIDTH = 5;
var METADATA_KEYS = [
  'AUTO_CURRENT_ROW',
  'AUTO_END_ROW',
  'AUTO_SOURCE_COL',
  'AUTO_TARGET_COL',
  'AUTO_SPREADSHEET_ID',
  'AUTO_SHEET_NAME',
  'DYNAMIC_BATCH_SIZE',
  'AUTO_LAST_SUCCESS_TS',
  'AUTO_ENGINE_STARTED_AT'
];
var DEFAULT_BATCH_SIZE = 20;
var MIN_BATCH_SIZE = 1;
var MAX_BATCH_SIZE = 500;
var DEFAULT_TRIGGER_GAP_MINUTES = 5;
var MIN_TRIGGER_GAP_MINUTES = 5;
var MAX_TRIGGER_GAP_MINUTES = 60;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ System Tool')
    .addItem('📋 Inspect System Logs', 'CHECK_SYSTEM_DIAGNOSTICS')
    .addItem('👤 Stamp Active Account', 'WRITE_CURRENT_ACCOUNT_TO_CELL')
    .addSeparator()
    .addItem('⏰ Start RootID Resolver', 'CREATE_TIME_TRIGGER_MULTI')
    .addItem('🛑 Stop & Reset', 'MANUAL_CLEAR_TRIGGER_AND_STATE')
    .addToUi();
}

function CHECK_SYSTEM_DIAGNOSTICS() {
  var props = PropertiesService.getScriptProperties();
  checkEngineHeartbeat_();
  var isRunning = props.getProperty(ENGINE_STATE_KEY) === 'TRUE';
  var backoffUntil = parseInt(props.getProperty('AUTO_BACKOFF_UNTIL') || '0', 10);
  var now = Date.now();
  var statusReport = '🚥 Engine Status: ' + (isRunning ? 'ACTIVE' : 'IDLE') + '\n';
  if (backoffUntil > now) {
    var remainingMin = Math.ceil((backoffUntil - now) / (60 * 1000));
    statusReport += '⚠️ Backoff aktif: ' + remainingMin + ' menit\n';
  }
  var errorHistory = props.getProperty('AUTO_LAST_ERROR');
  var logContent = errorHistory
    ? errorHistory.substring(0, 3500)
    : 'Tidak ada catatan error.';
  SpreadsheetApp.getUi().alert(
    '📋 System Diagnostic Monitor',
    statusReport + '\n=== ERROR LOG ===\n' + logContent,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function WRITE_CURRENT_ACCOUNT_TO_CELL() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(ENGINE_STATE_KEY) === 'TRUE') {
    SpreadsheetApp.getActiveSpreadsheet().toast('Engine masih aktif.', 'LOCKED', 3);
    return;
  }
  var range = SpreadsheetApp.getActiveSheet().getActiveRange();
  if (!range) return;
  var email = '';
  try {
    email = Session.getActiveUser().getEmail();
    if (!email) {
      email = Session.getEffectiveUser().getEmail();
    }
  } catch (err) {}
  if (!email) {
    email = 'Unknown Account';
  }
  range.getCell(1, 1).setValue(email);
  SpreadsheetApp.getActiveSpreadsheet().toast('Akun dicetak ke cell.', 'SUCCESS', 3);
}

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

function resolveFromRootId_(rootId, relativePath, scriptCache) {
  try {
    rootId = rootId.toString().trim();
    relativePath = relativePath.toString().trim();
    var currentFolder = DriveApp.getFolderById(rootId);
    var segments = relativePath
      .split('\\')
      .filter(String);
    if (!segments.length) {
      return [false, '', '', rootId, 'Empty path'];
    }
    var parentId = rootId;
    for (var i = 0; i < segments.length - 1; i++) {
      var segment = segments[i];
      var segmentCacheKey = generateCacheKey_(
        'folder|' + parentId + '|' + segment
      );
      var cachedFolderId = scriptCache.get(segmentCacheKey);
      if (cachedFolderId) {
        try {
          currentFolder = DriveApp.getFolderById(cachedFolderId);
          parentId = cachedFolderId;
          continue;
        } catch (cacheErr) {
          scriptCache.remove(segmentCacheKey);
        }
      }
      var folders = currentFolder.getFoldersByName(segment);
      if (!folders.hasNext()) {
        return [
          false,
          '',
          '',
          currentFolder.getId(),
          'Missing folder: ' + segment
        ];
      }
      currentFolder = folders.next();
      parentId = currentFolder.getId();
      try {
        scriptCache.put(segmentCacheKey, parentId, 7200);
      } catch (cachePutErr) {}
    }
    var targetName = segments[segments.length - 1];
    var folderCheck = currentFolder.getFoldersByName(targetName);
    if (folderCheck.hasNext()) {
      var foundFolder = folderCheck.next();
      return [
        true,
        foundFolder.getId(),
        'folder',
        currentFolder.getId(),
        ''
      ];
    }
    var fileCheck = currentFolder.getFilesByName(targetName);
    if (fileCheck.hasNext()) {
      var foundFile = fileCheck.next();
      return [
        true,
        foundFile.getId(),
        'file',
        currentFolder.getId(),
        ''
      ];
    }
    return [
      false,
      '',
      '',
      currentFolder.getId(),
      'Target not found: ' + targetName
    ];
  } catch (err) {
    return [
      false,
      '',
      '',
      rootId || '',
      'Resolver error: ' + err.toString()
    ];
  }
}

function normalizePathForTraversal_(rawPath) {
  if (!rawPath) return '';
  return rawPath
    .trim()
    .replace(/^[a-zA-Z]:\\/i, '')
    .replace(/^my drive\\/i, '')
    .replace(/\//g, '\\')
    .replace(/\\+/g, '\\');
}

function handleRuntimeError_(err, props) {
  var errMsg = err.toString();
  var timestamp = new Date().toISOString();
  if (
    /too many/i.test(errMsg) ||
    /limit/i.test(errMsg) ||
    /exceeded/i.test(errMsg) ||
    /quota/i.test(errMsg)
  ) {
    var fifteenMinutes = 15 * 60 * 1000;
    props.setProperty(
      'AUTO_BACKOFF_UNTIL',
      (Date.now() + fifteenMinutes).toString()
    );
    errMsg = '[🚨 QUOTA BACKOFF ACTIVATED] ' + errMsg;
  }
  var currentLog = timestamp + ' | ' + errMsg;
  var previousLogs = props.getProperty('AUTO_LAST_ERROR') || '';
  props.setProperty(
    'AUTO_LAST_ERROR',
    (currentLog + '\n' + previousLogs).slice(0, 4500)
  );
  Logger.log('Runtime Exception Caught: ' + errMsg);
}

function checkEngineHeartbeat_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(ENGINE_STATE_KEY) !== 'TRUE') return;
  var startedAt = parseInt(props.getProperty('AUTO_ENGINE_STARTED_AT') || '0', 10);
  var lastSuccess = parseInt(props.getProperty('AUTO_LAST_SUCCESS_TS') || '0', 10);
  if (!startedAt || !lastSuccess) return;
  var now = Date.now();
  var sixtyMinutesInMs = 60 * 60 * 1000;
  if (
    now - startedAt > sixtyMinutesInMs &&
    now - lastSuccess > sixtyMinutesInMs
  ) {
    CLEAR_TRIGGER_AND_STATE();
    var zombieLog =
      new Date().toISOString() +
      ' | 💀 Watchdog Critical: Engine killed.';
    var oldLogs = props.getProperty('AUTO_LAST_ERROR') || '';
    props.setProperty(
      'AUTO_LAST_ERROR',
      (zombieLog + '\n' + oldLogs).slice(0, 4500)
    );
  }
}

function CLEAR_TRIGGER_AND_STATE() {
  deleteExistingTriggers_();
  var props = PropertiesService.getScriptProperties();
  props.setProperty(ENGINE_STATE_KEY, 'FALSE');
  METADATA_KEYS.forEach(function(key) {
    props.deleteProperty(key);
  });
}

function MANUAL_CLEAR_TRIGGER_AND_STATE() {
  CLEAR_TRIGGER_AND_STATE();
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('AUTO_LAST_ERROR');
  props.deleteProperty('AUTO_BACKOFF_UNTIL');
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Otomatisasi dihentikan & state dibersihkan.',
    'STOPPED',
    5
  );
}

function confirmNonBlankMainOutput_(sheet, startRow, targetColumn, numRows) {
  var values = sheet
    .getRange(startRow, targetColumn, numRows, 1)
    .getValues();
  var nonBlankCount = 0;
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] !== '') {
      nonBlankCount++;
    }
  }
  if (nonBlankCount === 0) {
    return true;
  }
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    '⚠️ Output Already Exists',
    'Ditemukan ' +
      nonBlankCount +
      ' row pada kolom output utama yang sudah berisi data.\n' +
      'Row tersebut akan dilewati (skip) oleh sistem.\n\n' +
      'Klik OK untuk lanjut.\n' +
      'Klik Cancel untuk membatalkan proses.',
    ui.ButtonSet.OK_CANCEL
  );
  return response === ui.Button.OK;
}

function generateCacheKey_(value) {
  var rawDigest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    value,
    Utilities.Charset.UTF_8
  );
  var hash = '';
  for (var i = 0; i < rawDigest.length; i++) {
    var byteVal = rawDigest[i];
    if (byteVal < 0) {
      byteVal += 256;
    }
    var byteString = byteVal.toString(16);
    if (byteString.length === 1) {
      byteString = '0' + byteString;
    }
    hash += byteString;
  }
  return 'md5_' + hash;
}

function deleteExistingTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn && fn.indexOf('TRIGGER_BATCH_') === 0) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function convertLetterToColumn(letter) {
  var column = 0;
  for (var i = 0; i < letter.length; i++) {
    column = column * 26 + letter.charCodeAt(i) - 64;
  }
  return column;
}

function isValidColumnLetter_(value) {
  return /^[A-Z]+$/.test(value);
}

function confirmOutputDoesNotOverlapSource_(sourceColumn, inputWidth, targetColumn, outputWidth) {
  var sourceStart = sourceColumn;
  var sourceEnd = sourceColumn + inputWidth - 1;

  var outputStart = targetColumn;
  var outputEnd = targetColumn + outputWidth - 1;

  var isOverlapping = outputStart <= sourceEnd && outputEnd >= sourceStart;

  if (!isOverlapping) {
    return true;
  }
  SpreadsheetApp.getUi().alert(
    '⚠️ Output Overlaps Source',
    'Kolom output bertabrakan dengan kolom input.\n' +
      'Source range: kolom ' + sourceStart + ' sampai ' + sourceEnd + '\n' +
      'Output range: kolom ' + outputStart + ' sampai ' + outputEnd + '\n\n' +
      'Pilih kolom output lain agar data input tidak tertimpa.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return false;
}

function confirmOutputWithinSheetBoundary_(sheet, targetColumn, outputWidth) {
  var maxColumns = sheet.getMaxColumns();
  var outputEndColumn = targetColumn + outputWidth - 1;
  if (outputEndColumn <= maxColumns) {
    return true;
  }
  SpreadsheetApp.getUi().alert(
    '⚠️ Output Exceeds Sheet Boundary',
    'Output membutuhkan kolom sampai ' +
      outputEndColumn +
      ', sedangkan sheet hanya memiliki ' +
      maxColumns +
      ' kolom.\n\n' +
      'Tambahkan kolom terlebih dahulu atau pilih kolom output yang lebih awal.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return false;
}
