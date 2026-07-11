function isBlank_(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function asText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function columnToLetter_(column) {
  var temp = '';
  var letter = '';
  var col = Number(column);

  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = Math.floor((col - temp - 1) / 26);
  }

  return letter;
}

function letterToColumn_(letter) {
  var text = asText_(letter).toUpperCase();
  if (!/^[A-Z]+$/.test(text)) {
    throw new Error('Invalid column letter: ' + letter);
  }

  var column = 0;
  for (var i = 0; i < text.length; i++) {
    column = column * 26 + text.charCodeAt(i) - 64;
  }

  return column;
}

function parseColumnSpec_(spec) {
  var text = asText_(spec).toUpperCase();
  if (!text) return [];

  var parts = text.split(',');
  var columns = [];

  parts.forEach(function(part) {
    var item = part.trim();
    if (!item) return;

    if (item.indexOf(':') >= 0) {
      var range = item.split(':');
      if (range.length !== 2) {
        throw new Error('Invalid column range: ' + item);
      }
      var start = letterToColumn_(range[0]);
      var end = letterToColumn_(range[1]);
      var step = start <= end ? 1 : -1;
      for (var col = start; step > 0 ? col <= end : col >= end; col += step) {
        columns.push(col);
      }
    } else {
      columns.push(letterToColumn_(item));
    }
  });

  return columns;
}

function buildColumnMapping_(mappingInput, fields) {
  var mapping = {};
  var source = mappingInput || {};

  fields.forEach(function(field) {
    var letter = asText_(source[field]);
    if (letter) {
      mapping[field] = letterToColumn_(letter);
    }
  });

  return mapping;
}

function ensureMappingFields_(mapping, fields, groupName) {
  fields.forEach(function(field) {
    if (!mapping[field]) {
      throw new Error(groupName + ' missing required field mapping: ' + field);
    }
  });
}

function mergeFilename_(filename, extension) {
  var name = asText_(filename);
  var ext = asText_(extension);

  if (!name) return '';
  if (!ext) return name;

  if (ext.charAt(0) !== '.') {
    ext = '.' + ext;
  }

  if (name.toLowerCase().slice(-ext.length) === ext.toLowerCase()) {
    return name;
  }

  return name + ext;
}

function splitPathSegments_(path) {
  return asText_(path)
    .replace(/\\+/g, '\\')
    .split('\\')
    .map(function(segment) { return segment.trim(); })
    .filter(function(segment) { return !!segment; });
}

function getRowValues_(sheet, row, lastColumn) {
  return sheet.getRange(row, 1, 1, lastColumn).getValues()[0];
}

function getCellFromRow_(rowValues, column) {
  if (!column) return '';
  return rowValues[column - 1];
}

function writeMappedObject_(sheet, row, mapping, object) {
  Object.keys(mapping || {}).forEach(function(field) {
    sheet.getRange(row, mapping[field]).setValue(
      object[field] === undefined || object[field] === null ? '' : object[field]
    );
  });
}

function readMappedObject_(rowValues, mapping) {
  var object = {};
  Object.keys(mapping || {}).forEach(function(field) {
    object[field] = getCellFromRow_(rowValues, mapping[field]);
  });
  return object;
}

function nowIso_() {
  return new Date().toISOString();
}

function nowTraceTimestamp_() {
  var now = new Date();
  var timestamp = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyMMdd'T'HHmmss"
  );
  return timestamp + ('000' + now.getMilliseconds()).slice(-3);
}

function createTraceRunPrefix_() {
  var now = new Date();
  var timestamp = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyyyMMdd'T'HHmmss"
  );
  return timestamp + ('000' + now.getMilliseconds()).slice(-3);
}

function formatTraceBatchRunId_(prefix, sequence) {
  var number = Number(sequence || 1);
  var suffix = ('000' + number).slice(-3);
  return prefix + '-' + suffix;
}

function createRunId_(prefix) {
  return prefix + '_' + Utilities.getUuid();
}
