var VERRACT_VERSION_INFO = {
  name: 'verract',
  version: '0.3.2',
  build: 'Design Files Management Build',
  author: 'blackdjurix',
  feature: 'HTML Control Panel & Verification Refactor',
  highlights: [
    'Introduces an HTML sidebar control panel',
    'Adds Verify and Resolve workflow views',
    'Supports selected-range snapshots from the sidebar',
    'Adds Refresh Selection support for Verify and Resolve',
    'Runs Verify and Resolve from sidebar configuration forms',
    'Refactors Verify output into a path-aware result model',
    'Introduces Type and PathID semantics',
    'Improves path-found but file-missing reporting',
    'Keeps legacy prompt workflows available during transition'
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