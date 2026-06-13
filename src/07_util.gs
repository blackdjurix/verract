function generateCacheKey_(value) {
  var rawDigest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    value,
    Utilities.Charset.UTF_8
  );
  var hash = '';
  for (
    var i = 0;
    i < rawDigest.length;
    i++
  ) {
    var byteValue = rawDigest[i];
    if (byteValue < 0) {
      byteValue += 256;
    }
    var byteString =
      byteValue.toString(16);
    if (byteString.length === 1) {
      byteString =
        '0' + byteString;
    }
    hash += byteString;
  }
  return 'md5_' + hash;
}

function deleteExistingTriggers_() {
  var triggers =
    ScriptApp.getProjectTriggers();
  var allowedHandlers = [
    'TRIGGER_BATCH_AUDIT_MULTI',
    'TRIGGER_RESOLVE_BATCH_MULTI'
  ];
  for (
    var i = 0;
    i < triggers.length;
    i++
  ) {
    var handlerFunction =
      triggers[i].getHandlerFunction();
    if (
      allowedHandlers.indexOf(
        handlerFunction
      ) !== -1
    ) {
      ScriptApp.deleteTrigger(
        triggers[i]
      );
    }
  }
}

function convertLetterToColumn(letter) {
  var normalizedLetter = letter
    .toString()
    .trim()
    .toUpperCase();
  var column = 0;
  for (
    var i = 0;
    i < normalizedLetter.length;
    i++
  ) {
    column =
      column * 26 +
      normalizedLetter.charCodeAt(i) -
      64;
  }
  return column;
}

function convertColumnToLetter_(
  columnNumber
) {
  var column = parseInt(
    columnNumber,
    10
  );
  if (
    isNaN(column) ||
    column < 1
  ) {
    return '';
  }
  var letter = '';
  while (column > 0) {
    var remainder =
      (column - 1) % 26;
    letter =
      String.fromCharCode(
        65 + remainder
      ) + letter;
    column = Math.floor(
      (column - 1) / 26
    );
  }
  return letter;
}

function isValidColumnLetter_(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }
  return /^[A-Z]+$/.test(
    value
      .toString()
      .trim()
      .toUpperCase()
  );
}

function normalizePathForTraversal_(
  rawPath
) {
  if (!rawPath) {
    return '';
  }
  return rawPath
    .toString()
    .trim()
    .replace(
      /^[a-zA-Z]:\\/i,
      ''
    )
    .replace(
      /^my drive\\/i,
      ''
    )
    .replace(
      /\//g,
      '\\'
    )
    .replace(
      /\\+/g,
      '\\'
    )
    .replace(
      /^\\+|\\+$/g,
      ''
    );
}