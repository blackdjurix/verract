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
    errMsg =
      '[🚨 QUOTA BACKOFF ACTIVATED] ' +
      errMsg;
  }
  var currentLog =
    timestamp + ' | ' + errMsg;
  var previousLogs =
    props.getProperty(
      'AUTO_LAST_ERROR'
    ) || '';
  props.setProperty(
    'AUTO_LAST_ERROR',
    (
      currentLog +
      '\n' +
      previousLogs
    ).slice(0, 4500)
  );
  Logger.log(
    'Runtime Exception Caught: ' +
      errMsg
  );
}

function checkEngineHeartbeat_() {
  var props =
    PropertiesService.getScriptProperties();
  if (
    props.getProperty(
      ENGINE_STATE_KEY
    ) !== 'TRUE'
  ) {
    return;
  }
  var startedAt = parseInt(
    props.getProperty(
      'AUTO_ENGINE_STARTED_AT'
    ) || '0',
    10
  );
  var lastSuccess = parseInt(
    props.getProperty(
      'AUTO_LAST_SUCCESS_TS'
    ) || '0',
    10
  );
  if (
    !startedAt ||
    !lastSuccess
  ) {
    return;
  }
  var now = Date.now();
  var sixtyMinutesInMs =
    60 * 60 * 1000;
  if (
    now - startedAt >
      sixtyMinutesInMs &&
    now - lastSuccess >
      sixtyMinutesInMs
  ) {
    CLEAR_TRIGGER_AND_STATE();
    var zombieLog =
      new Date().toISOString() +
      ' | 💀 Watchdog Critical: Engine killed.';
    var oldLogs =
      props.getProperty(
        'AUTO_LAST_ERROR'
      ) || '';
    props.setProperty(
      'AUTO_LAST_ERROR',
      (
        zombieLog +
        '\n' +
        oldLogs
      ).slice(0, 4500)
    );
  }
}

function CLEAR_TRIGGER_AND_STATE() {
  deleteExistingTriggers_();
  var props =
    PropertiesService.getScriptProperties();
  props.setProperty(
    ENGINE_STATE_KEY,
    'FALSE'
  );
  METADATA_KEYS.forEach(function(
    key
  ) {
    props.deleteProperty(key);
  });
  RESOLVE_METADATA_KEYS.forEach(
    function(key) {
      props.deleteProperty(key);
    }
  );
  if (typeof ACTION_METADATA_KEYS !== 'undefined') {
    ACTION_METADATA_KEYS.forEach(function(key) { props.deleteProperty(key); });
  }
  if (typeof PIPELINE_METADATA_KEYS !== 'undefined') {
    PIPELINE_METADATA_KEYS.forEach(function(key) { props.deleteProperty(key); });
  }
  props.deleteProperty(
    'AUTO_BACKOFF_UNTIL'
  );
}

function MANUAL_CLEAR_TRIGGER_AND_STATE() {
  CLEAR_TRIGGER_AND_STATE();
  var props =
    PropertiesService.getScriptProperties();
  props.deleteProperty(
    'AUTO_LAST_ERROR'
  );
  props.deleteProperty(
    'AUTO_BACKOFF_UNTIL'
  );
  SpreadsheetApp
    .getActiveSpreadsheet()
    .toast(
      'Otomatisasi dihentikan & state dibersihkan.',
      'STOPPED',
      5
    );
}