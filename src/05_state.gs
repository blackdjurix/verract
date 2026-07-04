function setVerractState_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

function getVerractState_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function deleteVerractState_(key) {
  PropertiesService.getScriptProperties().deleteProperty(key);
}

function setVerractConfigState_(config) {
  setVerractState_(VERRACT_STATE_KEYS.CONFIG, JSON.stringify(config || {}));
}

function getVerractConfigState_() {
  var raw = getVerractState_(VERRACT_STATE_KEYS.CONFIG);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function initializeVerractRunState_(config) {
  clearVerractTriggerHandler_('TRIGGER_BATCH_AUDIT_MULTI');

  setVerractConfigState_(config);
  setVerractState_(VERRACT_STATE_KEYS.ACTIVE_PHASE, config.phase);
  setVerractState_(VERRACT_STATE_KEYS.CURRENT_ROW, config.rowRanges[0].startRow);
  setVerractState_(VERRACT_STATE_KEYS.RANGE_INDEX, 0);
  setVerractState_(VERRACT_STATE_KEYS.END_ROW, config.endRow);
  setVerractState_(VERRACT_STATE_KEYS.RUN_ID, config.runId);
  setVerractState_(VERRACT_STATE_KEYS.STARTED_AT, new Date().toISOString());
  setVerractState_(VERRACT_STATE_KEYS.LAST_STATUS, 'RUNNING');
}

function isVerractRunActive_(phase, runId) {
  return getVerractState_(VERRACT_STATE_KEYS.ACTIVE_PHASE) === phase &&
    getVerractState_(VERRACT_STATE_KEYS.RUN_ID) === runId;
}

function completeVerractRun_(phase, runId) {
  if (!isVerractRunActive_(phase, runId)) return;

  clearVerractTriggerHandler_('TRIGGER_BATCH_AUDIT_MULTI');
  deleteVerractState_(VERRACT_STATE_KEYS.ACTIVE_PHASE);
  deleteVerractState_(VERRACT_STATE_KEYS.CURRENT_ROW);
  deleteVerractState_(VERRACT_STATE_KEYS.RANGE_INDEX);
  deleteVerractState_(VERRACT_STATE_KEYS.CONFIG);
  setVerractState_(VERRACT_STATE_KEYS.LAST_STATUS, 'COMPLETED');
}

function clearVerractTriggerHandler_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function scheduleVerractContinuation_(handlerName, delayMs) {
  clearVerractTriggerHandler_(handlerName);

  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .after(Math.max(1, Number(delayMs) || 1))
    .create();
}

function clearVerractState_() {
  var props = PropertiesService.getScriptProperties();
  Object.keys(VERRACT_STATE_KEYS).forEach(function(key) {
    props.deleteProperty(VERRACT_STATE_KEYS[key]);
  });
}

function clearVerractTriggers_() {
  var handlers = {
    TRIGGER_BATCH_AUDIT_MULTI: true,
    TRIGGER_RESOLVE_BATCH_MULTI: true,
    TRIGGER_ACTION_BATCH_MULTI: true
  };

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers[trigger.getHandlerFunction()]) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function CLEAR_TRIGGER_AND_STATE() {
  clearVerractTriggers_();
  clearVerractState_();
}

function MANUAL_CLEAR_TRIGGER_AND_STATE() {
  CLEAR_TRIGGER_AND_STATE();
  SpreadsheetApp.getUi().alert('verract state and triggers cleared.');
}
