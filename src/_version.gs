var VERRACT_VERSION_INFO = {
  name: 'verract',
  version: '0.3.0-beta',
  build: 'Design Files Management Build',
  author: 'blackdjurix',
  feature: 'Resolve Foundation',
highlights: [
  'Introduces Resolve phase foundation',
  'Adds Resolve configuration and state management',
  'Supports Verify error interpretation',
  'Supports object target extraction',
  'Introduces Drive index candidate discovery',
  'Supports Resolve result generation',
  'Validates candidate lookup workflow',
  'Prepares Resolve batch processing engine'
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