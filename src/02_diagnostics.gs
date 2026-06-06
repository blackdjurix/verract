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
