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
    'TRIGGER_RESOLVE_BATCH_MULTI',
    'TRIGGER_ACTION_PREVIEW_BATCH_MULTI',
    'TRIGGER_MULTI_PHASE_TRANSITION',
    'TRIGGER_EXECUTION_BATCH_MULTI'
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

/**
 * Resolves a Drive object from a root-relative path.
 * typeHint: 'file', 'folder', or blank for automatic detection.
 */
function resolveDriveObjectId_(rootId, objectPath, typeHint, scriptCache) {
  var normalizedPath = normalizePathForTraversal_(objectPath);
  var normalizedType = String(typeHint || '').toLowerCase().trim();

  if (!rootId) {
    return buildDriveObjectResolution_(false, '', '', '', '', 'ROOT_ID_REQUIRED');
  }
  if (!normalizedPath) {
    return buildDriveObjectResolution_(false, '', '', '', '', 'OBJECT_PATH_REQUIRED');
  }

  var segments = normalizedPath.split('\\');
  var objectName = segments.pop();
  var parentPath = segments.join('\\');
  var folderResult = resolveFolderFromRootId_(rootId, parentPath, scriptCache || CacheService.getScriptCache());

  if (!folderResult.exists) {
    return buildDriveObjectResolution_(false, '', '', objectName, '', folderResult.error || 'PARENT_NOT_FOUND');
  }

  var parent = folderResult.folder;
  var parentId = parent.getId();

  if (normalizedType !== 'folder') {
    var files = parent.getFilesByName(objectName);
    if (files.hasNext()) {
      var file = files.next();
      if (files.hasNext()) {
        return buildDriveObjectResolution_(false, '', 'file', objectName, parentId, 'AMBIGUOUS_FILE_NAME');
      }
      return buildDriveObjectResolution_(true, file.getId(), 'file', file.getName(), parentId, '');
    }
  }

  if (normalizedType !== 'file') {
    var folders = parent.getFoldersByName(objectName);
    if (folders.hasNext()) {
      var folder = folders.next();
      if (folders.hasNext()) {
        return buildDriveObjectResolution_(false, '', 'folder', objectName, parentId, 'AMBIGUOUS_FOLDER_NAME');
      }
      return buildDriveObjectResolution_(true, folder.getId(), 'folder', folder.getName(), parentId, '');
    }
  }

  return buildDriveObjectResolution_(false, '', normalizedType, objectName, parentId, 'OBJECT_NOT_FOUND');
}

function buildDriveObjectResolution_(found, objectId, objectType, objectName, parentId, error) {
  return {
    found: found === true,
    objectId: objectId || '',
    objectType: objectType || '',
    objectName: objectName || '',
    parentId: parentId || '',
    error: error || ''
  };
}

/**
 * Returns the current Drive state of an object ID.
 * File lookup is attempted before folder lookup so a file ID is never
 * accidentally treated as its parent folder by caller-side mapping.
 */
function inspectDriveObjectById_(objectId) {
  var id = String(objectId || '').trim();
  if (!id) {
    return buildDriveObjectSnapshot_(false, id, '', '', '', false, false, 'OBJECT_ID_REQUIRED');
  }

  try {
    var fileLikeObject = DriveApp.getFileById(id);
    var mimeType = '';
    try {
      mimeType = String(fileLikeObject.getMimeType() || '').toLowerCase();
    } catch (mimeError) {}

    var detectedType = mimeType === 'application/vnd.google-apps.folder'
      ? 'folder'
      : 'file';

    return buildDriveObjectSnapshot_(
      true,
      id,
      detectedType,
      fileLikeObject.getName(),
      getFirstDriveParentId_(fileLikeObject),
      fileLikeObject.isTrashed(),
      true,
      fileLikeObject.isTrashed() ? 'OBJECT_TRASHED' : ''
    );
  } catch (fileError) {}

  try {
    var folder = DriveApp.getFolderById(id);
    return buildDriveObjectSnapshot_(
      true,
      id,
      'folder',
      folder.getName(),
      getFirstDriveParentId_(folder),
      folder.isTrashed(),
      true,
      folder.isTrashed() ? 'OBJECT_TRASHED' : ''
    );
  } catch (folderError) {
    return buildDriveObjectSnapshot_(false, id, '', '', '', false, false, 'OBJECT_ID_INVALID_OR_DENIED');
  }
}

function buildDriveObjectSnapshot_(exists, objectId, objectType, objectName, parentId, trashed, accessible, error) {
  return {
    exists: exists === true,
    objectId: objectId || '',
    objectType: objectType || '',
    objectName: objectName || '',
    parentId: parentId || '',
    trashed: trashed === true,
    accessible: accessible === true,
    error: error || ''
  };
}

function getFirstDriveParentId_(driveObject) {
  try {
    var parents = driveObject.getParents();
    return parents.hasNext() ? parents.next().getId() : '';
  } catch (err) {
    return '';
  }
}

function splitTargetObjectPath_(targetPath) {
  var normalized = normalizePathForTraversal_(targetPath);
  if (!normalized) {
    return { isValid: false, parentPath: '', objectName: '', error: 'TARGET_REQUIRED' };
  }
  var segments = normalized.split('\\');
  var objectName = segments.pop();
  if (!objectName) {
    return { isValid: false, parentPath: '', objectName: '', error: 'TARGET_OBJECT_NAME_REQUIRED' };
  }
  return {
    isValid: true,
    parentPath: segments.join('\\'),
    objectName: objectName,
    error: ''
  };
}

/**
 * Interprets Action Target according to operation and source object type.
 *
 * MOVE / COPY
 * - file   : Target is the destination parent path.
 * - folder : Target is the final folder path.
 *
 * RENAME
 * - Target is the new object name. A full path is accepted; only its leaf is used.
 *
 * MOVE_RENAME
 * - Target is the full final object path.
 */
function parseActionTarget_(operation, sourceObjectType, sourceObjectName, targetValue) {
  var normalizedOperation = normalizeActionOperation_(operation);
  var sourceType = String(sourceObjectType || '').toLowerCase().trim();
  var sourceName = String(sourceObjectName || '').trim();
  var normalizedTarget = normalizePathForTraversal_(targetValue);

  if (normalizedOperation === 'DELETE') {
    return buildActionTargetPlan_(true, '', '', '', false, '');
  }

  if (!normalizedTarget) {
    return buildActionTargetPlan_(false, '', '', '', false, 'TARGET_REQUIRED');
  }

  if (normalizedOperation === 'RENAME') {
    var renameParts = normalizedTarget.split('\\');
    var renameName = renameParts[renameParts.length - 1];
    if (!renameName) {
      return buildActionTargetPlan_(false, '', '', '', false, 'TARGET_OBJECT_NAME_REQUIRED');
    }
    return buildActionTargetPlan_(true, '', renameName, renameName, renameName !== sourceName, '');
  }

  if ((normalizedOperation === 'MOVE' || normalizedOperation === 'COPY') && sourceType === 'file') {
    return buildActionTargetPlan_(
      true,
      normalizedTarget,
      sourceName,
      normalizedTarget + '\\' + sourceName,
      false,
      ''
    );
  }

  var targetParts = splitTargetObjectPath_(normalizedTarget);
  if (!targetParts.isValid) {
    return buildActionTargetPlan_(false, '', '', '', false, targetParts.error);
  }

  return buildActionTargetPlan_(
    true,
    targetParts.parentPath,
    targetParts.objectName,
    normalizedTarget,
    targetParts.objectName !== sourceName,
    ''
  );
}

function buildActionTargetPlan_(isValid, parentPath, objectName, fullObjectPath, requiresRename, error) {
  return {
    isValid: isValid === true,
    parentPath: parentPath || '',
    objectName: objectName || '',
    fullObjectPath: fullObjectPath || '',
    requiresRename: requiresRename === true,
    error: error || ''
  };
}

/**
 * Mutation helpers reserved for the execution phase.
 * Action Preview does not call these functions.
 */
function moveDriveObject_(objectId, targetParentId) {
  var source = inspectDriveObjectById_(objectId);
  if (!source.exists || !source.accessible) {
    throw new Error(source.error || 'SOURCE_OBJECT_NOT_ACCESSIBLE');
  }

  var targetFolder = DriveApp.getFolderById(targetParentId);
  if (source.objectType === 'folder') {
    DriveApp.getFolderById(objectId).moveTo(targetFolder);
  } else {
    DriveApp.getFileById(objectId).moveTo(targetFolder);
  }

  return inspectDriveObjectById_(objectId);
}

function renameDriveObject_(objectId, targetName) {
  var name = String(targetName || '').trim();
  if (!name) throw new Error('TARGET_OBJECT_NAME_REQUIRED');

  var source = inspectDriveObjectById_(objectId);
  if (!source.exists || !source.accessible) {
    throw new Error(source.error || 'SOURCE_OBJECT_NOT_ACCESSIBLE');
  }

  if (source.objectType === 'folder') {
    DriveApp.getFolderById(objectId).setName(name);
  } else {
    DriveApp.getFileById(objectId).setName(name);
  }

  return inspectDriveObjectById_(objectId);
}



function ensureDriveFolderPath_(rootId, folderPath) {
  var normalized = normalizePathForTraversal_(folderPath);
  var folder = DriveApp.getFolderById(String(rootId || '').trim());
  if (!normalized) return folder;
  var parts = normalized.split('\\');
  for (var i = 0; i < parts.length; i++) {
    var name = String(parts[i] || '').trim();
    if (!name) continue;
    var matches = folder.getFoldersByName(name);
    if (matches.hasNext()) {
      folder = matches.next();
      if (matches.hasNext()) throw new Error('AMBIGUOUS_TARGET_FOLDER: ' + name);
    } else {
      folder = folder.createFolder(name);
    }
  }
  return folder;
}

function copyDriveObject_(objectId, targetParentId, targetName, ignoredStats) {
  var source = inspectDriveObjectById_(objectId);
  if (!source.exists || !source.accessible || source.trashed) throw new Error(source.error || 'SOURCE_NOT_AVAILABLE');
  var parent = DriveApp.getFolderById(targetParentId);
  var name = String(targetName || source.objectName).trim();
  if (source.objectType === 'file') return DriveApp.getFileById(objectId).makeCopy(name, parent).getId();
  return copyDriveFolderRecursive_(DriveApp.getFolderById(objectId), parent, name, ignoredStats).getId();
}

function copyDriveFolderRecursive_(sourceFolder, targetParent, targetName, ignoredStats) {
  var created = targetParent.createFolder(targetName || sourceFolder.getName());
  var files = sourceFolder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (isIgnoredSystemJunkFile_(f)) {
      recordIgnoredSystemJunkFile_(ignoredStats, f.getName());
      continue;
    }
    f.makeCopy(f.getName(), created);
  }
  var folders = sourceFolder.getFolders();
  while (folders.hasNext()) {
    var child = folders.next();
    copyDriveFolderRecursive_(child, created, child.getName(), ignoredStats);
  }
  return created;
}

function isIgnoredSystemJunkFile_(fileOrName) {
  var name = typeof fileOrName === 'string'
    ? fileOrName
    : fileOrName && typeof fileOrName.getName === 'function'
      ? fileOrName.getName()
      : '';

  return FOLDER_OPERATION_IGNORED_FILE_NAMES.indexOf(
    String(name || '').trim().toLowerCase()
  ) !== -1;
}

function recordIgnoredSystemJunkFile_(stats, name) {
  if (!stats) return;
  stats.ignoredFileCount = (stats.ignoredFileCount || 0) + 1;
  stats.ignoredFileNames = stats.ignoredFileNames || [];
  if (stats.ignoredFileNames.indexOf(name) === -1) {
    stats.ignoredFileNames.push(name);
  }
}

function formatIgnoredSystemJunkFilesNote_(stats) {
  if (!stats || !stats.ignoredFileCount) return '';
  var names =
    (stats.ignoredFileNames || []).join(', ');
  var failedCount =
    stats.ignoredFileErrorCount || 0;

  if (failedCount) {
    return 'Found ' + stats.ignoredFileCount +
      ' system junk file(s): ' + names +
      '. Moved ' +
      Math.max(
        0,
        stats.ignoredFileCount - failedCount
      ) +
      ' junk file(s) to Trash; failed to move ' + failedCount +
      ' junk file(s) to Trash; main operation continued.';
  }

  return 'Skipped ' + stats.ignoredFileCount +
    ' system junk file(s): ' + names + '.';
}

function trashIgnoredSystemJunkFilesRecursive_(folder, stats) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (!isIgnoredSystemJunkFile_(file)) continue;
    recordIgnoredSystemJunkFile_(stats, file.getName());
    try {
      file.setTrashed(true);
    } catch (err) {
      stats.ignoredFileErrorCount =
        (stats.ignoredFileErrorCount || 0) + 1;
    }
  }

  var folders = folder.getFolders();
  while (folders.hasNext()) {
    trashIgnoredSystemJunkFilesRecursive_(folders.next(), stats);
  }

  return stats;
}

function trashDriveObject_(objectId) {
  var source = inspectDriveObjectById_(objectId);
  if (!source.exists || !source.accessible) throw new Error(source.error || 'SOURCE_NOT_AVAILABLE');
  if (source.objectType === 'folder') DriveApp.getFolderById(objectId).setTrashed(true);
  else DriveApp.getFileById(objectId).setTrashed(true);
  return true;
}


function getSingleChildFolderByName_(parentFolder, name) {
  var matches =
    parentFolder.getFoldersByName(
      String(name || '').trim()
    );

  if (!matches.hasNext()) {
    return null;
  }

  var folder =
    matches.next();

  if (matches.hasNext()) {
    throw new Error(
      'AMBIGUOUS_TARGET_FOLDER: ' +
      name
    );
  }

  return folder;
}

function moveFolderContentsIntoTarget_(
  sourceFolderId,
  targetFolderId
) {
  var sourceFolder =
    DriveApp.getFolderById(
      sourceFolderId
    );

  var targetFolder =
    DriveApp.getFolderById(
      targetFolderId
    );

  if (
    sourceFolder.getId() ===
    targetFolder.getId()
  ) {
    return {
      fileCount: 0,
      folderCount: 0,
      note:
        'Source and target folders are identical.'
    };
  }

  var result = {
    fileCount: 0,
    folderCount: 0,
    ignoredFileCount: 0,
    ignoredFileNames: []
  };

  mergeMoveFolderContents_(
    sourceFolder,
    targetFolder,
    result
  );

  return {
    fileCount: result.fileCount,
    folderCount: result.folderCount,
    note:
      'Moved ' +
      result.fileCount +
      ' file(s) and merged ' +
      result.folderCount +
      ' folder(s).' +
      (result.ignoredFileCount
        ? ' ' + formatIgnoredSystemJunkFilesNote_(result)
        : '')
  };
}

function mergeMoveFolderContents_(
  sourceFolder,
  targetFolder,
  result
) {
  var files =
    sourceFolder.getFiles();

  while (files.hasNext()) {
    var file = files.next();
    if (isIgnoredSystemJunkFile_(file)) {
      recordIgnoredSystemJunkFile_(result, file.getName());
      continue;
    }
    file.moveTo(
      targetFolder
    );
    result.fileCount++;
  }

  var sourceChildren = [];
  var folders =
    sourceFolder.getFolders();

  while (folders.hasNext()) {
    sourceChildren.push(
      folders.next()
    );
  }

  for (
    var i = 0;
    i < sourceChildren.length;
    i++
  ) {
    var sourceChild =
      sourceChildren[i];

    var targetChild =
      getSingleChildFolderByName_(
        targetFolder,
        sourceChild.getName()
      );

    if (targetChild) {
      mergeMoveFolderContents_(
        sourceChild,
        targetChild,
        result
      );

      if (
        isDriveFolderEmpty_(
          sourceChild,
          true
        )
      ) {
        sourceChild.setTrashed(
          true
        );
      }
    } else {
      sourceChild.moveTo(
        targetFolder
      );
    }

    result.folderCount++;
  }
}

function copyFolderContentsIntoTarget_(
  sourceFolderId,
  targetFolderId
) {
  var sourceFolder =
    DriveApp.getFolderById(
      sourceFolderId
    );

  var targetFolder =
    DriveApp.getFolderById(
      targetFolderId
    );

  if (
    sourceFolder.getId() ===
    targetFolder.getId()
  ) {
    throw new Error(
      'SOURCE_AND_TARGET_FOLDER_ARE_IDENTICAL'
    );
  }

  var result = {
    fileCount: 0,
    folderCount: 0,
    ignoredFileCount: 0,
    ignoredFileNames: []
  };

  mergeCopyFolderContents_(
    sourceFolder,
    targetFolder,
    result
  );

  return {
    fileCount: result.fileCount,
    folderCount: result.folderCount,
    note:
      'Copied ' +
      result.fileCount +
      ' file(s) and merged ' +
      result.folderCount +
      ' folder(s).' +
      (result.ignoredFileCount
        ? ' ' + formatIgnoredSystemJunkFilesNote_(result)
        : '')
  };
}

function mergeCopyFolderContents_(
  sourceFolder,
  targetFolder,
  result
) {
  var files =
    sourceFolder.getFiles();

  while (files.hasNext()) {
    var file =
      files.next();

    if (isIgnoredSystemJunkFile_(file)) {
      recordIgnoredSystemJunkFile_(
        result,
        file.getName()
      );
      continue;
    }

    file.makeCopy(
      file.getName(),
      targetFolder
    );

    result.fileCount++;
  }

  var folders =
    sourceFolder.getFolders();

  while (folders.hasNext()) {
    var sourceChild =
      folders.next();

    var targetChild =
      getSingleChildFolderByName_(
        targetFolder,
        sourceChild.getName()
      );

    if (!targetChild) {
      targetChild =
        targetFolder.createFolder(
          sourceChild.getName()
        );
    }

    mergeCopyFolderContents_(
      sourceChild,
      targetChild,
      result
    );

    result.folderCount++;
  }
}
