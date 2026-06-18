function buildFileReferenceFromRow_(config) {
  var rawPathEntries =
    config.rawPathEntries || [];
  var fileNameValue =
    config.fileNameValue || '';
  var extensionValue =
    config.extensionValue || '';
  var explicitFilename =
    buildFilenameWithOptionalExtension_(
      fileNameValue,
      extensionValue
    );
  var candidatePaths = [];
  var inferredFilename = '';
  var checkedPathCount = 0;
  for (
    var i = 0;
    i < rawPathEntries.length;
    i++
  ) {
    var pathEntry =
      rawPathEntries[i];
    var rawPathValue =
      pathEntry.value;
    if (!rawPathValue) {
      continue;
    }
    var parsedReference =
      parsePathReference_(
        rawPathValue
      );
    if (
      parsedReference.hasFilename
    ) {
      if (
        explicitFilename &&
        parsedReference.filename !==
          explicitFilename
      ) {
        candidatePaths.push({
          path:
            parsedReference.folderPath,
          column:
            pathEntry.column,
          columnLetter:
            pathEntry.columnLetter
        });
        checkedPathCount++;
        continue;
      }
      if (!inferredFilename) {
        inferredFilename =
          parsedReference.filename;
      }
      candidatePaths.push({
        path:
          parsedReference.folderPath,
        column:
          pathEntry.column,
        columnLetter:
          pathEntry.columnLetter
      });
      checkedPathCount++;
      continue;
    }
    candidatePaths.push({
      path:
        parsedReference.folderPath,
      column:
        pathEntry.column,
      columnLetter:
        pathEntry.columnLetter
    });
    checkedPathCount++;
  }
  var finalFilename =
    explicitFilename ||
    inferredFilename;
  if (!finalFilename) {
    return {
      isValid: false,
      candidatePaths: [],
      filename: '',
      checkedPathCount: 0,
      error: 'Missing filename.'
    };
  }
  if (candidatePaths.length === 0) {
    return {
      isValid: false,
      candidatePaths: [],
      filename: finalFilename,
      checkedPathCount: checkedPathCount,
      error: 'Missing candidate path.'
    };
  }
  return {
    isValid: true,
    candidatePaths: candidatePaths,
    filename: finalFilename,
    checkedPathCount: checkedPathCount,
    error: ''
  };
}

function buildFilenameWithOptionalExtension_(
  fileNameValue,
  extensionValue
) {
  var filename = fileNameValue
    ? fileNameValue.toString().trim()
    : '';
  var extension = extensionValue
    ? extensionValue.toString().trim()
    : '';
  if (!filename) {
    return '';
  }
  if (!extension) {
    return filename;
  }
  extension = extension.replace(
    /^\.+/,
    ''
  );
  if (!extension) {
    return filename;
  }
  if (
    filename
      .toLowerCase()
      .slice(
        -1 * (extension.length + 1)
      ) ===
    '.' + extension.toLowerCase()
  ) {
    return filename;
  }
  return filename + '.' + extension;
}

function parsePathReference_(rawPathValue) {
  var normalizedPath =
    normalizePathForTraversal_(
      rawPathValue
    );
  if (!normalizedPath) {
    return {
      folderPath: '',
      filename: '',
      hasFilename: false
    };
  }
  var segments =
    normalizedPath.split('\\');
  var lastSegment =
    segments.length
      ? segments[segments.length - 1]
      : '';
  if (
    looksLikeFileName_(
      lastSegment
    )
  ) {
    segments.pop();
    return {
      folderPath:
        segments.join('\\'),
      filename:
        lastSegment,
      hasFilename: true
    };
  }
  return {
    folderPath:
      normalizedPath,
    filename: '',
    hasFilename: false
  };
}

function looksLikeFileName_(value) {
  if (!value) {
    return false;
  }
  var text =
    value.toString().trim();
  if (!text) {
    return false;
  }
  if (
    text.indexOf('\\') !== -1 ||
    text.indexOf('/') !== -1
  ) {
    return false;
  }
  return /\.[^.\s\\\/]+$/.test(text);
}

function verifyFileAcrossCandidatePaths_(
  rootId,
  candidatePaths,
  filename,
  scriptCache
) {
  var normalizedRootId = rootId
    ? rootId.toString().trim()
    : '';
  var normalizedFilename = filename
    ? filename.toString().trim()
    : '';
  if (!normalizedRootId) {
    return buildVerifyFileResult_(
      false,
      '',
      '',
      '',
      '',
      '',
      0,
      'Missing RootID.'
    );
  }
  if (!normalizedFilename) {
    return buildVerifyFileResult_(
      false,
      '',
      '',
      '',
      '',
      '',
      0,
      'Missing filename.'
    );
  }
  var uniqueCandidatePaths =
    deduplicateCandidatePaths_(
      candidatePaths
    );
  if (
    uniqueCandidatePaths.length === 0
  ) {
    return buildVerifyFileResult_(
      false,
      '',
      '',
      '',
      '',
      '',
      0,
      'Missing candidate path.'
    );
  }
  var checkedPathCount = 0;
  var firstValidPathMiss = null;
  var firstMissingPathError = '';
  for (
    var i = 0;
    i < uniqueCandidatePaths.length;
    i++
  ) {
    var candidatePath =
      uniqueCandidatePaths[i];
    checkedPathCount++;
    var result =
      verifyFileAtCandidatePath_(
        normalizedRootId,
        candidatePath.path,
        normalizedFilename,
        scriptCache
      );
    if (result.exists) {
      return buildVerifyFileResult_(
        true,
        result.fileId,
        result.fileType || 'file',
        result.pathId,
        result.verifiedFilePath,
        candidatePath.columnLetter,
        checkedPathCount,
        ''
      );
    }
    if (
      !firstValidPathMiss &&
      result.pathId
    ) {
      firstValidPathMiss = {
        fileType: result.fileType || 'folder',
        pathId: result.pathId,
        verifiedFilePath:
          result.verifiedFilePath ||
          normalizePathForTraversal_(
            candidatePath.path
          ),
        matchedPathColumn:
          candidatePath.columnLetter
      };
    }
    if (
      !firstMissingPathError &&
      result.error
    ) {
      firstMissingPathError =
        result.error;
    }
  }
  if (firstValidPathMiss) {
    return buildVerifyFileResult_(
      false,
      '',
      firstValidPathMiss.fileType,
      firstValidPathMiss.pathId,
      firstValidPathMiss.verifiedFilePath,
      firstValidPathMiss.matchedPathColumn,
      checkedPathCount,
      'Path found, but file not found.'
    );
  }
  return buildVerifyFileResult_(
    false,
    '',
    '',
    '',
    '',
    '',
    checkedPathCount,
    firstMissingPathError ||
      'No valid candidate path found.'
  );
}

function deduplicateCandidatePaths_(
  candidatePaths
) {
  var uniquePaths = [];
  var seen = {};
  for (
    var i = 0;
    i < candidatePaths.length;
    i++
  ) {
    var candidate =
      candidatePaths[i];
    if (
      !candidate ||
      !candidate.path
    ) {
      continue;
    }
    var key =
      normalizeCandidatePathKey_(
        candidate.path
      );
    if (!key || seen[key]) {
      continue;
    }
    seen[key] = true;
    uniquePaths.push({
      path: candidate.path,
      column: candidate.column,
      columnLetter:
        candidate.columnLetter
    });
  }
  return uniquePaths;
}

function normalizeCandidatePathKey_(
  pathValue
) {
  return normalizePathForTraversal_(
    pathValue
  )
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function verifyFileAtCandidatePath_(
  rootId,
  candidatePath,
  filename,
  scriptCache
) {
  var normalizedPath =
    normalizePathForTraversal_(
      candidatePath
    );
  if (!normalizedPath) {
    return {
      exists: false,
      fileId: '',
      fileType: '',
      pathId: '',
      verifiedFilePath: '',
      error: 'Missing path.'
    };
  }
  var folderResult =
    resolveFolderFromRootId_(
      rootId,
      normalizedPath,
      scriptCache
    );
  if (!folderResult.exists) {
    return {
      exists: false,
      fileId: '',
      fileType: '',
      pathId: '',
      verifiedFilePath: '',
      error: folderResult.error
    };
  }
  var files =
    folderResult.folder
      .getFilesByName(filename);
  if (files.hasNext()) {
    var file = files.next();
    return {
      exists: true,
      fileId: file.getId(),
      fileType: 'file',
      pathId:
        folderResult.folder.getId(),
      verifiedFilePath:
        joinPathAndFilename_(
          normalizedPath,
          filename
        ),
      error: ''
    };
  }
  if (
    isLikelySameObjectName_(
      getLeafSegmentFromPath_(
        normalizedPath
      ),
      filename
    )
  ) {
    return {
      exists: false,
      type: 'folder',
      fileId: '',
      pathId:
        folderResult.folder.getId(),
      verifiedFilePath:
        normalizedPath,
      error:
        'Path found, but file not found.'
    };
  }
  return {
    exists: false,
    fileId: '',
    fileType: 'folder',
    pathId:
      folderResult.folder.getId(),
    verifiedFilePath:
      normalizedPath,
    error:
      'Path found, but file not found.'
  };
}

function getLeafSegmentFromPath_(
  pathValue
) {
  var normalizedPath =
    normalizePathForTraversal_(
      pathValue
    );
  if (!normalizedPath) {
    return '';
  }
  var segments =
    normalizedPath.split('\\');
  return segments.length
    ? segments[segments.length - 1]
    : '';
}

function isLikelySameObjectName_(
  candidateName,
  filename
) {
  var candidateTokens =
    tokenizeObjectName_(
      candidateName
    );
  var filenameTokens =
    tokenizeObjectName_(
      stripExtensionFromName_(
        filename
      )
    );
  if (
    candidateTokens.length === 0 ||
    filenameTokens.length === 0
  ) {
    return false;
  }
  var candidateKey =
    candidateTokens.join('|');
  var filenameKey =
    filenameTokens.join('|');
  if (candidateKey === filenameKey) {
    return true;
  }
  var candidateMap = {};
  var filenameMap = {};
  var sharedCount = 0;
  for (
    var i = 0;
    i < candidateTokens.length;
    i++
  ) {
    candidateMap[
      candidateTokens[i]
    ] = true;
  }
  for (
    var j = 0;
    j < filenameTokens.length;
    j++
  ) {
    filenameMap[
      filenameTokens[j]
    ] = true;
  }
  for (var key in candidateMap) {
    if (filenameMap[key]) {
      sharedCount++;
    }
  }
  var candidateCoverage =
    sharedCount /
    Object.keys(candidateMap).length;
  var filenameCoverage =
    sharedCount /
    Object.keys(filenameMap).length;
  return (
    sharedCount >= 3 &&
    candidateCoverage >= 0.85 &&
    filenameCoverage >= 0.85
  );
}

function tokenizeObjectName_(
  value
) {
  var text = value
    ? value.toString().toLowerCase()
    : '';
  text =
    stripExtensionFromName_(
      text
    );
  text = text
    .replace(/[_\-]+/g, ' ')
    .replace(/[^\w]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) {
    return [];
  }
  var parts = text.split(' ');
  var seen = {};
  var tokens = [];
  for (
    var i = 0;
    i < parts.length;
    i++
  ) {
    var part = parts[i].trim();
    if (!part || seen[part]) {
      continue;
    }
    seen[part] = true;
    tokens.push(part);
  }
  tokens.sort();
  return tokens;
}

function stripExtensionFromName_(
  value
) {
  var text = value
    ? value.toString().trim()
    : '';
  return text.replace(
    /\.[^.\s\\\/]+$/,
    ''
  );
}

function resolveFolderFromRootId_(
  rootId,
  relativePath,
  scriptCache
) {
  var normalizedRootId = rootId
    ? rootId.toString().trim()
    : '';
  var normalizedPath =
    normalizePathForTraversal_(
      relativePath
    );
  if (!normalizedRootId) {
    return {
      exists: false,
      folder: null,
      error: 'Missing RootID.'
    };
  }
  if (!normalizedPath) {
    try {
      return {
        exists: true,
        folder:
          DriveApp.getFolderById(
            normalizedRootId
          ),
        error: ''
      };
    } catch (err) {
      return {
        exists: false,
        folder: null,
        error:
          'Invalid RootID: ' +
          normalizedRootId
      };
    }
  }
  var cacheKey =
    generateCacheKey_(
      normalizedRootId +
        '|' +
        normalizedPath
    );
  var cachedFolderId =
    scriptCache.get(cacheKey);
  if (cachedFolderId) {
    try {
      return {
        exists: true,
        folder:
          DriveApp.getFolderById(
            cachedFolderId
          ),
        error: ''
      };
    } catch (err) {}
  }
  var folder;
  try {
    folder =
      DriveApp.getFolderById(
        normalizedRootId
      );
  } catch (err) {
    return {
      exists: false,
      folder: null,
      error:
        'Invalid RootID: ' +
        normalizedRootId
    };
  }
  var segments =
    normalizedPath
      .split('\\')
      .filter(String);
  for (
    var i = 0;
    i < segments.length;
    i++
  ) {
    var segment =
      segments[i];
    var childFolders =
      folder.getFoldersByName(
        segment
      );
    if (!childFolders.hasNext()) {
      return {
        exists: false,
        folder: null,
        error:
          'Missing folder: ' +
          segment +
          ' | Parent path: ' +
          segments
            .slice(0, i)
            .join('\\') +
          ' | Full target: ' +
          normalizedPath
      };
    }
    folder = childFolders.next();
  }
  scriptCache.put(
    cacheKey,
    folder.getId(),
    CACHE_TTL_SECONDS
  );
  return {
    exists: true,
    folder: folder,
    error: ''
  };
}

function joinPathAndFilename_(
  pathValue,
  filename
) {
  var normalizedPath =
    normalizePathForTraversal_(
      pathValue
    );
  var normalizedFilename = filename
    ? filename.toString().trim()
    : '';
  if (!normalizedPath) {
    return normalizedFilename;
  }
  if (!normalizedFilename) {
    return normalizedPath;
  }
  return (
    normalizedPath +
    '\\' +
    normalizedFilename
  );
}

function buildVerifyFileResult_(
  exists,
  fileId,
  fileType,
  parentId,
  verifiedFilePath,
  matchedPathColumn,
  checkedPathCount,
  error
) {
  return {
    exists: exists,
    fileId: fileId || '',
    fileType: fileType || '',
    parentId: parentId || '',
    verifiedFilePath:
      verifiedFilePath || '',
    matchedPathColumn:
      matchedPathColumn || '',
    checkedPathCount:
      checkedPathCount || 0,
    error: error || ''
  };
}