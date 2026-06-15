var VERRACT_VERSION_INFO = {
  name: 'verract',
  version: '0.3.1-beta',
  build: 'Design Files Management Build',
  author: 'blackdjurix',
  feature: 'Verify Recheck & Resolve Hold',
  highlights: [
    'Supports rechecking failed Verify rows',
    'Skips already verified TRUE rows',
    'Allows FALSE Verify rows to be overwritten on rerun',
    'Holds Resolve output when Verify result is still blank',
    'Prevents Resolve from marking unverified rows as skipped',
    'Improves Verify and Resolve rerun workflow',
    'Keeps Resolve candidate discovery read-only'
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