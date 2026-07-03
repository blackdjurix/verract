
function CREATE_ACTION_PREVIEW_TRIGGER_MULTI() {
  throw new Error('Open the verract Control Panel and start Action Preview from the Action page.');
}

function startActionPreviewAutomation_(config) {
  var normalized = normalizeActionConfig_(config);
  var props = PropertiesService.getScriptProperties();
  checkEngineHeartbeat_();

  if (props.getProperty('EXECUTION_ACTIVE') === 'TRUE') {
    throw new Error(
      'Real Execution masih aktif. Jalankan Stop & Reset dulu.'
    );
  }

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
    ACTION_SOURCE_OBJECT_ID_COLUMN: String(normalized.sourceObjectIdColumn || ''),
    ACTION_SOURCE_PATH_ID_COLUMN: String(normalized.sourcePathIdColumn || ''),
    ACTION_SOURCE_FILE_ID_COLUMN: String(normalized.sourceFileIdColumn || ''),
    ACTION_SOURCE_OBJECT_MODE: normalized.sourceObjectMode,
    ACTION_OPERATION_MODE: normalized.operationMode,
    ACTION_OPERATION_VALUE: normalized.operationValue || '',
    ACTION_OPERATION_COLUMN: String(normalized.operationColumn || ''),
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
    ACTION_SOURCE_OBJECT_MODE: normalized.sourceObjectMode,
    ACTION_VERIFY_EXISTS_COLUMN: String(normalized.verifyExistsColumn || ''),
    ACTION_VERIFY_FILE_ID_COLUMN: String(normalized.verifyFileIdColumn || ''),
    ACTION_VERIFY_PATH_ID_COLUMN: String(normalized.verifyPathIdColumn || ''),
    ACTION_RESOLVED_ID_COLUMN: String(normalized.resolvedIdColumn || ''),
    ACTION_RESOLVE_STATUS_COLUMN: String(normalized.resolveStatusColumn || ''),
    ACTION_RESOLVE_MATCH_COUNT_COLUMN: String(normalized.resolveMatchCountColumn || '')
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

    writeMappedOutputRows_(
      sheet,
      currentRow,
      outputRows,
      config.outputMapping,
      config.pipelineMode
        ? ACTION_RUNTIME_OUTPUT_FIELDS
        : ACTION_OUTPUT_FIELDS
    );
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
    sourceObjectIdColumn: parseInt(props.getProperty('ACTION_SOURCE_OBJECT_ID_COLUMN'), 10) || 0,
    sourcePathIdColumn: parseInt(props.getProperty('ACTION_SOURCE_PATH_ID_COLUMN'), 10) || 0,
    sourceFileIdColumn: parseInt(props.getProperty('ACTION_SOURCE_FILE_ID_COLUMN'), 10) || 0,
    sourceObjectMode: props.getProperty('ACTION_SOURCE_OBJECT_MODE') || 'FILE',
    operationMode: props.getProperty('ACTION_OPERATION_MODE') || 'SINGLE',
    operationValue: props.getProperty('ACTION_OPERATION_VALUE') || '',
    operationColumn: parseInt(props.getProperty('ACTION_OPERATION_COLUMN'), 10) || 0,
    targetColumn: parseInt(props.getProperty('ACTION_TARGET_COLUMN'), 10),
    rootIdColumn: parseInt(props.getProperty('ACTION_ROOT_ID_COLUMN'), 10),
    pipelineMode: props.getProperty('ACTION_PIPELINE_MODE') === 'TRUE',
    outputMapping: parseStoredOutputMapping_(
      props.getProperty('ACTION_OUTPUT_MAPPING'),
      props.getProperty('ACTION_PIPELINE_MODE') === 'TRUE'
        ? ACTION_RUNTIME_OUTPUT_FIELDS
        : ACTION_OUTPUT_FIELDS
    )
  };
}

function buildActionPreviewResultForRow_(row, config, seen, rowNumber) {
  var sourceColumn = config.sourceObjectMode === 'FOLDER'
    ? config.sourcePathIdColumn
    : config.sourceFileIdColumn;

  var sourceId = String(getActionCell_(row, sourceColumn) || '').trim();

  var operation = config.operationMode === 'COLUMN'
    ? normalizeActionOperation_(getActionCell_(row, config.operationColumn))
    : normalizeActionOperation_(config.operationValue);
  var target = String(getActionCell_(row, config.targetColumn) || '').trim();
  var rootId = String(getActionCell_(row, config.rootIdColumn) || '').trim();

  if (!sourceId) return actionResult_('MISSING_SOURCE_OBJECT_ID', operation, '', target, '', '', '', 'Source ObjectID is required.');
  if (!operation) return actionResult_('INVALID_OPERATION', '', sourceId, target, '', '', '', 'Operation must be MOVE, COPY, RENAME, MOVE_RENAME, or DELETE.');
  if (!rootId) return actionResult_('MISSING_ROOT_ID', operation, sourceId, target, '', '', '', 'RootID is required for single-root target resolution.');
  if (operation !== 'DELETE' && !target) return actionResult_('MISSING_TARGET', operation, sourceId, target, '', '', '', 'Target full object path is required.');

  var normalizedTarget = target.toLowerCase();
  var key = sourceId + '|' + operation + '|' + normalizedTarget;
  var sourcePlans = seen[sourceId] || [];

  if (seen[key]) {
    return actionResult_('DUPLICATE_SOURCE_REFERENCE', operation, sourceId, target, '', '', '', 'Duplicate row. The same source, operation, and target only need one action plan.');
  }

  for (var planIndex = 0; planIndex < sourcePlans.length; planIndex++) {
    var previousPlan = sourcePlans[planIndex];
    var bothAreCopy =
      (previousPlan.operation === 'COPY' || previousPlan.operation === 'COPY_RENAME') &&
      (operation === 'COPY' || operation === 'COPY_RENAME');

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

  if (operation === 'DELETE') {
    return actionResult_('READY', operation, sourceId, '', '', '', '', 'Dry-run only. DELETE ' + source.objectType + ' "' + source.objectName + '". Row ' + rowNumber + '.');
  }

  var targetPlan = parseActionTarget_(operation, source.objectType, source.objectName, target);
  if (!targetPlan.isValid) {
    return actionResult_('INVALID_TARGET', operation, sourceId, target, '', '', '', targetPlan.error);
  }

  var targetPlanKey =
    'TARGET|' +
    String(rootId || '').trim() +
    '|' +
    String(targetPlan.fullObjectPath || '').trim().toLowerCase() +
    '|' +
    String(source.objectType || '').trim().toLowerCase();

  var existingTargetPlan = seen[targetPlanKey];
  var isFolderMergePlan =
    source.objectType === 'folder' &&
    existingTargetPlan &&
    existingTargetPlan.sourceId !== sourceId &&
    (
      operation === 'MOVE' ||
      operation === 'MOVE_RENAME' ||
      operation === 'COPY' ||
      operation === 'COPY_RENAME'
    );

  if (!existingTargetPlan) {
    seen[targetPlanKey] = {
      sourceId: sourceId,
      operation: operation
    };
  }

  if (operation === 'RENAME') {
    if (source.objectName === targetPlan.objectName) {
      return actionResult_('SKIP_ALREADY_AT_TARGET', operation, sourceId, target, source.parentId, targetPlan.objectName, '', 'The object already has the requested name.');
    }

    return actionResult_(
      'READY',
      operation,
      sourceId,
      target,
      source.parentId,
      targetPlan.objectName,
      '',
      'Dry-run only. RENAME ' + source.objectType + ' "' + source.objectName + '" to "' + targetPlan.objectName + '". Row ' + rowNumber + '.'
    );
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
    return actionResult_('SKIP_ALREADY_AT_TARGET', operation, sourceId, target, targetLookup.parentId, targetPlan.objectName, '', 'The object is already at the requested target.');
  }
  if (targetLookup.found && targetLookup.objectId !== sourceId) {
    var canMergeExistingFolder =
      source.objectType === 'folder' &&
      targetLookup.objectType === 'folder' &&
      (
        operation === 'MOVE' ||
        operation === 'MOVE_RENAME' ||
        operation === 'COPY' ||
        operation === 'COPY_RENAME'
      );

    if (!canMergeExistingFolder) {
      return actionResult_('TARGET_OBJECT_CONFLICT', operation, sourceId, target, targetLookup.parentId, targetPlan.objectName, '', 'Another object already exists at the target path.');
    }

    return actionResult_(
      'READY_MERGE_EXISTING_FOLDER',
      operation,
      sourceId,
      target,
      targetLookup.parentId,
      targetPlan.objectName,
      operation === 'MOVE' || operation === 'MOVE_RENAME' ? 'CHECK_AFTER_MOVE' : '',
      'Dry-run only. Merge folder "' + source.objectName + '" into existing target folder "' + targetPlan.fullObjectPath + '". Row ' + rowNumber + '.'
    );
  }
  if (targetLookup.error === 'AMBIGUOUS_FILE_NAME' || targetLookup.error === 'AMBIGUOUS_FOLDER_NAME') {
    return actionResult_('AMBIGUOUS_TARGET_OBJECT', operation, sourceId, target, targetLookup.parentId, targetPlan.objectName, '', targetLookup.error);
  }

  if (
    parentResult.exists &&
    source.parentId === targetParentId &&
    source.objectName === targetPlan.objectName
  ) {
    return actionResult_('SKIP_ALREADY_AT_TARGET', operation, sourceId, target, targetParentId, targetPlan.objectName, '', 'The object is already in the requested parent with the requested name.');
  }

  var status = isFolderMergePlan
    ? 'READY_MERGE_TARGET'
    : (parentResult.exists ? 'READY' : 'READY_CREATE_TARGET_PARENT');
  var cleanup = operation === 'MOVE' || operation === 'MOVE_RENAME' ? 'CHECK_AFTER_MOVE' : '';
  var effectiveSteps = operation;
  if ((operation === 'MOVE' || operation === 'COPY') && targetPlan.requiresRename) {
    effectiveSteps += ' + RENAME';
  }

  var note = isFolderMergePlan
    ? 'Dry-run only. Merge ' + source.objectType + ' "' + source.objectName + '" into shared target "' + targetPlan.fullObjectPath + '".'
    : 'Dry-run only. ' + effectiveSteps + ' ' + source.objectType + ' "' + source.objectName + '"';
  note += parentResult.exists
    ? ' to parent ID ' + targetParentId + '.'
    : ' after creating target parent path "' + targetPlan.parentPath + '".';
  if (targetPlan.requiresRename) {
    note += ' Rename to "' + targetPlan.objectName + '".';
  }
  note += ' Row ' + rowNumber + '.';

  return actionResult_(status, operation, sourceId, target, targetParentId, targetPlan.objectName, cleanup, note);
}

function getActionCell_(row, column) {
  return column > 0 && column <= row.length ? row[column - 1] : '';
}

function actionResult_(status, operation, sourceId, target, targetParentId, targetObjectName, cleanup, note) {
  var sourceType = '';
  var sourcePath = '';

  if (sourceId) {
    try {
      var snapshot = inspectDriveObjectById_(sourceId);
      if (snapshot && snapshot.exists && snapshot.accessible) {
        sourceType = snapshot.objectType || '';
        sourcePath = snapshot.objectName || '';
      }
    } catch (err) {}
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

    PipelineStatus: status || '',
    FinalSource: sourceId ? 'CANONICAL' : '',
    FinalSourceObjectID: sourceId || '',
    FinalSourceType: sourceType,
    FinalSourcePath: sourcePath,
    FinalPhase: 'ACTION_PREVIEW',
    PipelineNote: note || ''
  };
}

/**
 * Compatibility hook retained for the pipeline transition.
 * Object Result PathID/FileID are already the SSOT, so no materialization
 * or spreadsheet rewrite is needed here.
 */
function materializePipelineCanonicalSourceIds_(config) {
  return normalizeActionConfig_(config);
}
