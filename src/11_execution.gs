function START_EXECUTION_FROM_SIDEBAR(config) {
  var normalized = validateExecutionConfig_(config);
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(5000)) {
    throw new Error('Another execution start request is being processed.');
  }

  var runId = '';

  try {
    var props = PropertiesService.getScriptProperties();
    recoverStaleExecutionState_(props, true);

    if (props.getProperty('EXECUTION_ACTIVE') === 'TRUE') {
      throw new Error('Execution is already running. Use Stop & Reset before starting another run.');
    }

    if (props.getProperty(ENGINE_STATE_KEY) === 'TRUE') {
      throw new Error('Automation is still active. Use Stop & Reset before starting Real Execution.');
    }

    if (props.getProperty('PIPELINE_ENABLED') === 'TRUE') {
      throw new Error('Multi-Phase is still active. Wait for it to finish or use Stop & Reset.');
    }

    var executionSpreadsheet =
      SpreadsheetApp.openById(
        normalized.spreadsheetId
      );

    var executionSheet =
      executionSpreadsheet.getSheetByName(
        normalized.sheetName
      );

    validateExecutionSheet_(
      executionSheet,
      normalized
    );

    deleteExecutionTriggers_();
    props.deleteProperty('EXECUTION_LAST_ERROR');
    runId = 'exec_' + Utilities.getUuid();
    var now = String(Date.now());

    props.setProperties({
      EXECUTION_ACTIVE: 'TRUE',
      EXECUTION_RUN_ID: runId,
      EXECUTION_CURRENT_ROW: String(normalized.startRow),
      EXECUTION_END_ROW: String(normalized.endRow),
      EXECUTION_SPREADSHEET_ID: normalized.spreadsheetId,
      EXECUTION_SHEET_NAME: normalized.sheetName,
      EXECUTION_PLAN_STATUS_COLUMN: String(normalized.planStatusColumn),
      EXECUTION_OPERATION_COLUMN: String(normalized.operationColumn),
      EXECUTION_SOURCE_ID_COLUMN: String(normalized.sourceIdColumn || ''),
      EXECUTION_SOURCE_PATH_ID_COLUMN: String(normalized.sourcePathIdColumn),
      EXECUTION_SOURCE_FILE_ID_COLUMN: String(normalized.sourceFileIdColumn),
      EXECUTION_SOURCE_OBJECT_MODE: normalized.sourceObjectMode,
      EXECUTION_TARGET_COLUMN: String(normalized.targetColumn),
      EXECUTION_ROOT_ID_COLUMN: String(normalized.rootIdColumn),
      EXECUTION_POST_VERIFY_MAPPING: JSON.stringify(normalized.postVerifyMapping),
      EXECUTION_OUTPUT_MAPPING: JSON.stringify(normalized.outputMapping),
      EXECUTION_BATCH_SIZE: String(normalized.batchSize),
      EXECUTION_CLEANUP_MODE: normalized.cleanupMode,
      EXECUTION_STARTED_AT: now,
      EXECUTION_LAST_SUCCESS_TS: now
    });
  } finally {
    lock.releaseLock();
  }

  TRIGGER_EXECUTION_BATCH_MULTI();

  return {
    success: true,
    runId: runId,
    message: 'Execution started. Run ID: ' + runId
  };
}

function VALIDATE_EXECUTION_FROM_SIDEBAR(config) {
  var n = validateExecutionConfig_(config);
  var ss = SpreadsheetApp.openById(n.spreadsheetId);
  var sh = ss.getSheetByName(n.sheetName);
  validateExecutionSheet_(sh, n);
  var rows = sh.getRange(n.startRow,1,n.endRow-n.startRow+1,sh.getLastColumn()).getValues();
  var ready=0, readyCreateTargetPath=0, blocked=0, details=[];
  for (var i=0;i<rows.length;i++) {
    var v = validateExecutionRow_(rows[i], n, n.startRow+i);
    if (v.ready) {
      ready++;
      if (v.validationStatus === 'READY_CREATE_TARGET_PATH') {
        readyCreateTargetPath++;
      }
    } else { blocked++; details.push('Row '+(n.startRow+i)+': '+v.error); }
  }
  return {success:blocked===0, readyCount:ready, readyCreateTargetPathCount:readyCreateTargetPath, blockedCount:blocked, message:'Ready: '+ready+' | READY_CREATE_TARGET_PATH: '+readyCreateTargetPath+' | Blocked: '+blocked+(details.length?'\
'+details.slice(0,10).join('\
'):'')};
}

function TRIGGER_EXECUTION_BATCH_MULTI() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;

  try {
    var p = PropertiesService.getScriptProperties();
    if (p.getProperty('EXECUTION_ACTIVE') !== 'TRUE') return;

    var ss = SpreadsheetApp.openById(p.getProperty('EXECUTION_SPREADSHEET_ID'));
    var sh = ss.getSheetByName(p.getProperty('EXECUTION_SHEET_NAME'));
    if (!sh) throw new Error('Execution sheet was not found.');

    var current = parseInt(p.getProperty('EXECUTION_CURRENT_ROW'), 10);
    var end = parseInt(p.getProperty('EXECUTION_END_ROW'), 10);
    var batch = parseInt(p.getProperty('EXECUTION_BATCH_SIZE'), 10) || EXECUTION_DEFAULT_BATCH_SIZE;
    var cfg = loadExecutionConfig_(p);
    if (!current || !end || current > end) {
      finishExecution_();
      return;
    }

    var last = Math.min(end, current + batch - 1);
    var rows = sh.getRange(current, 1, last - current + 1, sh.getLastColumn()).getValues();
    var runId = p.getProperty('EXECUTION_RUN_ID');

    for (var i = 0; i < rows.length; i++) {
      var rowNumber = current + i;
      var output = executeExecutionRow_(rows[i], cfg, rowNumber, runId);

      if (output._mutationSucceeded) {
        var postVerifyOutcome =
          applyPostExecutionVerify_(
            sh,
            rowNumber,
            rows[i],
            cfg,
            output
          );

        if (!postVerifyOutcome.success) {
          output.ExecutionStatus =
            'EXECUTED_VERIFY_FAILED';

          output.ExecutionNote +=
            ' Mutation succeeded, but post-execution Verify failed: ' +
            postVerifyOutcome.error;
        }
      }

      try {
        writeMappedOutputRows_(
          sh,
          rowNumber,
          [output],
          cfg.outputMapping,
          EXECUTION_OUTPUT_FIELDS
        );
      } catch (outputWriteError) {
        if (output._mutationSucceeded) {
          checkpointExecutionRow_(
            p,
            rowNumber
          );
        }

        throw outputWriteError;
      }

      checkpointExecutionRow_(
        p,
        rowNumber
      );
    }

    if (last >= end) {
      finishExecution_();
    } else {
      scheduleExecutionTrigger_();
    }
  } catch (err) {
    finishExecution_(err && err.message ? err.message : String(err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function recoverStaleExecutionState_(props, lockAlreadyHeld) {
  if (props.getProperty('EXECUTION_ACTIVE') !== 'TRUE') return false;

  var hasTrigger = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'TRIGGER_EXECUTION_BATCH_MULTI';
  });

  var lastHeartbeat = parseInt(
    props.getProperty('EXECUTION_LAST_SUCCESS_TS') ||
    props.getProperty('EXECUTION_STARTED_AT') ||
    '0',
    10
  );

  var stale = !hasTrigger && (!lastHeartbeat || Date.now() - lastHeartbeat > 120000);
  if (!stale) return false;

  if (lockAlreadyHeld === true) {
    clearExecutionState_(props);
    return true;
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1)) return false;

  try {
    if (
      props.getProperty('EXECUTION_ACTIVE') !==
      'TRUE'
    ) {
      return false;
    }

    clearExecutionState_(props);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function clearExecutionState_(props) {
  [
    'EXECUTION_ACTIVE', 'EXECUTION_RUN_ID', 'EXECUTION_CURRENT_ROW',
    'EXECUTION_END_ROW', 'EXECUTION_SPREADSHEET_ID', 'EXECUTION_SHEET_NAME',
    'EXECUTION_PLAN_STATUS_COLUMN', 'EXECUTION_OPERATION_COLUMN',
    'EXECUTION_SOURCE_ID_COLUMN', 'EXECUTION_TARGET_COLUMN',
    'EXECUTION_ROOT_ID_COLUMN', 'EXECUTION_SOURCE_PATH_ID_COLUMN',
    'EXECUTION_SOURCE_FILE_ID_COLUMN', 'EXECUTION_SOURCE_OBJECT_MODE',
    'EXECUTION_POST_VERIFY_MAPPING',
    'EXECUTION_OUTPUT_MAPPING',
    'EXECUTION_BATCH_SIZE', 'EXECUTION_CLEANUP_MODE',
    'EXECUTION_STARTED_AT', 'EXECUTION_LAST_SUCCESS_TS'
  ].forEach(function(key) {
    props.deleteProperty(key);
  });

  deleteExecutionTriggers_();
}

function deleteExecutionTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();

  for (var i = 0; i < triggers.length; i++) {
    if (
      triggers[i].getHandlerFunction() ===
      'TRIGGER_EXECUTION_BATCH_MULTI'
    ) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function scheduleExecutionTrigger_() {
  deleteExecutionTriggers_();
  ScriptApp.newTrigger('TRIGGER_EXECUTION_BATCH_MULTI')
    .timeBased()
    .after(60000)
    .create();
}

function validateExecutionSheet_(sheet, config) {
  if (!sheet) {
    throw new Error(
      'Execution sheet was not found.'
    );
  }

  if (config.endRow > sheet.getMaxRows()) {
    throw new Error(
      'Execution selection exceeds the sheet row boundary.'
    );
  }

  var highestColumn = Math.max(
    config.planStatusColumn || 0,
    config.operationColumn || 0,
    config.sourceIdColumn || 0,
    config.sourcePathIdColumn || 0,
    config.sourceFileIdColumn || 0,
    config.targetColumn || 0,
    config.rootIdColumn || 0
  );

  for (var field in config.outputMapping) {
    if (config.outputMapping.hasOwnProperty(field)) {
      highestColumn = Math.max(
        highestColumn,
        config.outputMapping[field] || 0
      );
    }
  }

  for (
    var verifyField in
      config.postVerifyMapping
  ) {
    if (
      config.postVerifyMapping.hasOwnProperty(
        verifyField
      )
    ) {
      highestColumn = Math.max(
        highestColumn,
        config.postVerifyMapping[
          verifyField
        ] || 0
      );
    }
  }

  if (highestColumn > sheet.getMaxColumns()) {
    throw new Error(
      'Execution mapping exceeds the sheet column boundary.'
    );
  }
}

function validateExecutionConfig_(config) {
  if (
    !config ||
    String(config.confirmation || '').trim().toUpperCase() !==
      EXECUTION_CONFIRMATION_TEXT
  ) {
    throw new Error(
      'Type EXECUTE to confirm real Drive mutation.'
    );
  }

  function normalizeColumn_(value, label) {
    var columnText = String(value || '').trim().toUpperCase();

    if (!isValidColumnLetter_(columnText)) {
      throw new Error(
        label + ' column is required and must contain letters only.'
      );
    }

    return convertLetterToColumn(columnText);
  }

  var startRow = parseInt(
    config.startRow,
    10
  );

  var endRow = parseInt(
    config.endRow,
    10
  );

  if (
    !startRow ||
    !endRow ||
    endRow < startRow
  ) {
    throw new Error(
      'Invalid selection.'
    );
  }

  var rawOutputMapping =
    config.outputMapping || {};

  var outputMapping = {};
  var allowedOutputFields = {};
  var seenOutputColumns = {};

  for (
    var outputFieldIndex = 0;
    outputFieldIndex < EXECUTION_OUTPUT_FIELDS.length;
    outputFieldIndex++
  ) {
    allowedOutputFields[
      EXECUTION_OUTPUT_FIELDS[outputFieldIndex]
    ] = true;
  }

  for (
    var field in rawOutputMapping
  ) {
    if (
      !rawOutputMapping.hasOwnProperty(
        field
      )
    ) {
      continue;
    }

    if (!allowedOutputFields[field]) {
      throw new Error(
        'Unknown Execution output field: ' +
        field
      );
    }

    var rawColumn =
      rawOutputMapping[field];

    if (
      rawColumn === null ||
      rawColumn === undefined ||
      String(rawColumn).trim() === ''
    ) {
      continue;
    }

    var outputColumn =
      normalizeColumn_(
        rawColumn,
        field
      );

    if (
      seenOutputColumns[
        outputColumn
      ]
    ) {
      throw new Error(
        'Duplicate Execution output column: ' +
        convertColumnToLetter_(
          outputColumn
        )
      );
    }

    seenOutputColumns[
      outputColumn
    ] = true;

    outputMapping[field] =
      outputColumn;
  }

  requireOutputMappingFields_(
    outputMapping,
    EXECUTION_REQUIRED_OUTPUT_FIELDS,
    'Execution Output'
  );

  var sourceObjectMode = String(
    config.sourceObjectMode || 'FILE'
  ).trim().toUpperCase();

  if (['FILE', 'FOLDER'].indexOf(sourceObjectMode) === -1) {
    throw new Error(
      'Execution Source Object Mode must be FILE or FOLDER.'
    );
  }

  if (
    sourceObjectMode === 'FILE' &&
    (
      !config.sourceFileIdColumn ||
      !config.sourcePathIdColumn
    )
  ) {
    throw new Error(
      'Object Result FileID and PathID mappings are required for FILE execution.'
    );
  }

  if (sourceObjectMode === 'FOLDER' && !config.sourcePathIdColumn) {
    throw new Error(
      'Object Result PathID mapping is required for FOLDER execution.'
    );
  }

  var planStatusColumn =
    normalizeColumn_(
      config.planStatusColumn,
      'Plan Status'
    );

  var operationColumn =
    normalizeColumn_(
      config.operationColumn,
      'Operation'
    );

  var sourceIdColumn =
    config.sourceIdColumn
      ? normalizeColumn_(
          config.sourceIdColumn,
          'Source ID'
        )
      : 0;

  var sourcePathIdColumn =
    config.sourcePathIdColumn
      ? normalizeColumn_(
          config.sourcePathIdColumn,
          'Object Result PathID'
        )
      : 0;

  var sourceFileIdColumn =
    config.sourceFileIdColumn
      ? normalizeColumn_(
          config.sourceFileIdColumn,
          'Object Result FileID'
        )
      : 0;

  var targetColumn =
    normalizeColumn_(
      config.targetColumn,
      'Target'
    );

  var rootIdColumn =
    normalizeColumn_(
      config.rootIdColumn,
      'RootID'
    );

  var postVerifyMapping =
    normalizeOutputMapping_(
      mergeOutputMappings_(
        normalizeVerifyOutputMappingAliases_(
          config.verifyOutputMapping || {}
        ),
        config.sharedOutputMapping || {}
      ),
      VERIFY_OUTPUT_FIELDS
    );

  requireOutputMappingFields_(
    postVerifyMapping,
    sourceObjectMode === 'FOLDER'
      ? FOLDER_POST_VERIFY_REQUIRED_FIELDS
      : FILE_POST_VERIFY_REQUIRED_FIELDS,
    'Post-execution Verify'
  );

  var protectedColumns = {};

  [
    planStatusColumn,
    operationColumn,
    sourceIdColumn,
    sourcePathIdColumn,
    sourceFileIdColumn,
    targetColumn,
    rootIdColumn
  ].forEach(function(column) {
    if (column > 0) {
      protectedColumns[column] = true;
    }
  });

  for (var outputField in outputMapping) {
    if (
      outputMapping.hasOwnProperty(
        outputField
      ) &&
      protectedColumns[
        outputMapping[outputField]
      ]
    ) {
      throw new Error(
        'Execution output column overlaps an input/source/plan column: ' +
        convertColumnToLetter_(
          outputMapping[outputField]
        )
      );
    }

    for (
      var postVerifyField in
        postVerifyMapping
    ) {
      if (
        postVerifyMapping.hasOwnProperty(
          postVerifyField
        ) &&
        outputMapping[outputField] ===
          postVerifyMapping[
            postVerifyField
          ]
      ) {
        throw new Error(
          'Execution output column overlaps post-execution Verify output: ' +
          convertColumnToLetter_(
            outputMapping[outputField]
          )
        );
      }
    }
  }

  var spreadsheetId = String(
    config.spreadsheetId || ''
  ).trim();

  var sheetName = String(
    config.sheetName || ''
  ).trim();

  if (!spreadsheetId || !sheetName) {
    throw new Error(
      'Execution spreadsheet/sheet context is required.'
    );
  }

  return {
    spreadsheetId:
      spreadsheetId,
    sheetName:
      sheetName,
    startRow:
      startRow,
    endRow:
      endRow,
    planStatusColumn:
      planStatusColumn,
    operationColumn:
      operationColumn,
    sourceIdColumn:
      sourceIdColumn,
    sourcePathIdColumn:
      sourcePathIdColumn,
    sourceFileIdColumn:
      sourceFileIdColumn,
    sourceObjectMode:
      sourceObjectMode,
    targetColumn:
      targetColumn,
    rootIdColumn:
      rootIdColumn,
    postVerifyMapping:
      postVerifyMapping,
    outputMapping:
      outputMapping,
    cleanupMode:
      normalizeExecutionCleanupMode_(
        config.cleanupMode
      ),
    batchSize:
      Math.max(
        EXECUTION_MIN_BATCH_SIZE,
        Math.min(
          EXECUTION_MAX_BATCH_SIZE,
          parseInt(
            config.batchSize,
            10
          ) ||
          EXECUTION_DEFAULT_BATCH_SIZE
        )
      )
  };
}
function loadExecutionConfig_(props) {
  return {
    planStatusColumn: +props.getProperty('EXECUTION_PLAN_STATUS_COLUMN'),
    operationColumn: +props.getProperty('EXECUTION_OPERATION_COLUMN'),
    sourceIdColumn: +props.getProperty('EXECUTION_SOURCE_ID_COLUMN'),
    sourcePathIdColumn: +props.getProperty('EXECUTION_SOURCE_PATH_ID_COLUMN'),
    sourceFileIdColumn: +props.getProperty('EXECUTION_SOURCE_FILE_ID_COLUMN'),
    sourceObjectMode: props.getProperty('EXECUTION_SOURCE_OBJECT_MODE') || 'FILE',
    targetColumn: +props.getProperty('EXECUTION_TARGET_COLUMN'),
    rootIdColumn: +props.getProperty('EXECUTION_ROOT_ID_COLUMN'),
    postVerifyMapping: JSON.parse(
      props.getProperty('EXECUTION_POST_VERIFY_MAPPING') || '{}'
    ),
    outputMapping: JSON.parse(
      props.getProperty('EXECUTION_OUTPUT_MAPPING') || '{}'
    ),
    cleanupMode:
      normalizeExecutionCleanupMode_(
        props.getProperty('EXECUTION_CLEANUP_MODE')
      )
  };
}
function cell_(r,c){return c>0&&c<=r.length?r[c-1]:'';}
function validateExecutionRow_(r,c,rowNo) {
  var status = String(
    cell_(r, c.planStatusColumn) || ''
  ).trim().toUpperCase();

  if (
    EXECUTION_ALLOWED_PLAN_STATUSES.indexOf(
      status
    ) < 0
  ) {
    return {
      ready: false,
      error:
        'Plan status is not executable: ' +
        status
    };
  }

  var op = normalizeActionOperation_(
    cell_(r, c.operationColumn)
  );

  if (!op) {
    return {
      ready: false,
      error: 'Invalid operation'
    };
  }

  var sourceColumn = c.sourceObjectMode === 'FOLDER'
    ? c.sourcePathIdColumn
    : c.sourceFileIdColumn;

  var id = String(
    cell_(r, sourceColumn) || ''
  ).trim();

  if (!id) {
    return {
      ready: false,
      error:
        'Missing ' +
        c.sourceObjectMode +
        ' source ID in Object Result'
    };
  }

  var snap = inspectDriveObjectById_(id);

  if (
    !snap.exists ||
    !snap.accessible ||
    snap.trashed
  ) {
    return {
      ready: false,
      error:
        snap.error ||
        'Source unavailable'
    };
  }

  var expectedSourceType = String(
    c.sourceObjectMode || ''
  ).trim().toLowerCase();

  if (snap.objectType !== expectedSourceType) {
    return {
      ready: false,
      error:
        'Source type mismatch: expected ' +
        expectedSourceType +
        ', found ' +
        snap.objectType
    };
  }

  var target = String(
    cell_(r, c.targetColumn) || ''
  ).trim();

  var root = String(
    cell_(r, c.rootIdColumn) || ''
  ).trim();

  if (op !== 'DELETE' && !target) {
    return {
      ready: false,
      error: 'Missing target'
    };
  }

  if (
    op !== 'RENAME' &&
    op !== 'DELETE' &&
    !root
  ) {
    return {
      ready: false,
      error: 'Missing RootID'
    };
  }

  var plan = parseActionTarget_(
    op,
    snap.objectType,
    snap.objectName,
    target
  );

  if (!plan || !plan.isValid) {
    return {
      ready: false,
      error:
        (plan && plan.error) ||
        'Invalid target plan'
    };
  }

  var runtimeTarget = null;
  var targetPathState = null;
  var validationStatus = 'READY';

  if (
    op !== 'RENAME' &&
    op !== 'DELETE'
  ) {
    targetPathState =
      inspectExecutionTargetPath_(
        root,
        plan,
        snap.objectType
      );

    if (!targetPathState.isValid) {
      return {
        ready: false,
        error:
          targetPathState.error ||
          'Target validation failed'
      };
    }

    runtimeTarget =
      targetPathState.runtimeTarget;

    if (
      runtimeTarget.found &&
      runtimeTarget.objectId ===
        snap.objectId
    ) {
      return {
        ready: false,
        error:
          'Source is already at the requested target'
      };
    }

    if (
      runtimeTarget.found &&
      runtimeTarget.objectId !==
        snap.objectId
    ) {
      var canMerge =
        snap.objectType === 'folder' &&
        runtimeTarget.objectType ===
          'folder';

      if (!canMerge) {
        return {
          ready: false,
          error:
            'Target object already exists and cannot be merged'
        };
      }

      validationStatus =
        'READY_MERGE_TARGET';
    } else if (
      targetPathState.requiresPathCreation
    ) {
      validationStatus =
        'READY_CREATE_TARGET_PATH';
    }
  }

  return {
    ready: true,
    validationStatus:
      validationStatus,
    operation: op,
    source: snap,
    target: target,
    rootId: root,
    plan: plan,
    runtimeTarget: runtimeTarget,
    targetPathState: targetPathState
  };
}

function inspectExecutionTargetPath_(
  rootId,
  plan,
  sourceObjectType
) {
  var normalizedRootId = String(
    rootId || ''
  ).trim();

  var sourceType = String(
    sourceObjectType || ''
  ).trim().toLowerCase();

  var parentPath =
    normalizePathForTraversal_(
      plan.parentPath
    );

  var objectName = String(
    plan.objectName || ''
  ).trim();

  var parentSegments = parentPath
    ? parentPath.split('\\')
    : [];

  var pathSegments =
    parentSegments.concat(
      objectName ? [objectName] : []
    );

  for (
    var segmentIndex = 0;
    segmentIndex < pathSegments.length;
    segmentIndex++
  ) {
    var pathSegment = String(
      pathSegments[segmentIndex] || ''
    ).trim();

    if (
      !pathSegment ||
      pathSegment === '.' ||
      pathSegment === '..' ||
      /[\u0000-\u001f]/.test(
        pathSegment
      )
    ) {
      return {
        isValid: false,
        error:
          'TARGET_PATH_MALFORMED',
        runtimeTarget: null
      };
    }
  }

  var currentFolder;

  try {
    currentFolder =
      DriveApp.getFolderById(
        normalizedRootId
      );
  } catch (rootError) {
    return {
      isValid: false,
      error:
        'ROOT_INVALID_OR_INACCESSIBLE',
      runtimeTarget: null
    };
  }

  var missingParentSegments = [];

  try {
    for (
      var i = 0;
      i < parentSegments.length;
      i++
    ) {
      var segment =
        parentSegments[i];

      var matchingFolders =
        currentFolder.getFoldersByName(
          segment
        );

      if (!matchingFolders.hasNext()) {
        var conflictingFiles =
          currentFolder.getFilesByName(
            segment
          );

        if (conflictingFiles.hasNext()) {
          return {
            isValid: false,
            error:
              'TARGET_PATH_TYPE_CONFLICT: ' +
              segment,
            runtimeTarget: null
          };
        }

        missingParentSegments =
          parentSegments.slice(i);
        break;
      }

      var nextFolder =
        matchingFolders.next();

      if (matchingFolders.hasNext()) {
        return {
          isValid: false,
          error:
            'AMBIGUOUS_TARGET_FOLDER: ' +
            segment,
          runtimeTarget: null
        };
      }

      currentFolder = nextFolder;
    }
  } catch (pathError) {
    return {
      isValid: false,
      error:
        'TARGET_PATH_PERMISSION_OR_BOUNDARY_ERROR',
      runtimeTarget: null
    };
  }

  var deepestExistingParentId =
    currentFolder.getId();

  var runtimeTarget = {
    found: false,
    objectId: '',
    objectType: sourceType,
    objectName: objectName,
    parentId:
      deepestExistingParentId,
    error: 'OBJECT_NOT_FOUND'
  };

  if (missingParentSegments.length) {
    return {
      isValid: true,
      error: '',
      runtimeTarget: runtimeTarget,
      deepestExistingParentId:
        deepestExistingParentId,
      missingParentPath:
        missingParentSegments.join('\\'),
      requiresPathCreation: true
    };
  }

  try {
    var expectedMatches =
      sourceType === 'folder'
        ? currentFolder.getFoldersByName(
            objectName
          )
        : currentFolder.getFilesByName(
            objectName
          );

    if (expectedMatches.hasNext()) {
      var expectedObject =
        expectedMatches.next();

      if (expectedMatches.hasNext()) {
        return {
          isValid: false,
          error:
            'AMBIGUOUS_TARGET_OBJECT: ' +
            objectName,
          runtimeTarget: null
        };
      }

      runtimeTarget = {
        found: true,
        objectId:
          expectedObject.getId(),
        objectType: sourceType,
        objectName:
          expectedObject.getName(),
        parentId:
          deepestExistingParentId,
        error: ''
      };
    } else {
      var conflictingMatches =
        sourceType === 'folder'
          ? currentFolder.getFilesByName(
              objectName
            )
          : currentFolder.getFoldersByName(
              objectName
            );

      if (conflictingMatches.hasNext()) {
        return {
          isValid: false,
          error:
            'TARGET_OBJECT_TYPE_CONFLICT: ' +
            objectName,
          runtimeTarget: null
        };
      }
    }
  } catch (targetError) {
    return {
      isValid: false,
      error:
        'TARGET_OBJECT_PERMISSION_OR_BOUNDARY_ERROR',
      runtimeTarget: null
    };
  }

  return {
    isValid: true,
    error: '',
    runtimeTarget: runtimeTarget,
    deepestExistingParentId:
      deepestExistingParentId,
    missingParentPath: '',
    requiresPathCreation:
      sourceType === 'folder' &&
      !runtimeTarget.found
  };
}
function executeExecutionRow_(row, config, rowNumber, runId) {
  var validation = validateExecutionRow_(
    row,
    config,
    rowNumber
  );

  var executedAt =
    new Date().toISOString();

  if (!validation.ready) {
    return execResult_(
      'BLOCKED',
      runId,
      executedAt,
      validation.error
    );
  }

  try {
    var operation =
      validation.operation;

    var source =
      validation.source;

    var plan =
      validation.plan;

    if (operation === 'DELETE') {
      trashDriveObject_(
        source.objectId
      );

      return execResult_(
        'EXECUTED',
        runId,
        executedAt,
        'DELETE completed.'
      );
    }

    if (operation === 'RENAME') {
      renameDriveObject_(
        source.objectId,
        plan.objectName
      );

      return execMutationResult_(
        runId,
        executedAt,
        'RENAME completed.',
        validation,
        source.objectId
      );
    }

    var runtimeTarget =
      validation.runtimeTarget;

    var canMergeFolder =
      source.objectType === 'folder' &&
      runtimeTarget.found &&
      runtimeTarget.objectType === 'folder' &&
      runtimeTarget.objectId !== source.objectId;

    if (canMergeFolder) {
      var mergeResult;

      if (
        operation === 'COPY' ||
        operation === 'COPY_RENAME'
      ) {
        mergeResult =
          copyFolderContentsIntoTarget_(
            source.objectId,
            runtimeTarget.objectId
          );
      } else {
        mergeResult =
          moveFolderContentsIntoTarget_(
            source.objectId,
            runtimeTarget.objectId
          );
      }

      var mergeCleanupNote = '';

      if (
        operation === 'MOVE' ||
        operation === 'MOVE_RENAME'
      ) {
        var sourceParentId =
          source.parentId || '';

        try {
          DriveApp
            .getFolderById(
              source.objectId
            )
            .setTrashed(true);
        } catch (trashErr) {
          mergeCleanupNote =
            ' Source folder could not be trashed: ' +
            (
              trashErr &&
              trashErr.message
                ? trashErr.message
                : String(trashErr)
            );
        }

        var mergeCleanup =
          cleanupEmptySourceFolders_({
            cleanupMode:
              config.cleanupMode,
            oldParentId:
              sourceParentId,
            rootId:
              validation.rootId,
            targetParentId:
              runtimeTarget.parentId,
            movedObjectId:
              runtimeTarget.objectId,
            ignoreSystemJunk:
              true
          });

        if (mergeCleanup.note) {
          mergeCleanupNote +=
            ' ' +
            mergeCleanup.note;
        }
      }

      return execMutationResult_(
        runId,
        executedAt,
        operation +
        ' folder merge completed. ' +
        mergeResult.note +
        mergeCleanupNote,
        validation,
        runtimeTarget.objectId
      );
    }

    if (
      runtimeTarget.found &&
      runtimeTarget.objectId !==
        source.objectId
    ) {
      return execResult_(
        'BLOCKED',
        runId,
        executedAt,
        'Target object already exists and cannot be merged.'
      );
    }

    var targetParent =
      ensureDriveFolderPath_(
        validation.targetPathState
          .deepestExistingParentId,
        validation.targetPathState
          .missingParentPath
      );

    var targetParentId =
      targetParent.getId();

    if (
      operation === 'COPY' ||
      operation === 'COPY_RENAME'
    ) {
      var copyIgnoredStats = {
        ignoredFileCount: 0,
        ignoredFileNames: []
      };

      var copiedId =
        copyDriveObject_(
          source.objectId,
          targetParentId,
          plan.objectName,
          copyIgnoredStats
        );

      var copyNote =
        operation +
        ' completed. New ID: ' +
        copiedId;

      var copyIgnoredNote =
        formatIgnoredSystemJunkFilesNote_(
          copyIgnoredStats
        );

      if (copyIgnoredNote) {
        copyNote += ' ' +
          copyIgnoredNote;
      }

      return execMutationResult_(
        runId,
        executedAt,
        copyNote,
        validation,
        copiedId
      );
    }

    var oldParentId =
      source.parentId || '';

    var moveIgnoredStats = {
      ignoredFileCount: 0,
      ignoredFileNames: []
    };

    if (source.objectType === 'folder') {
      trashIgnoredSystemJunkFilesRecursive_(
        DriveApp.getFolderById(
          source.objectId
        ),
        moveIgnoredStats
      );
    }

    moveDriveObject_(
      source.objectId,
      targetParentId
    );

    if (plan.requiresRename) {
      renameDriveObject_(
        source.objectId,
        plan.objectName
      );
    }

    var cleanupResult =
      cleanupEmptySourceFolders_({
        cleanupMode:
          config.cleanupMode,
        oldParentId:
          oldParentId,
        rootId:
          validation.rootId,
        targetParentId:
          targetParentId,
        movedObjectId:
          source.objectId,
        ignoreSystemJunk:
          source.objectType === 'folder'
      });

    var note =
      operation +
      ' completed.';

    if (cleanupResult.note) {
      note += ' ' +
        cleanupResult.note;
    }

    var moveIgnoredNote =
      formatIgnoredSystemJunkFilesNote_(
        moveIgnoredStats
      );

    if (moveIgnoredNote) {
      note += ' ' +
        moveIgnoredNote;
    }

    return execMutationResult_(
      runId,
      executedAt,
      note,
      validation,
      source.objectId
    );
  } catch (err) {
    return execResult_(
      'FAILED',
      runId,
      executedAt,
      err && err.message
        ? err.message
        : String(err)
    );
  }
}

function execMutationResult_(
  runId,
  executedAt,
  note,
  validation,
  targetObjectId
) {
  var result = execResult_(
    'EXECUTED',
    runId,
    executedAt,
    note
  );

  result._mutationSucceeded = true;
  result._postVerifyContext = {
    operation: validation.operation,
    rootId: validation.rootId,
    target: validation.target,
    plan: validation.plan,
    sourceObjectType:
      validation.source.objectType,
    targetObjectId:
      targetObjectId
  };

  return result;
}

function checkpointExecutionRow_(
  props,
  rowNumber
) {
  props.setProperties({
    EXECUTION_CURRENT_ROW:
      String(rowNumber + 1),
    EXECUTION_LAST_SUCCESS_TS:
      String(Date.now())
  });
}

function applyPostExecutionVerify_(
  sheet,
  rowNumber,
  row,
  config,
  executionOutput
) {
  var verifyOutput;

  try {
    verifyOutput =
      buildPostExecutionVerifyOutput_(
        row,
        config,
        executionOutput
      );
  } catch (verifyError) {
    verifyOutput =
      buildPostExecutionVerifyFailure_(
        config,
        verifyError &&
          verifyError.message
          ? verifyError.message
          : String(verifyError)
      );
  }

  try {
    writePostExecutionVerifyOutput_(
      sheet,
      rowNumber,
      verifyOutput,
      config.postVerifyMapping
    );
  } catch (writeError) {
    return {
      success: false,
      error:
        'VERIFY_OUTPUT_WRITE_FAILED: ' +
        (
          writeError &&
          writeError.message
            ? writeError.message
            : String(writeError)
        )
    };
  }

  return {
    success:
      verifyOutput.Exists === true,
    error:
      verifyOutput.Error ||
      (
        verifyOutput.Exists === true
          ? ''
          : 'TARGET_NOT_VERIFIED'
      )
  };
}

function buildPostExecutionVerifyOutput_(
  row,
  config,
  executionOutput
) {
  var context =
    executionOutput._postVerifyContext;

  if (
    !context ||
    !context.targetObjectId
  ) {
    throw new Error(
      'POST_VERIFY_CONTEXT_MISSING'
    );
  }

  var rawTarget = String(
    cell_(row, config.targetColumn) || ''
  ).trim();

  if (!rawTarget) {
    throw new Error(
      'POST_VERIFY_TARGET_MISSING'
    );
  }

  var targetColumnLetter =
    convertColumnToLetter_(
      config.targetColumn
    );

  var sourceType = String(
    context.sourceObjectType || ''
  ).trim().toLowerCase();

  var targetObjectId = String(
    context.targetObjectId || ''
  ).trim();

  var verifiedPath =
    normalizePathForTraversal_(
      context.plan.fullObjectPath ||
      rawTarget
    );

  var objectId = '';
  var parentId = '';

  if (context.operation === 'RENAME') {
    var renamedObject =
      inspectDriveObjectById_(
        targetObjectId
      );

    if (
      !renamedObject.exists ||
      !renamedObject.accessible ||
      renamedObject.trashed
    ) {
      throw new Error(
        renamedObject.error ||
        'RENAMED_TARGET_NOT_ACCESSIBLE'
      );
    }

    if (
      renamedObject.objectType !==
        sourceType ||
      renamedObject.objectName !==
        context.plan.objectName
    ) {
      throw new Error(
        'RENAMED_TARGET_MISMATCH'
      );
    }

    objectId =
      renamedObject.objectId;
    parentId =
      renamedObject.parentId || '';
    verifiedPath =
      normalizePathForTraversal_(
        rawTarget
      );
  } else {
    var targetResolution =
      resolveDriveObjectId_(
        context.rootId,
        context.plan.fullObjectPath,
        sourceType,
        CacheService.getScriptCache()
      );

    if (!targetResolution.found) {
      throw new Error(
        targetResolution.error ||
        'TARGET_NOT_FOUND_AFTER_MUTATION'
      );
    }

    if (
      targetResolution.objectId !==
        targetObjectId
    ) {
      throw new Error(
        'TARGET_OBJECT_ID_MISMATCH'
      );
    }

    objectId =
      targetResolution.objectId;
    parentId =
      targetResolution.parentId || '';
  }

  var fileId =
    sourceType === 'file'
      ? objectId
      : '';

  var pathId =
    sourceType === 'folder'
      ? objectId
      : parentId;

  return buildVerifyOutputObject_(
    true,
    sourceType,
    1,
    targetColumnLetter,
    fileId,
    pathId,
    verifiedPath,
    ''
  );
}

function buildPostExecutionVerifyFailure_(
  config,
  errorMessage
) {
  return buildVerifyOutputObject_(
    false,
    '',
    1,
    convertColumnToLetter_(
      config.targetColumn
    ),
    '',
    '',
    '',
    errorMessage ||
      'POST_EXECUTION_VERIFY_FAILED'
  );
}

function writePostExecutionVerifyOutput_(
  sheet,
  rowNumber,
  rowObject,
  mapping
) {
  for (
    var fieldIndex = 0;
    fieldIndex < VERIFY_OUTPUT_FIELDS.length;
    fieldIndex++
  ) {
    var field =
      VERIFY_OUTPUT_FIELDS[fieldIndex];

    if (!mapping[field]) {
      continue;
    }

    sheet
      .getRange(
        rowNumber,
        mapping[field],
        1,
        1
      )
      .setValue(
        getMappedValue_(
          rowObject,
          field
        )
      );
  }
}

function normalizeExecutionCleanupMode_(value) {
  var mode = String(
    value || 'EMPTY_SOURCE_ANCESTORS'
  ).trim().toUpperCase();

  var allowed = [
    'NONE',
    'EMPTY_SOURCE_PARENT',
    'EMPTY_SOURCE_ANCESTORS'
  ];

  return allowed.indexOf(mode) >= 0
    ? mode
    : 'EMPTY_SOURCE_ANCESTORS';
}

function cleanupEmptySourceFolders_(options) {
  var mode =
    normalizeExecutionCleanupMode_(
      options.cleanupMode
    );

  if (
    mode === 'NONE' ||
    !options.oldParentId
  ) {
    return {
      removedCount: 0,
      note: 'Source cleanup disabled.'
    };
  }

  var rootId =
    String(options.rootId || '').trim();

  var targetParentId =
    String(options.targetParentId || '').trim();

  var movedObjectId =
    String(options.movedObjectId || '').trim();

  var currentId =
    String(options.oldParentId || '').trim();

  var removed = [];
  var retainedReason = '';

  while (currentId) {
    if (
      currentId === rootId
    ) {
      retainedReason =
        'Cleanup stopped at RootID.';
      break;
    }

    if (
      currentId === targetParentId ||
      currentId === movedObjectId
    ) {
      retainedReason =
        'Cleanup stopped at a protected folder.';
      break;
    }

    var folder;

    try {
      folder =
        DriveApp.getFolderById(
          currentId
        );
    } catch (err) {
      retainedReason =
        'Cleanup stopped because a source folder could not be opened.';
      break;
    }

    var parentId =
      getFirstParentFolderId_(
        folder
      );

    if (
      !isDriveFolderEmpty_(
        folder,
        options.ignoreSystemJunk === true
      )
    ) {
      retainedReason =
        'Source folder retained because it is not empty.';
      break;
    }

    folder.setTrashed(
      true
    );

    removed.push(
      currentId
    );

    if (
      mode ===
      'EMPTY_SOURCE_PARENT'
    ) {
      break;
    }

    currentId =
      parentId;
  }

  if (removed.length) {
    return {
      removedCount:
        removed.length,
      note:
        'Moved ' +
        removed.length +
        ' empty source folder(s) to Trash.' +
        (
          retainedReason
            ? ' ' + retainedReason
            : ''
        )
    };
  }

  return {
    removedCount: 0,
    note:
      retainedReason ||
      'No empty source folder was removed.'
  };
}

function isDriveFolderEmpty_(
  folder,
  ignoreSystemJunk
) {
  var files = folder.getFiles();

  while (files.hasNext()) {
    var file = files.next();

    if (
      !ignoreSystemJunk ||
      !isIgnoredSystemJunkFile_(file)
    ) {
      return false;
    }
  }

  var folders = folder.getFolders();

  while (folders.hasNext()) {
    if (
      !isDriveFolderEmpty_(
        folders.next(),
        ignoreSystemJunk
      )
    ) {
      return false;
    }
  }

  return true;
}

function getFirstParentFolderId_(folder) {
  var parents =
    folder.getParents();

  return parents.hasNext()
    ? parents.next().getId()
    : '';
}

function execResult_(s,id,at,n){return {ExecutionStatus:s,ExecutionRunID:id,ExecutedAt:at,ExecutionNote:n};}
function finishExecution_(errorMessage) {
  var p = PropertiesService.getScriptProperties();
  p.setProperty('EXECUTION_ACTIVE', 'FALSE');
  if (errorMessage) p.setProperty('EXECUTION_LAST_ERROR', errorMessage);
  deleteExecutionTriggers_();
}
