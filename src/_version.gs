var VERRACT_VERSION_INFO = {
  name: 'verract',
  version: '0.2.2-beta',
  build: 'Design Files Management Build',
  author: 'blackdjurix',
  feature: 'Flexible Verify Input Reference Parser',
  highlights: [
    'Supports dynamic path-column selection',
    'Supports non-contiguous columns and column ranges',
    'Supports path + file.ext input',
    'Supports full path\\file.ext input',
    'Supports optional path + file + ext input',
    'Verifies filename against multiple candidate paths',
    'Skips duplicate normalized paths per row',
    'Stops at the first valid file match',
    'Adds workload protection for batch execution'
  ]
};

function SHOW_VERSION_INFO() {
  var info = VERRACT_VERSION_INFO;
  var message =
    info.name +
    ' v' +
    info.version +
    '\n' +
    info.build +
    '\n' +
    'Author: ' +
    info.author +
    '\n\n' +
    'Feature:\n' +
    info.feature +
    '\n\n' +
    'Highlights:\n- ' +
    info.highlights.join('\n- ');
  SpreadsheetApp.getUi().alert(
    'About ' + info.name,
    message,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}