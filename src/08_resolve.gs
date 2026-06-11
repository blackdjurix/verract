function extractResolveTargetFromError_(errorValue) {
  var errorText = errorValue ? errorValue.toString().trim() : '';
  if (!errorText) {
    return {
      target: '',
      type: '',
      method: 'NO_ERROR',
      shouldSearch: false,
      note: 'Missing Verify error.'
    };
  }
  if (/^missing candidate path\.?$/i.test(errorText)) {
    return {
      target: '',
      type: '',
      method: 'MISSING_CANDIDATE_PATH',
      shouldSearch: false,
      note: 'Missing candidate path. Resolve skipped.'
    };
  }
  if (/^missing filename\.?$/i.test(errorText)) {
    return {
      target: '',
      type: '',
      method: 'MISSING_FILENAME',
      shouldSearch: false,
      note: 'Missing filename. Resolve skipped.'
    };
  }
  var missingFolderMatch = errorText.match(/^missing folder\s*:\s*(.+)$/i);
  if (missingFolderMatch && missingFolderMatch[1]) {
    return {
      target: cleanResolveTarget_(missingFolderMatch[1]),
      type: 'folder',
      method: 'VERIFY_ERROR_MISSING_FOLDER',
      shouldSearch: false,
      note: 'Verify failed at folder: ' + cleanResolveTarget_(missingFolderMatch[1])
    };
  }
  var fileNotFoundMatch = errorText.match(/^file not found\s*:\s*(.+)$/i);
  if (fileNotFoundMatch && fileNotFoundMatch[1]) {
    return {
      target: cleanResolveTarget_(fileNotFoundMatch[1]),
      type: 'file',
      method: 'VERIFY_ERROR_FILE_NOT_FOUND',
      shouldSearch: false,
      note: 'Verify failed at file: ' + cleanResolveTarget_(fileNotFoundMatch[1])
    };
  }
  return {
    target: '',
    type: '',
    method: 'UNSUPPORTED_ERROR',
    shouldSearch: false,
    note: 'Unsupported Verify error: ' + errorText
  };
}

function extractResolveObjectTargetFromRow_(row, config) {
  var pathValue = getResolveRowValue_(row, config.pathIndex);
  var fileValue = getResolveRowValue_(row, config.fileIndex);
  var extValue = getResolveRowValue_(row, config.extIndex);
  var fileTarget = buildResolveFileTarget_(fileValue, extValue);
  if (fileTarget) {
    return {
      target: fileTarget,
      type: 'file',
      method: 'INPUT_FILE_TARGET',
      shouldSearch: true,
      note: ''
    };
  }
  var pathTarget = extractLastSegmentFromPath_(pathValue);
  if (pathTarget) {
    return {
      target: pathTarget,
      type: guessResolveObjectTypeFromName_(pathTarget),
      method: 'INPUT_PATH_LAST_OBJECT',
      shouldSearch: true,
      note: ''
    };
  }
  return {
    target: '',
    type: '',
    method: 'NO_OBJECT_TARGET',
    shouldSearch: false,
    note: 'No object target found from input row.'
  };
}

function searchResolveFilesByDriveIndex_(target) {
  var result = {
    matches: [],
    matchCount: 0,
    error: '',
    stoppedByLimit: false
  };
  if (!target) {
    result.error = 'Missing Resolve target.';
    return result;
  }
  try {
    var queryTarget = escapeDriveSearchText_(target);
    var query =
      "title = '" +
      queryTarget +
      "' and trashed = false";
    var files = DriveApp.searchFiles(query);
    while (
      files.hasNext() &&
      result.matches.length < RESOLVE_MAX_CANDIDATES_PER_ROW
    ) {
      var file = files.next();
      result.matches.push({
        id: file.getId(),
        type: 'file',
        name: file.getName(),
        path: file.getName()
      });
    }
    if (files.hasNext()) {
      result.stoppedByLimit = true;
    }
    result.matchCount = result.matches.length;
    return result;
  } catch (err) {
    result.error = err.toString();
    result.matchCount = result.matches.length;
    return result;
  }
}

function buildResolveResultFromSearch_(objectTarget, searchResult, verifyContext) {
  var contextNote = verifyContext && verifyContext.note
    ? ' | ' + verifyContext.note
    : '';
  if (!objectTarget || !objectTarget.shouldSearch) {
    return buildResolveResult_(
      'SKIPPED',
      '',
      '',
      '',
      0,
      objectTarget ? objectTarget.method : '',
      '',
      objectTarget ? objectTarget.note : 'No Resolve target.'
    );
  }
  if (searchResult.error) {
    return buildResolveResult_(
      'ERROR',
      '',
      '',
      '',
      searchResult.matchCount || 0,
      objectTarget.method,
      '',
      searchResult.error + contextNote
    );
  }
  if (searchResult.matchCount === 0) {
    return buildResolveResult_(
      'NEEDS_HUMAN_INPUT',
      '',
      '',
      '',
      0,
      objectTarget.method,
      'Low',
      'Object not found by Drive index: ' + objectTarget.target + contextNote
    );
  }
  var firstMatch = searchResult.matches[0];
  if (searchResult.matchCount === 1) {
    return buildResolveResult_(
      'FOUND_SINGLE',
      firstMatch.id,
      firstMatch.type,
      firstMatch.path,
      1,
      objectTarget.method,
      'High',
      'Single candidate found by Drive index.' + contextNote
    );
  }
  return buildResolveResult_(
    'FOUND_MULTIPLE',
    firstMatch.id,
    firstMatch.type,
    firstMatch.path,
    searchResult.matchCount,
    objectTarget.method,
    'Low',
    searchResult.matchCount +
      ' candidates found by Drive index. Manual review required.' +
      contextNote
  );
}

function isFailedVerifyRow_(existsValue, errorValue) {
  var existsText = existsValue
    ? existsValue.toString().trim().toUpperCase()
    : '';
  var hasError = errorValue !== '' && errorValue !== null;
  return existsText !== 'TRUE' && hasError;
}

function getResolveRowValue_(row, index) {
  if (
    index === null ||
    index === undefined ||
    index < 0
  ) {
    return '';
  }
  return row[index];
}

function buildResolveFileTarget_(fileValue, extValue) {
  var fileText = fileValue ? fileValue.toString().trim() : '';
  var extText = extValue ? extValue.toString().trim() : '';
  if (!fileText) {
    return '';
  }
  if (/\.[^\\\/.]+$/.test(fileText)) {
    return fileText;
  }
  if (extText) {
    return fileText + '.' + extText.replace(/^\./, '');
  }
  return fileText;
}

function extractLastSegmentFromPath_(pathValue) {
  var pathText = pathValue ? pathValue.toString().trim() : '';
  if (!pathText) {
    return '';
  }
  var parts = pathText
    .replace(/[\/]+/g, '\\')
    .replace(/[\\]+$/g, '')
    .split('\\');
  return parts.length ? parts[parts.length - 1].trim() : '';
}

function guessResolveObjectTypeFromName_(name) {
  if (/\.[^\\\/.]+$/.test(name)) {
    return 'file';
  }
  return 'folder';
}

function cleanResolveTarget_(value) {
  return value
    .toString()
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[\\\/]+$/g, '')
    .trim();
}

function escapeDriveSearchText_(value) {
  return value
    .toString()
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function buildResolveResult_(
  status,
  resolvedId,
  resolvedType,
  resolvedPath,
  matchCount,
  matchMethod,
  confidence,
  note
) {
  return {
    status: status || '',
    resolvedId: resolvedId || '',
    resolvedType: resolvedType || '',
    resolvedPath: resolvedPath || '',
    matchCount: matchCount || 0,
    matchMethod: matchMethod || '',
    confidence: confidence || '',
    note: note || ''
  };
}

function TEST_EXTRACT_RESOLVE_TARGET_FROM_ERROR() {
  var tests = [
    'Missing folder: __Personal',
    'Missing folder: Marketing Tool',
    'Missing folder: Xin Tian Di',
    'Missing candidate path.',
    'Missing filename.',
    'File not found: Sample.ai'
  ];
  tests.forEach(function(test) {
    Logger.log(
      JSON.stringify(
        extractResolveTargetFromError_(test),
        null,
        2
      )
    );
  });
}

function TEST_EXTRACT_RESOLVE_OBJECT_TARGET() {
  var tests = [
    {
      name: 'FullFile mode',
      row: [
        'MR Realty\\Campaigns\\BSR\\05_Working Files',
        'Buy Sell Rent Bandung_Rangka Samping_445x145 cm_231221_.ai',
        ''
      ],
      config: {
        pathIndex: 0,
        fileIndex: 1,
        extIndex: 2
      }
    },
    {
      name: 'File + Ext mode',
      row: [
        'B_Production\\Pokemoon\\Logo\\_ Assets\\Kanit',
        'Kanit',
        'zip'
      ],
      config: {
        pathIndex: 0,
        fileIndex: 1,
        extIndex: 2
      }
    },
    {
      name: 'Path-only file mode',
      row: [
        'YC\\Product Design\\Packaging\\04_Assets\\Illustrations\\comparing-healthy-cancerous-liver-cell-growth.jpg',
        '',
        ''
      ],
      config: {
        pathIndex: 0,
        fileIndex: 1,
        extIndex: 2
      }
    },
    {
      name: 'Path-only folder mode',
      row: [
        'MR Realty\\Primary\\PIK 2\\Xin Tian Di\\07_Delivery',
        '',
        ''
      ],
      config: {
        pathIndex: 0,
        fileIndex: 1,
        extIndex: 2
      }
    },
    {
      name: 'No target',
      row: ['', '', ''],
      config: {
        pathIndex: 0,
        fileIndex: 1,
        extIndex: 2
      }
    }
  ];
  tests.forEach(function(test) {
    Logger.log('--- ' + test.name + ' ---');
    Logger.log(
      JSON.stringify(
        extractResolveObjectTargetFromRow_(test.row, test.config),
        null,
        2
      )
    );
  });
}

function TEST_SEARCH_RESOLVE_FILES_BY_DRIVE_INDEX() {
  var target =
    'Buy Sell Rent Bandung_Rangka Samping_445x145 cm_231221_.ai';
  var result =
    searchResolveFilesByDriveIndex_(target);
  Logger.log(JSON.stringify(result, null, 2));
}

function TEST_RESOLVE_SEARCH_RESULT_BUILD() {
  var objectTarget = {
    target: 'Buy Sell Rent Bandung_Rangka Samping_445x145 cm_231221_.ai',
    type: 'file',
    method: 'INPUT_FILE_TARGET',
    shouldSearch: true,
    note: ''
  };
  var verifyContext =
    extractResolveTargetFromError_('Missing folder: Marketing Tool');
  var searchResult =
    searchResolveFilesByDriveIndex_(objectTarget.target);
  var result =
    buildResolveResultFromSearch_(
      objectTarget,
      searchResult,
      verifyContext
    );
  Logger.log(JSON.stringify(result, null, 2));
}