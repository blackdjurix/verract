function deleteExistingTriggers_() {
  var triggers =
    ScriptApp.getProjectTriggers();
  var allowedHandlers = [
    'TRIGGER_BATCH_AUDIT_MULTI',
    'TRIGGER_RESOLVE_BATCH_MULTI'
  ];
  for (
    var i = 0;
    i < triggers.length;
    i++
  ) {
    var handlerFunction =
      triggers[i].getHandlerFunction();
    if (
      allowedHandlers.indexOf(
        handlerFunction
      ) !== -1
    ) {
      ScriptApp.deleteTrigger(
        triggers[i]
      );
    }
  }
}