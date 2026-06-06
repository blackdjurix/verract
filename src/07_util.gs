function generateCacheKey_(value) {
  var rawDigest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    value,
    Utilities.Charset.UTF_8
  );
  var hash = '';
  for (var i = 0; i < rawDigest.length; i++) {
    var byteVal = rawDigest[i];
    if (byteVal < 0) {
      byteVal += 256;
    }
    var byteString = byteVal.toString(16);
    if (byteString.length === 1) {
      byteString = '0' + byteString;
    }
    hash += byteString;
  }
  return 'md5_' + hash;
}

function deleteExistingTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn && fn.indexOf('TRIGGER_BATCH_') === 0) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function convertLetterToColumn(letter) {
  var column = 0;
  for (var i = 0; i < letter.length; i++) {
    column = column * 26 + letter.charCodeAt(i) - 64;
  }
  return column;
}