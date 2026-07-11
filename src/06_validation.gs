function normalizeBaseRunConfig_(config, phase) {
  var source = config || {};
  var startRow = Number(source.startRow || 2);
  var endRow = Number(source.endRow || source.startRow || 2);
  var rowRanges = parseRowRanges_(source.rowRanges, startRow, endRow);
  var normalized = {
    phase: phase,
    sheetName: asText_(source.sheetName),
    startRow: rowRanges[0].startRow,
    endRow: rowRanges[rowRanges.length - 1].endRow,
    rowRanges: rowRanges,
    batchSize: Number(source.batchSize || VERRACT_DEFAULT_BATCH_SIZE),
    continuationGapMinutes: normalizeContinuationGapMinutes_(source.continuationGapMinutes),
    rootIdColumn: letterToColumn_(source.rootIdColumn),
    pathColumns: parseColumnSpec_(source.pathColumns),
    filenameColumn: letterToColumn_(source.filenameColumn),
    extensionColumn: asText_(source.extensionColumn) ? letterToColumn_(source.extensionColumn) : null,
    skipExistingTrue: !!source.skipExistingTrue,
    verifyMapping: buildColumnMapping_(source.verifyMapping, VERIFY_REPORT_FIELDS),
    resolveMapping: buildColumnMapping_(source.resolveMapping, RESOLVE_REPORT_FIELDS),
    sharedMapping: buildColumnMapping_(source.sharedMapping, SHARED_OUTPUT_FIELDS),
    traceMapping: buildColumnMapping_(source.traceMapping, TRACE_OUTPUT_FIELDS)
  };

  if (normalized.startRow < 2) {
    throw new Error('Start row must be 2 or greater.');
  }

  if (normalized.endRow < normalized.startRow) {
    throw new Error('End row must be greater than or equal to start row.');
  }

  if (!normalized.pathColumns.length) {
    throw new Error('Candidate Path Columns is required.');
  }

  if (normalized.batchSize < 1) normalized.batchSize = VERRACT_DEFAULT_BATCH_SIZE;
  if (normalized.batchSize > VERRACT_MAX_BATCH_SIZE) normalized.batchSize = VERRACT_MAX_BATCH_SIZE;

  ensureMappingFields_(normalized.sharedMapping, SHARED_OUTPUT_FIELDS, 'Shared Output');

  if (phase === VERRACT_PHASE_VERIFY) {
    ensureMappingFields_(normalized.verifyMapping, ['Exists'], 'Verify Report');
  }

  if (phase === VERRACT_PHASE_RESOLVE) {
    ensureMappingFields_(normalized.verifyMapping, ['Exists'], 'Verify Report');
    ensureMappingFields_(normalized.resolveMapping, ['ResolveStatus'], 'Resolve Report');
  }

  return normalized;
}


function normalizeContinuationGapMinutes_(value) {
  var gap = Number(value);

  if (!isFinite(gap) || gap < VERRACT_MIN_CONTINUATION_GAP_MINUTES) {
    gap = VERRACT_DEFAULT_CONTINUATION_GAP_MINUTES;
  }

  if (gap > VERRACT_MAX_CONTINUATION_GAP_MINUTES) {
    gap = VERRACT_MAX_CONTINUATION_GAP_MINUTES;
  }

  return gap;
}

function parseRowRanges_(spec, fallbackStartRow, fallbackEndRow) {
  var text = asText_(spec);
  var ranges = [];

  if (!text) {
    ranges.push({
      startRow: Number(fallbackStartRow || 2),
      endRow: Number(fallbackEndRow || fallbackStartRow || 2)
    });
  } else {
    text.split(',').forEach(function(part) {
      var token = asText_(part);
      if (!token) return;

      var match = token.match(/^(\d+)(?:\s*:\s*(\d+))?$/);
      if (!match) {
        throw new Error('Invalid row range: ' + token);
      }

      var startRow = Number(match[1]);
      var endRow = Number(match[2] || match[1]);
      if (startRow < 2 || endRow < startRow) {
        throw new Error('Invalid row range: ' + token);
      }

      ranges.push({ startRow: startRow, endRow: endRow });
    });
  }

  if (!ranges.length) {
    throw new Error('At least one row range is required.');
  }

  ranges.sort(function(a, b) {
    return a.startRow - b.startRow || a.endRow - b.endRow;
  });

  var merged = [];
  ranges.forEach(function(range) {
    var last = merged.length ? merged[merged.length - 1] : null;
    if (!last || range.startRow > last.endRow + 1) {
      merged.push({ startRow: range.startRow, endRow: range.endRow });
      return;
    }
    if (range.endRow > last.endRow) last.endRow = range.endRow;
  });

  return merged;
}

function getConfigRowRanges_(config) {
  if (config && config.rowRanges && config.rowRanges.length) {
    return config.rowRanges;
  }
  return [{
    startRow: Number(config.startRow),
    endRow: Number(config.endRow)
  }];
}

function getRunSheet_(config) {
  var ss = SpreadsheetApp.getActive();
  return config.sheetName ? ss.getSheetByName(config.sheetName) : ss.getActiveSheet();
}

function isRowHiddenForRun_(sheet, row) {
  return !!(
    sheet.isRowHiddenByFilter(row) ||
    sheet.isRowHiddenByUser(row)
  );
}

function buildInputFromRow_(rowValues, config) {
  var rootId = asText_(getCellFromRow_(rowValues, config.rootIdColumn));
  var filename = mergeFilename_(
    getCellFromRow_(rowValues, config.filenameColumn),
    config.extensionColumn ? getCellFromRow_(rowValues, config.extensionColumn) : ''
  );

  var candidates = config.pathColumns.map(function(column) {
    return {
      column: column,
      columnLetter: columnToLetter_(column),
      path: asText_(getCellFromRow_(rowValues, column))
    };
  }).filter(function(candidate) {
    return !!candidate.path;
  });

  return {
    rootId: rootId,
    filename: filename,
    candidates: candidates
  };
}

function buildSharedObject_(pathId, fileId, path, filename, source) {
  return {
    SharedPathID: pathId || '',
    SharedFileID: fileId || '',
    SharedPath: path || '',
    SharedFilename: filename || '',
    SharedSource: source || ''
  };
}

function isVerifyTrue_(value) {
  return String(value).trim().toUpperCase() === 'TRUE';
}

function isSharedComplete_(shared) {
  return !!(asText_(shared.SharedPathID) && asText_(shared.SharedFileID));
}

function normalizeActionRunConfig_(config) {
  var source = config || {};
  var startRow = Number(source.startRow || 2);
  var endRow = Number(source.endRow || source.startRow || 2);
  var rowRanges = parseRowRanges_(source.rowRanges, startRow, endRow);
  var normalized = {
    phase: VERRACT_PHASE_ACTION,
    sheetName: asText_(source.sheetName),
    startRow: rowRanges[0].startRow,
    endRow: rowRanges[rowRanges.length - 1].endRow,
    rowRanges: rowRanges,
    batchSize: Number(source.batchSize || VERRACT_DEFAULT_BATCH_SIZE),
    rootIdColumn: letterToColumn_(source.rootIdColumn),
    targetPathColumn: letterToColumn_(source.targetPathColumn),
    operation: asText_(source.operation).toUpperCase(),
    sharedMapping: buildColumnMapping_(source.sharedMapping, SHARED_OUTPUT_FIELDS),
    actionMapping: buildColumnMapping_(source.actionMapping, ACTION_OUTPUT_FIELDS),
    traceMapping: buildColumnMapping_(source.traceMapping, TRACE_OUTPUT_FIELDS)
  };

  if (normalized.startRow < 2) {
    throw new Error('Start row must be 2 or greater.');
  }

  if (normalized.endRow < normalized.startRow) {
    throw new Error('End row must be greater than or equal to start row.');
  }

  if (normalized.batchSize < 1) normalized.batchSize = VERRACT_DEFAULT_BATCH_SIZE;
  if (normalized.batchSize > VERRACT_MAX_BATCH_SIZE) normalized.batchSize = VERRACT_MAX_BATCH_SIZE;

  if (normalized.operation !== ACTION_OPERATIONS.MOVE) {
    throw new Error('Action Operation must be MOVE.');
  }

  ensureMappingFields_(normalized.sharedMapping, ['SharedPathID'], 'Shared Output');
  ensureMappingFields_(normalized.actionMapping, ['ActionStatus', 'ActionID', 'ActionAt'], 'Action Output');

  return normalized;
}


function normalizeChainRunConfig_(config) {
  var source = config || {};
  var normalized = normalizeBaseRunConfig_(source, VERRACT_PHASE_VERIFY);

  normalized.phase = VERRACT_PHASE_CHAIN;
  normalized.enableVerify = true;
  normalized.enableResolve = !!source.enableResolve;
  normalized.enableAction = !!source.enableAction;
  normalized.traceRunPrefix = createTraceRunPrefix_();
  normalized.runPhases = buildConfiguredRunPhases_(normalized).join('|');

  if (normalized.enableResolve) {
    ensureMappingFields_(normalized.resolveMapping, ['ResolveStatus'], 'Resolve Report');
  }

  if (normalized.enableAction) {
    normalized.targetPathColumn = letterToColumn_(source.targetPathColumn);
    normalized.operation = asText_(source.operation).toUpperCase();
    normalized.actionMapping = buildColumnMapping_(source.actionMapping, ACTION_OUTPUT_FIELDS);

    if (normalized.operation !== ACTION_OPERATIONS.MOVE) {
      throw new Error('Action Operation must be MOVE.');
    }

    ensureMappingFields_(normalized.sharedMapping, ['SharedPathID'], 'Shared Output');
    ensureMappingFields_(
      normalized.actionMapping,
      ['ActionStatus', 'ActionID', 'ActionAt'],
      'Action Output'
    );
  } else {
    normalized.targetPathColumn = null;
    normalized.operation = ACTION_OPERATIONS.MOVE;
    normalized.actionMapping = buildColumnMapping_(source.actionMapping, ACTION_OUTPUT_FIELDS);
  }

  return normalized;
}

function buildConfiguredRunPhases_(config) {
  var phases = [VERRACT_PHASE_VERIFY];
  if (config.enableResolve) phases.push(VERRACT_PHASE_RESOLVE);
  if (config.enableAction) phases.push(VERRACT_PHASE_ACTION);
  return phases;
}

function disabledExecutionResponse_() {
  return {
    ok: false,
    status: 'EXECUTION_DISABLED',
    message: VERRACT_DISABLED_EXECUTION_MESSAGE
  };
}
