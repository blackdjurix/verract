function verifyFileAcrossCandidatePaths_(
  rootId,
  candidatePaths,
  filename,
  scriptCache
) {
  var normalizedRootId = rootId
    ? rootId.toString().trim()
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
  var normalizedFilename = filename
    ? filename.toString().trim()
    : '';
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
  if (!candidatePaths || candidatePaths.length === 0) {
    return buildVerifyFileResult_(
      false,
      '',
      '',
      '',
      '',
      '',
      0,
      'No candidate paths provided.'
    );
  }
  var uniquePaths = deduplicateCandidatePaths_(
    candidatePaths
  );
  if (uniquePaths.length === 0) {
    return buildVerifyFileResult_(
      false,
      '',
      '',
      '',
      '',
      '',
      0,
      'No valid candidate paths available.'
    );
  }
  var checkedPathCount = 0;
  var lastError = '';
  for (
    var i = 0;
    i < uniquePaths.length;
    i++
  ) {
    var candidate = uniquePaths[i];
    checkedPathCount++;
    var result = verifyFileAtCandidatePath_(
      normalizedRootId,
      candidate.value,
      normalizedFilename,
      scriptCache
    );
    if (result.exists) {
      return buildVerifyFileResult_(
        true,
        result.fileId,
        'file',
        result.parentId,
        result.verifiedFilePath,
        convertColumnToLetter_(
          candidate.column
        ),
        checkedPathCount,
        ''
      );
    }
    if (result.error) {
      lastError = result.error;
    }
  }
  return buildVerifyFileResult_(
    false,
    '',
    '',
    '',
    '',
    '',
    checkedPathCount,
    lastError ||
      'File not found in candidate paths.'
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
    var candidate = candidatePaths[i];
    if (
      !candidate ||
      candidate.value === '' ||
      candidate.value === null ||
      candidate.value === undefined
    ) {
      continue;
    }
    var originalValue = candidate.value
      .toString()
      .trim();
    if (!originalValue) {
      continue;
    }
    var normalizedKey =
      normalizeCandidatePathKey_(
        originalValue
      );
    if (
      !normalizedKey ||
      seen[normalizedKey]
    ) {
      continue;
    }
    seen[normalizedKey] = true;
    uniquePaths.push({
      column: candidate.column,
      value: originalValue
    });
  }
  return uniquePaths;
}

function normalizeCandidatePathKey_(pathValue) {
  if (!pathValue) {
    return '';
  }
  return normalizePathForTraversal_(
    pathValue.toString()
  )
    .replace(/\\+$/g, '')
    .toLowerCase();
}

function verifyFileAtCandidatePath_(
  rootId,
  candidatePath,
  filename,
  scriptCache
) {
  var cleanPath =
    normalizePathForTraversal_(
      candidatePath
    );
  if (!cleanPath) {
    return {
      exists: false,
      fileId: '',
      parentId: '',
      verifiedFilePath: '',
      error: 'Empty candidate path.'
    };
  }
  try {
    var parentFolder =
      resolveFolderFromRootId_(
        rootId,
        cleanPath,
        scriptCache
      );
    if (!parentFolder.exists) {
      return {
        exists: false,
        fileId: '',
        parentId:
          parentFolder.parentId || '',
        verifiedFilePath: '',
        error:
          parentFolder.error ||
          'Candidate folder not found.'
      };
    }
    var folder = DriveApp.getFolderById(
      parentFolder.folderId
    );
    var files = folder.getFilesByName(
      filename
    );
    if (!files.hasNext()) {
      return {
        exists: false,
        fileId: '',
        parentId: folder.getId(),
        verifiedFilePath: '',
        error:
          'File not found: ' + filename
      };
    }
    var file = files.next();
    return {
      exists: true,
      fileId: file.getId(),
      parentId: folder.getId(),
      verifiedFilePath:
        joinPathAndFilename_(
          candidatePath,
          filename
        ),
      error: ''
    };
  } catch (err) {
    return {
      exists: false,
      fileId: '',
      parentId: rootId || '',
      verifiedFilePath: '',
      error:
        'File verification error: ' +
        err.toString()
    };
  }
}

function resolveFolderFromRootId_(
  rootId,
  relativePath,
  scriptCache
) {
  try {
    var currentFolder =
      DriveApp.getFolderById(rootId);
    var segments = relativePath
      .split('\\')
      .filter(String);
    if (!segments.length) {
      return {
        exists: true,
        folderId: currentFolder.getId(),
        parentId: rootId,
        error: ''
      };
    }
    var parentId = rootId;
    for (
      var i = 0;
      i < segments.length;
      i++
    ) {
      var segment = segments[i];
      var cacheKey = generateCacheKey_(
        'folder|' +
          parentId +
          '|' +
          segment
      );
      var cachedFolderId =
        scriptCache.get(cacheKey);
      if (cachedFolderId) {
        try {
          currentFolder =
            DriveApp.getFolderById(
              cachedFolderId
            );
          parentId = cachedFolderId;
          continue;
        } catch (cacheErr) {
          scriptCache.remove(cacheKey);
        }
      }
      var folders =
        currentFolder.getFoldersByName(
          segment
        );
      if (!folders.hasNext()) {
        return {
          exists: false,
          folderId: '',
          parentId:
            currentFolder.getId(),
          error:
            'Missing folder: ' +
            segment
        };
      }
      currentFolder = folders.next();
      parentId = currentFolder.getId();
      try {
        scriptCache.put(
          cacheKey,
          parentId,
          CACHE_TTL_SECONDS
        );
      } catch (cachePutErr) {}
    }
    return {
      exists: true,
      folderId: currentFolder.getId(),
      parentId: parentId,
      error: ''
    };
  } catch (err) {
    return {
      exists: false,
      folderId: '',
      parentId: rootId || '',
      error:
        'Folder resolution error: ' +
        err.toString()
    };
  }
}

function joinPathAndFilename_(
  pathValue,
  filename
) {
  var cleanPath = pathValue
    .toString()
    .trim()
    .replace(/\//g, '\\')
    .replace(/\\+$/g, '');
  return (
    cleanPath +
    '\\' +
    filename.toString().trim()
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
    fileId: fileId,
    fileType: fileType,
    parentId: parentId,
    verifiedFilePath:
      verifiedFilePath,
    matchedPathColumn:
      matchedPathColumn,
    checkedPathCount:
      checkedPathCount,
    error: error
  };
}