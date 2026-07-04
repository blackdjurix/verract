function CREATE_ACTION_TRIGGER_MULTI() {
  var ui = SpreadsheetApp.getUi();
  return ui.prompt(
    'Run Action',
    'Use the sidebar for the folder Action runner.',
    ui.ButtonSet.OK
  );
}

function START_ACTION_FROM_SIDEBAR(config) {
  var normalized = normalizeActionRunConfig_(config || {});
  normalized.runId = createRunId_('action');
  runActionRows_(normalized);

  return {
    ok: true,
    phase: VERRACT_PHASE_ACTION,
    runId: normalized.runId,
    startRow: normalized.startRow,
    endRow: normalized.endRow
  };
}

function TRIGGER_ACTION_BATCH_MULTI() {
  var config = getVerractConfigState_();
  if (!config || config.phase !== VERRACT_PHASE_ACTION) return;
  runActionRows_(config);
}

function runActionRows_(config) {
  var sheet = getRunSheet_(config);
  var lastColumn = sheet.getLastColumn();
  var startTime = Date.now();
  var rowRanges = getConfigRowRanges_(config);
  var processed = 0;

  for (var rangeIndex = 0; rangeIndex < rowRanges.length; rangeIndex++) {
    var activeRange = rowRanges[rangeIndex];

    for (var row = activeRange.startRow; row <= activeRange.endRow; row++) {
      if (processed >= config.batchSize) return;
      if (Date.now() - startTime > VERRACT_TIME_BUDGET_MS) return;
      if (isRowHiddenForRun_(sheet, row)) continue;

      runActionRow_(sheet, row, lastColumn, config);
      processed++;
    }
  }
}

function runActionRow_(sheet, row, lastColumn, config) {
  var rowValues = getRowValues_(sheet, row, lastColumn);
  var shared = readMappedObject_(rowValues, config.sharedMapping);
  var sourcePathId = asText_(shared.SharedPathID);
  var rootId = asText_(getCellFromRow_(rowValues, config.rootIdColumn));
  var targetPath = asText_(getCellFromRow_(rowValues, config.targetPathColumn));
  var actionAt = nowIso_();
  var result;

  if (!sourcePathId) {
    result = {
      status: ACTION_STATUSES.SOURCE_MISSING,
      note: 'Shared PathID is empty.'
    };
  } else if (!rootId || !targetPath) {
    result = {
      status: ACTION_STATUSES.FAILED,
      note: 'RootID and Target Path are required.'
    };
  } else if (config.operation !== ACTION_OPERATIONS.MOVE) {
    result = {
      status: ACTION_STATUSES.FAILED,
      note: 'Unsupported operation: ' + config.operation
    };
  } else {
    result = executeMoveFolderAction_(sourcePathId, rootId, targetPath);
  }

  writeMappedObject_(sheet, row, config.actionMapping, {
    ActionStatus: result.status,
    ActionID: config.runId,
    ActionAt: actionAt,
    ActionNote: result.note || ''
  });
}

function executeMoveFolderAction_(sourcePathId, rootId, targetPath) {
  var source = getLiveFolderById_(sourcePathId);
  if (!source) {
    return {
      status: ACTION_STATUSES.SOURCE_MISSING,
      note: 'Source folder cannot be opened.'
    };
  }

  var targetResult = findFolderByPath_(rootId, targetPath);

  if (targetResult.status === 'AMBIGUOUS') {
    return {
      status: ACTION_STATUSES.TARGET_CONFLICT,
      note: targetResult.note || 'Target path is ambiguous.'
    };
  }

  if (targetResult.status === 'FOUND') {
    if (targetResult.pathId === source.getId()) {
      return {
        status: ACTION_STATUSES.SKIPPED_ALREADY_AT_TARGET,
        note: 'Source folder is already at target path.'
      };
    }

    return mergeSourceFolderIntoTarget_(source, targetResult.folder);
  }

  if (targetResult.status !== 'PATH_NOT_FOUND') {
    return {
      status: ACTION_STATUSES.FAILED,
      note: targetResult.note || 'Target path cannot be resolved.'
    };
  }

  return moveSourceFolderToMissingTarget_(source, rootId, targetPath);
}

function getLiveFolderById_(folderId) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    if (folder.isTrashed && folder.isTrashed()) return null;
    return folder;
  } catch (err) {
    return null;
  }
}

function moveSourceFolderToMissingTarget_(source, rootId, targetPath) {
  var segments = splitPathSegments_(targetPath);
  if (!segments.length) {
    return {
      status: ACTION_STATUSES.FAILED,
      note: 'Target Path is empty.'
    };
  }

  var targetName = segments.pop();
  var parentResult = ensureFolderPathUnderRoot_(rootId, segments);

  if (parentResult.status !== 'FOUND') {
    return {
      status: parentResult.status === 'AMBIGUOUS'
        ? ACTION_STATUSES.TARGET_CONFLICT
        : ACTION_STATUSES.FAILED,
      note: parentResult.note || 'Target parent cannot be prepared.'
    };
  }

  try {
    source.moveTo(parentResult.folder);
    if (source.getName() !== targetName) {
      source.setName(targetName);
    }

    return {
      status: ACTION_STATUSES.EXECUTED,
      note: 'Source folder moved to target path.'
    };
  } catch (err) {
    return {
      status: ACTION_STATUSES.FAILED,
      note: 'MOVE failed: ' + err.message
    };
  }
}

function ensureFolderPathUnderRoot_(rootId, segments) {
  var current;
  try {
    current = DriveApp.getFolderById(rootId);
  } catch (err) {
    return {
      status: 'INVALID_INPUT',
      folder: null,
      note: 'Root folder cannot be opened: ' + err.message
    };
  }

  for (var i = 0; i < segments.length; i++) {
    var found = findExactFolderUnder_(current, segments[i]);

    if (found.status === 'AMBIGUOUS') {
      return {
        status: 'AMBIGUOUS',
        folder: null,
        note: 'Ambiguous target folder segment: ' + segments[i]
      };
    }

    if (found.status === 'FOUND') {
      current = found.folder;
    } else {
      try {
        current = current.createFolder(segments[i]);
      } catch (err) {
        return {
          status: 'FAILED',
          folder: null,
          note: 'Cannot create target folder segment ' + segments[i] + ': ' + err.message
        };
      }
    }
  }

  return {
    status: 'FOUND',
    folder: current,
    note: ''
  };
}

function mergeSourceFolderIntoTarget_(source, target) {
  var moveErrors = [];

  try {
    var files = source.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      try {
        if (isActionSystemJunkName_(file.getName())) {
          file.setTrashed(true);
        } else {
          file.moveTo(target);
        }
      } catch (err) {
        moveErrors.push(file.getName() + ': ' + err.message);
      }
    }

    var folders = source.getFolders();
    while (folders.hasNext()) {
      var child = folders.next();
      try {
        child.moveTo(target);
      } catch (err) {
        moveErrors.push(child.getName() + ': ' + err.message);
      }
    }

    removeRemainingSystemJunk_(source);

    if (folderHasRealContent_(source)) {
      return {
        status: ACTION_STATUSES.EXECUTED_SOURCE_RETAINED,
        note: moveErrors.length
          ? 'Target merge completed partially. Source retained because real content remains. ' + moveErrors.join(' | ')
          : 'Target merge completed. Source retained because real content remains.'
      };
    }

    try {
      source.setTrashed(true);
    } catch (err) {
      return {
        status: ACTION_STATUSES.EXECUTED_SOURCE_RETAINED,
        note: 'Target merge completed, but source folder could not be removed: ' + err.message
      };
    }

    return {
      status: ACTION_STATUSES.EXECUTED,
      note: moveErrors.length
        ? 'Target merge completed with handled move errors: ' + moveErrors.join(' | ')
        : 'Source contents moved into existing target folder.'
    };
  } catch (err) {
    return {
      status: ACTION_STATUSES.FAILED,
      note: 'Target merge failed: ' + err.message
    };
  }
}

function isActionSystemJunkName_(name) {
  return !!ACTION_SYSTEM_JUNK_NAMES[asText_(name).toLowerCase()];
}

function removeRemainingSystemJunk_(folder) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (isActionSystemJunkName_(file.getName())) {
      try {
        file.setTrashed(true);
      } catch (err) {
      }
    }
  }
}

function folderHasRealContent_(folder) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (!isActionSystemJunkName_(file.getName())) {
      return true;
    }
  }

  return folder.getFolders().hasNext();
}
