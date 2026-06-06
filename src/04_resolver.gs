function resolveFromRootId_(rootId, relativePath, scriptCache) {
  try {
    rootId = rootId.toString().trim();
    relativePath = relativePath.toString().trim();
    var currentFolder = DriveApp.getFolderById(rootId);
    var segments = relativePath
      .split('\\')
      .filter(String);
    if (!segments.length) {
      return [false, '', '', rootId, 'Empty path'];
    }
    var parentId = rootId;
    for (var i = 0; i < segments.length - 1; i++) {
      var segment = segments[i];
      var segmentCacheKey = generateCacheKey_(
        'folder|' + parentId + '|' + segment
      );
      var cachedFolderId = scriptCache.get(segmentCacheKey);
      if (cachedFolderId) {
        try {
          currentFolder = DriveApp.getFolderById(cachedFolderId);
          parentId = cachedFolderId;
          continue;
        } catch (cacheErr) {
          scriptCache.remove(segmentCacheKey);
        }
      }
      var folders = currentFolder.getFoldersByName(segment);
      if (!folders.hasNext()) {
        return [
          false,
          '',
          '',
          currentFolder.getId(),
          'Missing folder: ' + segment
        ];
      }
      currentFolder = folders.next();
      parentId = currentFolder.getId();
      try {
        scriptCache.put(segmentCacheKey, parentId, 7200);
      } catch (cachePutErr) {}
    }
    var targetName = segments[segments.length - 1];
    var folderCheck = currentFolder.getFoldersByName(targetName);
    if (folderCheck.hasNext()) {
      var foundFolder = folderCheck.next();
      return [
        true,
        foundFolder.getId(),
        'folder',
        currentFolder.getId(),
        ''
      ];
    }
    var fileCheck = currentFolder.getFilesByName(targetName);
    if (fileCheck.hasNext()) {
      var foundFile = fileCheck.next();
      return [
        true,
        foundFile.getId(),
        'file',
        currentFolder.getId(),
        ''
      ];
    }
    return [
      false,
      '',
      '',
      currentFolder.getId(),
      'Target not found: ' + targetName
    ];
  } catch (err) {
    return [
      false,
      '',
      '',
      rootId || '',
      'Resolver error: ' + err.toString()
    ];
  }
}

function normalizePathForTraversal_(rawPath) {
  if (!rawPath) return '';
  return rawPath
    .trim()
    .replace(/^[a-zA-Z]:\\/i, '')
    .replace(/^my drive\\/i, '')
    .replace(/\//g, '\\')
    .replace(/\\+/g, '\\');
}
