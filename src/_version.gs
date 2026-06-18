var VERRACT_VERSION_INFO = {
  name: 'verract',
  version: '0.3.3',
  build: 'Design Files Management Build',
  author: 'blackdjurix',
  feature: 'Custom Output Mapping',
  highlights: [
    'Adds custom output mapping for Verify',
    'Adds custom output mapping for Resolve',
    'Supports per-field output selection',
    'Supports non-contiguous output columns',
    'Remembers last-used output mappings',
    'Adds Select All and Clear All controls',
    'Prevents duplicate output column assignments',
    'Validates required output columns before execution'
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