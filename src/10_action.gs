
function CREATE_ACTION_PREVIEW_TRIGGER_MULTI() {
  throw new Error('Open the verract Control Panel and start Action Preview from the Action page.');
}

function startActionPreviewAutomation_(config) {
  var normalized = normalizeActionConfig_(config);
  var props = PropertiesService.getScriptProperties();
  checkEngineHeartbeat_();

  if (props.getProperty(ENGINE_STATE_KEY) === 'TRUE') {
    throw new Error('Automation masih aktif. Jalankan Stop & Reset dulu.');
  }

  deleteExistingTriggers_();
  props.deleteProperty('AUTO_LAST_ERROR');
  props.deleteProperty('AUTO_BACKOFF_UNTIL');

  var now = Date.now().toString();
  props.setProperties({
    ACTION_CURRENT_ROW: normalized.startRow.toString(),
    ACTION_END_ROW: normalized.endRow.toString(),
    ACTION_SOURCE_OBJECT_ID_COLUMN: normalized.sourceObjectIdColumn.toString(),
    ACTION_OPERATION_COLUMN: normalized.operationColumn.toString(),
    ACTION_TARGET_COLUMN: normalized.targetColumn.toString(),
    ACTION_ROOT_ID_COLUMN: normalized.rootIdColumn.toString(),
    ACTION_OUTPUT_MAPPING: serializeOutputMapping_(normalized.outputMapping),
    ACTION_SPREADSHEET_ID: normalized.spreadsheetId,
    ACTION_SHEET_NAME: normalized.sheetName,
    ACTION_BATCH_SIZE: normalized.batchSize.toString(),
    ACTION_TRIGGER_GAP_MINUTES: normalized.triggerGapMinutes.toString(),
    ACTION_ENGINE_STARTED_AT: now,
    ACTION_LAST_SUCCESS_TS: now,
    ACTION_PIPELINE_MODE: normalized.pipelineMode ? 'TRUE' : 'FALSE',
    ACTION_RESOLVED_ID_COLUMN: normalized.resolvedIdColumn.toString(),
    ACTION_RESOLVE_STATUS_COLUMN: normalized.resolveStatusColumn.toString(),
    ACTION_RESOLVE_MATCH_COUNT_COLUMN: normalized.resolveMatchCountColumn.toString(),
    ACTION_SOURCE_LABEL_COLUMN: normalized.sourceLabelColumn.toString(),
    ACTION_SOURCE_PATH_COLUMN: normalized.sourcePathColumn.toString(),
    ACTION_SOURCE_OBJECT_NAME_COLUMN: normalized.sourceObjectNameColumn.toString()
  });
  props.setProperty(ENGINE_STATE_KEY, 'TRUE');

  ScriptApp.newTrigger('TRIGGER_ACTION_PREVIEW_BATCH_MULTI')
    .timeBased()
    .everyMinutes(normalized.triggerGapMinutes)
    .create();

  TRIGGER_ACTION_PREVIEW_BATCH_MULTI();
  return {
    success: true,
    mode: 'ACTION_PREVIEW',
    startRow: normalized.startRow,
    endRow: normalized.endRow,
    batchSize: normalized.batchSize,
    triggerGapMinutes: normalized.triggerGapMinutes,
    message: 'Action Preview started. No Drive object will be changed.'
  };
}

function TRIGGER_ACTION_PREVIEW_BATCH_MULTI() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;

  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(ENGINE_STATE_KEY) !== 'TRUE') return;

    var spreadsheetId = props.getProperty('ACTION_SPREADSHEET_ID');
    var sheetName = props.getProperty('ACTION_SHEET_NAME');
    var currentRow = parseInt(props.getProperty('ACTION_CURRENT_ROW'), 10);
    var endRow = parseInt(props.getProperty('ACTION_END_ROW'), 10);
    var batchSize = parseInt(props.getProperty('ACTION_BATCH_SIZE'), 10) || ACTION_DEFAULT_BATCH_SIZE;
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('Action sheet not found: ' + sheetName);

    if (currentRow > endRow) {
      finishActionPreviewPhase_();
      return;
    }

    var count = Math.min(batchSize, endRow - currentRow + 1);
    var config = loadActionRuntimeConfig_(props);
    var lastColumn = sheet.getLastColumn();
    var rows = sheet.getRange(currentRow, 1, count, lastColumn).getValues();
    var seen = {};
    var outputRows = [];

    for (var i = 0; i < rows.length; i++) {
      outputRows.push(buildActionPreviewResultForRow_(rows[i], config, seen, currentRow + i));
    }

    writeMappedOutputRows_(sheet, currentRow, outputRows, config.outputMapping, ACTION_OUTPUT_FIELDS);
    var nextRow = currentRow + count;
    props.setProperty('ACTION_CURRENT_ROW', nextRow.toString());
    props.setProperty('ACTION_LAST_SUCCESS_TS', Date.now().toString());

    if (nextRow > endRow) finishActionPreviewPhase_();
  } catch (err) {
    handleRuntimeError_(err, PropertiesService.getScriptProperties());
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function finishActionPreviewPhase_() {
  var props = PropertiesService.getScriptProperties();
  var pipelineEnabled = props.getProperty('PIPELINE_ENABLED') === 'TRUE';
  if (pipelineEnabled) {
    props.setProperty('PIPELINE_PHASE', 'COMPLETE');
  }
  CLEAR_TRIGGER_AND_STATE();
}

function loadActionRuntimeConfig_(props) {
  return {
    sourceObjectIdColumn: parseInt(props.getProperty('ACTION_SOURCE_OBJECT_ID_COLUMN'), 10),
    operationColumn: parseInt(props.getProperty('ACTION_OPERATION_COLUMN'), 10),
    targetColumn: parseInt(props.getProperty('ACTION_TARGET_COLUMN'), 10),
    rootIdColumn: parseInt(props.getProperty('ACTION_ROOT_ID_COLUMN'), 10),
    outputMapping: parseStoredOutputMapping_(props.getProperty('ACTION_OUTPUT_MAPPING'), ACTION_OUTPUT_FIELDS),
    pipelineMode: props.getProperty('ACTION_PIPELINE_MODE') === 'TRUE',
    resolvedIdColumn: parseInt(props.getProperty('ACTION_RESOLVED_ID_COLUMN'), 10) || 0,
    resolveStatusColumn: parseInt(props.getProperty('ACTION_RESOLVE_STATUS_COLUMN'), 10) || 0,
    resolveMatchCountColumn: parseInt(props.getProperty('ACTION_RESOLVE_MATCH_COUNT_COLUMN'), 10) || 0,
    sourceLabelColumn: parseInt(props.getProperty('ACTION_SOURCE_LABEL_COLUMN'), 10) || 0,
    sourcePathColumn: parseInt(props.getProperty('ACTION_SOURCE_PATH_COLUMN'), 10) || 0,
    sourceObjectNameColumn: parseInt(props.getProperty('ACTION_SOURCE_OBJECT_NAME_COLUMN'), 10) || 0
  };
}

function buildActionPreviewResultForRow_(row, config, seen, rowNumber) {
  var primarySourceId = String(getActionCell_(row, config.sourceObjectIdColumn) || '').trim();
  var resolvedId = config.pipelineMode
    ? String(getActionCell_(row, config.resolvedIdColumn) || '').trim()
    : '';
  var resolveStatus = config.pipelineMode
    ? String(getActionCell_(row, config.resolveStatusColumn) || '').trim().toUpperCase()
    : '';
  var resolveMatchCount = config.pipelineMode
    ? parseInt(getActionCell_(row, config.resolveMatchCountColumn), 10) || 0
    : 0;
  var sourceId = primarySourceId || (resolveStatus === 'FOUND_SINGLE' ? resolvedId : '');
  var sharedSourceLabel = config.pipelineMode
    ? String(getActionCell_(row, config.sourceLabelColumn) || '').trim().toUpperCase()
    : '';
  var sharedSourcePath = config.pipelineMode
    ? String(getActionCell_(row, config.sourcePathColumn) || '').trim()
    : '';
  var sharedObjectName = config.pipelineMode
    ? String(getActionCell_(row, config.sourceObjectNameColumn) || '').trim()
    : '';
  var operation = normalizeActionOperation_(getActionCell_(row, config.operationColumn));
  var target = String(getActionCell_(row, config.targetColumn) || '').trim();
  var rootId = String(getActionCell_(row, config.rootIdColumn) || '').trim();

  if (!operation) return actionResult_('MISSING_OPERATION', '', sourceId, target, '', '', '', 'Operation must be MOVE, COPY, RENAME, MOVE_RENAME, or DELETE.');
  if (operation !== 'DELETE' && !target) return actionResult_('MISSING_TARGET', operation, sourceId, target, '', '', '', 'Target full object path is required.');

  if (!sourceId && config.pipelineMode) {
    if (isNotFoundResolveStatus_(resolveStatus, resolveMatchCount)) {
      return actionResult_('SOURCE_NOT_FOUND', operation, '', target, '', '', '', 'Source object was not found. Action Preview was skipped.');
    }
    if (isAmbiguousResolveStatus_(resolveStatus, resolveMatchCount) || resolveMatchCount > 1) {
      return actionResult_('NEEDS_HUMAN_INPUT', operation, '', target, '', '', '', 'Resolve returned multiple candidates. Action Preview was skipped.');
    }
    return actionResult_('MISSING_SOURCE_OBJECT_ID', operation, '', target, '', '', '', 'No verified or resolved Source ObjectID is available.');
  }

  if (!sourceId) return actionResult_('MISSING_SOURCE_OBJECT_ID', operation, '', target, '', '', '', 'Source ObjectID is required.');
  if (!rootId) return actionResult_('MISSING_ROOT_ID', operation, sourceId, target, '', '', '', 'RootID is required for single-root target resolution.');

  var normalizedTarget = target.toLowerCase();
  var key = sourceId + '|' + operation + '|' + normalizedTarget;
  var sourcePlans = seen[sourceId] || [];

  if (seen[key]) {
    return actionResult_('DUPLICATE_SOURCE_REFERENCE', operation, sourceId, target, '', '', '', 'Duplicate row. The same source, operation, and target only need one action plan.');
  }

  for (var planIndex = 0; planIndex < sourcePlans.length; planIndex++) {
    var previousPlan = sourcePlans[planIndex];
    var bothAreCopy = previousPlan.operation === 'COPY' && operation === 'COPY';

    // COPY is intentionally allowed to fan out from one source object
    // to multiple different targets. Other operation combinations remain
    // single-target and are blocked when they disagree.
    if (!bothAreCopy) {
      return actionResult_('SOURCE_TARGET_CONFLICT', operation, sourceId, target, '', '', '', 'The same Source ObjectID points to a conflicting operation or target in this batch.');
    }
  }

  sourcePlans.push({
    operation: operation,
    target: normalizedTarget,
    key: key
  });
  seen[sourceId] = sourcePlans;
  seen[key] = true;

  var source = inspectDriveObjectById_(sourceId);
  if (!source.exists || !source.accessible) {
    return actionResult_(source.error || 'SOURCE_ID_INVALID_OR_DENIED', operation, sourceId, target, '', '', '', 'Source object cannot be inspected.');
  }
  if (source.trashed) {
    return actionResult_('SOURCE_TRASHED', operation, sourceId, target, '', '', '', 'Source object is in Trash.');
  }

  var finalSourceLabel = resolveFinalSourceLabel_(sharedSourceLabel, resolveStatus, resolvedId, sourceId, primarySourceId);
  var finalSourcePath = buildFinalSourcePath_(sharedSourcePath, sharedObjectName, source);

  if (operation === 'DELETE') {
    return enrichPipelineActionResult_(actionResult_('READY', operation, sourceId, '', '', '', '', 'Dry-run only. DELETE ' + source.objectType + ' "' + source.objectName + '". Row ' + rowNumber + '.'), finalSourceLabel, source, finalSourcePath);
  }

  var targetPlan = parseActionTarget_(operation, source.objectType, source.objectName, target);
  if (!targetPlan.isValid) {
    return enrichPipelineActionResult_(actionResult_('INVALID_TARGET', operation, sourceId, target, '', '', '', targetPlan.error), finalSourceLabel, source, finalSourcePath);
  }

  if (operation === 'RENAME') {
    if (source.objectName === targetPlan.objectName) {
      return enrichPipelineActionResult_(actionResult_('SKIP_ALREADY_AT_TARGET', operation, sourceId, target, source.parentId, targetPlan.objectName, '', 'The object already has the requested name.'), finalSourceLabel, source, finalSourcePath);
    }

    return enrichPipelineActionResult_(actionResult_(
      'READY',
      operation,
      sourceId,
      target,
      source.parentId,
      targetPlan.objectName,
      '',
      'Dry-run only. RENAME ' + source.objectType + ' "' + source.objectName + '" to "' + targetPlan.objectName + '". Row ' + rowNumber + '.'
    ), finalSourceLabel, source, finalSourcePath);
  }

  var parentResult = resolveFolderFromRootId_(rootId, targetPlan.parentPath, CacheService.getScriptCache());
  var targetParentId = parentResult.exists ? parentResult.folder.getId() : '';
  var targetLookup = resolveDriveObjectId_(
    rootId,
    targetPlan.fullObjectPath,
    source.objectType,
    CacheService.getScriptCache()
  );

  if (targetLookup.found && targetLookup.objectId === sourceId) {
    return enrichPipelineActionResult_(actionResult_('SKIP_ALREADY_AT_TARGET', operation, sourceId, target, targetLookup.parentId, targetPlan.objectName, '', 'The object is already at the requested target.'), finalSourceLabel, source, finalSourcePath);
  }
  if (targetLookup.found && targetLookup.objectId !== sourceId) {
    return enrichPipelineActionResult_(actionResult_('TARGET_OBJECT_CONFLICT', operation, sourceId, target, targetLookup.parentId, targetPlan.objectName, '', 'Another object already exists at the target path.'), finalSourceLabel, source, finalSourcePath);
  }
  if (targetLookup.error === 'AMBIGUOUS_FILE_NAME' || targetLookup.error === 'AMBIGUOUS_FOLDER_NAME') {
    return enrichPipelineActionResult_(actionResult_('AMBIGUOUS_TARGET_OBJECT', operation, sourceId, target, targetLookup.parentId, targetPlan.objectName, '', targetLookup.error), finalSourceLabel, source, finalSourcePath);
  }

  if (
    parentResult.exists &&
    source.parentId === targetParentId &&
    source.objectName === targetPlan.objectName
  ) {
    return enrichPipelineActionResult_(actionResult_('SKIP_ALREADY_AT_TARGET', operation, sourceId, target, targetParentId, targetPlan.objectName, '', 'The object is already in the requested parent with the requested name.'), finalSourceLabel, source, finalSourcePath);
  }

  var status = parentResult.exists ? 'READY' : 'READY_CREATE_TARGET_PARENT';
  var cleanup = operation === 'MOVE' || operation === 'MOVE_RENAME' ? 'CHECK_AFTER_MOVE' : '';
  var effectiveSteps = operation;
  if ((operation === 'MOVE' || operation === 'COPY') && targetPlan.requiresRename) {
    effectiveSteps += ' + RENAME';
  }

  var note = 'Dry-run only. ' + effectiveSteps + ' ' + source.objectType + ' "' + source.objectName + '"';
  note += parentResult.exists
    ? ' to parent ID ' + targetParentId + '.'
    : ' after creating target parent path "' + targetPlan.parentPath + '".';
  if (targetPlan.requiresRename) {
    note += ' Rename to "' + targetPlan.objectName + '".';
  }
  note += ' Row ' + rowNumber + '.';

  return enrichPipelineActionResult_(actionResult_(status, operation, sourceId, target, targetParentId, targetPlan.objectName, cleanup, note), finalSourceLabel, source, finalSourcePath);
}


function resolveFinalSourceLabel_(sharedSourceLabel, resolveStatus, resolvedId, sourceId, primarySourceId) {
  if (sharedSourceLabel === 'RESOLVE' || sharedSourceLabel === 'VERIFY') {
    return sharedSourceLabel;
  }

  if (resolveStatus === 'FOUND_SINGLE' && resolvedId && sourceId === resolvedId) {
    return 'RESOLVE';
  }

  return primarySourceId ? 'VERIFY' : (sourceId ? 'RESOLVE' : '');
}

function buildFinalSourcePath_(sharedSourcePath, sharedObjectName, source) {
  var parentPath = String(sharedSourcePath || '').trim().replace(/[\\/]+$/g, '');
  var objectName = String(sharedObjectName || '').trim().replace(/^[\\/]+/g, '');

  if (parentPath && objectName) return parentPath + '\\' + objectName;
  if (parentPath) return parentPath;
  if (objectName) return objectName;
  return source && source.objectPath ? source.objectPath : '';
}


function isAmbiguousResolveStatus_(status, matchCount) {
  if (status === 'NEEDS_HUMAN_INPUT') return matchCount > 0;
  return status === 'AMBIGUOUS' ||
    status === 'FOUND_MULTIPLE' ||
    status === 'MULTIPLE_MATCHES';
}

function isNotFoundResolveStatus_(status, matchCount) {
  if (status === 'NEEDS_HUMAN_INPUT' && matchCount === 0) return true;
  return status === 'NOT_FOUND' ||
    status === 'SOURCE_NOT_FOUND' ||
    status === 'NO_MATCH' ||
    status === 'UNRESOLVED' ||
    status === 'ERROR';
}

function getActionCell_(row, column) {
  return column > 0 && column <= row.length ? row[column - 1] : '';
}

function actionResult_(status, operation, sourceId, target, targetParentId, targetObjectName, cleanup, note) {
  var pipelineStatus = '';
  var finalPhase = '';

  if (status === 'NEEDS_HUMAN_INPUT') {
    pipelineStatus = 'NEEDS_HUMAN_INPUT';
    finalPhase = 'RESOLVE';
  } else if (status === 'SOURCE_NOT_FOUND' || status === 'MISSING_SOURCE_OBJECT_ID') {
    pipelineStatus = status;
    finalPhase = 'RESOLVE';
  } else if (status === 'MISSING_OPERATION' || status === 'MISSING_TARGET') {
    pipelineStatus = status;
    finalPhase = 'ACTION_PREVIEW';
  } else if (status) {
    pipelineStatus = status;
    finalPhase = 'ACTION_PREVIEW';
  }

  return {
    OperationStatus: status || '',
    Operation: operation || '',
    SourceObjectID: sourceId || '',
    Target: target || '',
    TargetParentID: targetParentId || '',
    TargetObjectName: targetObjectName || '',
    CleanupCandidate: cleanup || '',
    OperationNote: note || '',
    PipelineStatus: pipelineStatus,
    FinalSource: '',
    FinalSourceObjectID: sourceId || '',
    FinalSourceType: '',
    FinalSourcePath: '',
    FinalPhase: finalPhase,
    PipelineNote: note || ''
  };
}


function enrichPipelineActionResult_(result, finalSourceLabel, source, finalSourcePath) {
  if (!result) return result;
  result.FinalSource = finalSourceLabel || '';
  result.FinalSourceObjectID = result.SourceObjectID || '';
  result.FinalSourceType = source && source.objectType ? source.objectType : '';
  result.FinalSourcePath = finalSourcePath || (source && source.objectPath ? source.objectPath : '');
  return result;
}
