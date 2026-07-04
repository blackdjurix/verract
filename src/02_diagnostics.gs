function CHECK_SYSTEM_DIAGNOSTICS() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var triggers = ScriptApp.getProjectTriggers().map(function(trigger) {
    return trigger.getHandlerFunction();
  });

  Logger.log('verract diagnostics');
  Logger.log(JSON.stringify({
    properties: props,
    triggers: triggers
  }, null, 2));

  SpreadsheetApp.getUi().alert('Diagnostics written to Apps Script logs.');
}

function WRITE_CURRENT_ACCOUNT_TO_CELL() {
  var email = Session.getActiveUser().getEmail() || 'unknown';
  SpreadsheetApp.getActiveRange().setValue(email);
}
