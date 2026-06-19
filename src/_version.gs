var VERRACT_VERSION_INFO = {
name: 'verract',
version: '0.3.4',
build: 'Design Files Management Build',
author: 'blackdjurix',
feature: 'Shared Output & HTML Workflow',
highlights: [
'Introduces shared output mapping for Verify and Resolve',
'Supports PathID, FileID, Path, Filename, and Source outputs',
'Adds persistent selection workflow',
'Adds Set Selection and Clear Selection controls',
'Adds direct Verify and Resolve page navigation',
'Synchronizes shared output mapping across Verify and Resolve',
'Prevents blank shared values from overwriting existing data',
'Improves sidebar workflow and status synchronization',
'Normalizes column mapping inputs to uppercase',
'Removes dependency on fallback HTML output columns'
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
