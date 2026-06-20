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
    'TRIGGER_MULTI_PHASE_TRANSITION'
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

