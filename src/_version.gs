var VERRACT_VERSION_INFO = {
  name: 'verract', version: '0.4.0', build: 'Design Files Management Build', author: 'blackdjurix',
  feature: 'Revised Action Foundation',
  highlights: [
    'Reframes files and folders as generic Drive objects',
    'Uses path-driven planning with live ID-based source validation',
    'Derives target parent path and target object name from Target Path',
    'Plans missing target-parent creation without mutating Drive',
    'Detects already-at-target and target-object conflict conditions',
    'Adds MOVE_OBJECT and MOVE_RENAME_OBJECT planning',
    'Adds source-parent cleanup candidate planning',
    'Keeps all Action behavior dry-run only for safe testing'
  ]
};
function SHOW_VERSION_INFO() {
  var info = VERRACT_VERSION_INFO;
  var message = info.name + ' v' + info.version + '\n' + info.build + '\nAuthor: ' + info.author +
    '\n\nFeature:\n' + info.feature + '\n\nHighlights:\n- ' + info.highlights.join('\n- ');
  SpreadsheetApp.getUi().alert('About ' + info.name, message, SpreadsheetApp.getUi().ButtonSet.OK);
}
