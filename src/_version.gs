var VERRACT_VERSION_INFO = {
  name: 'verract',
  version: '0.5.0',
  build: 'Design Files Management Build',
  author: 'blackdjurix',
  feature: 'Multi-Phase Dry-Run Orchestration',
  highlights: [
    'Adds Verify to Resolve to Action Preview orchestration',
    'Uses verified object IDs first and resolved object IDs as fallback',
    'Adds dedicated Multi-Phase sidebar workflow and pipeline outputs',
    'Keeps Verify-only, Resolve-only, and Action Preview-only modes available',
    'Adds linked phase settings across standalone and Multi-Phase views',
    'Adds column mapping remap with preview and undo support',
    'Improves engine running state, button locking, and Stop and Reset handling',
    'Handles verified, resolved, already-at-target, unresolved, and human-input outcomes',
    'Keeps all Drive operations dry-run only with no Drive mutation'
  ]
};

function SHOW_VERSION_INFO() {
  var info = VERRACT_VERSION_INFO;
  var message =
    info.name + ' v' + info.version + '\n' +
    info.build + '\n' +
    'Author: ' + info.author +
    '\n\nFeature:\n' + info.feature +
    '\n\nHighlights:\n- ' + info.highlights.join('\n- ');

  SpreadsheetApp.getUi().alert(
    'About ' + info.name,
    message,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
