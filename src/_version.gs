var VERRACT_VERSION_INFO = {
  name: 'verract',
  version: '0.3.0-beta',
  build: 'Design Files Management Build',
  author: 'blackdjurix',
  feature: 'Resolve Batch Candidate Discovery'
  highlights: [
    'Introduces Resolve phase foundation',
    'Supports Verify error interpretation',
    'Supports object target extraction',
    'Supports Drive index candidate discovery',
    'Supports RootID-scoped candidate filtering',
    'Supports Resolve batch processing',
    'Supports Resolve result generation',
    'Supports candidate discovery workflow'
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