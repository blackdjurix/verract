var VERRACT_NAME = 'verract';
var VERRACT_VERSION = '0.8.0';
var VERRACT_BUILD = 'Verify Resolve Action Foundation';
var VERRACT_AUTHOR = 'blackdjurix';
var VERRACT_FEATURE = 'Folder path MOVE action contract';

function SHOW_VERSION_INFO() {
  SpreadsheetApp.getUi().alert(
    VERRACT_NAME + ' ' + VERRACT_VERSION + '\n' +
    VERRACT_BUILD + '\n' +
    VERRACT_FEATURE
  );
}
