var VERRACT_NAME = 'verract';
var VERRACT_VERSION = '0.9.0';
var VERRACT_BUILD = 'Row Chain Orchestration';
var VERRACT_AUTHOR = 'blackdjurix';
var VERRACT_FEATURE = 'Per-row Verify, Resolve, and Action chain orchestration';

function SHOW_VERSION_INFO() {
  SpreadsheetApp.getUi().alert(
    VERRACT_NAME + ' ' + VERRACT_VERSION + '\n' +
    VERRACT_BUILD + '\n' +
    VERRACT_FEATURE
  );
}
