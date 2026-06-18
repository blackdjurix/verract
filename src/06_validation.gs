function parseColumnSelection_(inputText) {
  if (!inputText) {
    return {
      isValid: false,
      columns: [],
      error: 'Path column input tidak boleh kosong.'
    };
  }
  var normalizedInput = inputText
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!normalizedInput) {
    return {
      isValid: false,
      columns: [],
      error: 'Path column input tidak boleh kosong.'
    };
  }
  var tokens = normalizedInput
    .split(',')
    .filter(String);
  var columns = [];
  var seen = {};
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (token.indexOf('-') !== -1) {
      var rangeParts = token.split('-');
      if (rangeParts.length !== 2) {
        return {
          isValid: false,
          columns: [],
          error: 'Format range tidak valid: ' + token
        };
      }
      var startLetter = rangeParts[0];
      var endLetter = rangeParts[1];
      if (
        !isValidColumnLetter_(startLetter) ||
        !isValidColumnLetter_(endLetter)
      ) {
        return {
          isValid: false,
          columns: [],
          error: 'Range kolom tidak valid: ' + token
        };
      }
      var firstColumn =
        convertLetterToColumn(startLetter);
      var secondColumn =
        convertLetterToColumn(endLetter);
      var startColumn = Math.min(
        firstColumn,
        secondColumn
      );
      var endColumn = Math.max(
        firstColumn,
        secondColumn
      );
      for (
        var currentColumn = startColumn;
        currentColumn <= endColumn;
        currentColumn++
      ) {
        if (!seen[currentColumn]) {
          seen[currentColumn] = true;
          columns.push(currentColumn);
        }
      }
      continue;
    }
    if (!isValidColumnLetter_(token)) {
      return {
        isValid: false,
        columns: [],
        error: 'Kolom tidak valid: ' + token
      };
    }
    var columnNumber =
      convertLetterToColumn(token);
    if (!seen[columnNumber]) {
      seen[columnNumber] = true;
      columns.push(columnNumber);
    }
  }
  if (
    columns.length <
    MIN_PATH_COLUMN_COUNT
  ) {
    return {
      isValid: false,
      columns: [],
      error:
        'Minimal pilih ' +
        MIN_PATH_COLUMN_COUNT +
        ' path column.'
    };
  }
  return {
    isValid: true,
    columns: columns,
    error: ''
  };
}

function validateFileColumn_(fileColumnText) {
  var normalized = fileColumnText
    ? fileColumnText
        .toString()
        .trim()
        .toUpperCase()
    : '';
  if (!isValidColumnLetter_(normalized)) {
    return {
      isValid: false,
      column: 0,
      error:
        'Column harus berupa huruf kolom valid.\n' +
        'Contoh: J, AA, AB'
    };
  }
  return {
    isValid: true,
    column: convertLetterToColumn(normalized),
    error: ''
  };
}

function validateOptionalExtensionColumn_(
  extensionColumnText
) {
  var normalized = extensionColumnText
    ? extensionColumnText
        .toString()
        .trim()
        .toUpperCase()
    : '';
  if (!normalized) {
    return {
      isValid: true,
      column: 0,
      error: ''
    };
  }
  if (!isValidColumnLetter_(normalized)) {
    return {
      isValid: false,
      column: 0,
      error:
        'Extension column harus berupa huruf kolom valid.\n' +
        'Contoh: H, AA, AB\n\n' +
        'Kosongkan jika extension tidak dipisah.'
    };
  }
  return {
    isValid: true,
    column: convertLetterToColumn(normalized),
    error: ''
  };
}

function validateInputColumns_(
  pathColumns,
  fileColumn,
  rootIdColumn,
  extensionColumn
) {
  if (
    !pathColumns ||
    pathColumns.length === 0
  ) {
    return {
      isValid: false,
      error:
        'Minimal satu path column harus dipilih.'
    };
  }
  if (
    fileColumn &&
    fileColumn === rootIdColumn
  ) {
    return {
      isValid: false,
      error:
        'File column dan RootID column tidak boleh sama.'
    };
  }
  if (
    extensionColumn &&
    !fileColumn
  ) {
    return {
      isValid: false,
      error:
        'Extension column hanya boleh dipakai jika File column diisi.'
    };
  }
  if (
    extensionColumn &&
    fileColumn &&
    extensionColumn === fileColumn
  ) {
    return {
      isValid: false,
      error:
        'Extension column tidak boleh sama dengan File column.'
    };
  }
  if (
    extensionColumn &&
    extensionColumn === rootIdColumn
  ) {
    return {
      isValid: false,
      error:
        'Extension column tidak boleh sama dengan RootID column.'
    };
  }
  for (
    var i = 0;
    i < pathColumns.length;
    i++
  ) {
    if (
      fileColumn &&
      pathColumns[i] === fileColumn
    ) {
      return {
        isValid: false,
        error:
          'File column tidak boleh digunakan sebagai path column.'
      };
    }
    if (pathColumns[i] === rootIdColumn) {
      return {
        isValid: false,
        error:
          'RootID column tidak boleh digunakan sebagai path column.'
      };
    }
    if (
      extensionColumn &&
      pathColumns[i] === extensionColumn
    ) {
      return {
        isValid: false,
        error:
          'Extension column tidak boleh digunakan sebagai path column.'
      };
    }
  }
  return {
    isValid: true,
    error: ''
  };
}

function confirmLargePathColumnSelection_(
  pathColumnCount
) {
  if (
    pathColumnCount <=
    PATH_COLUMN_WARNING_THRESHOLD
  ) {
    return true;
  }
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    '⚠️ Large Path Column Selection',
    'Anda memilih ' +
      pathColumnCount +
      ' path columns.\n\n' +
      'Semakin banyak path columns, semakin besar beban verifikasi.\n\n' +
      'Klik OK untuk lanjut.\n' +
      'Klik Cancel untuk membatalkan.',
    ui.ButtonSet.OK_CANCEL
  );
  return response === ui.Button.OK;
}

function validateVerifyWorkload_(
  batchSize,
  pathColumnCount
) {
  var estimatedAttempts =
    batchSize * pathColumnCount;
  if (
    estimatedAttempts <=
    MAX_VERIFY_ATTEMPTS_PER_BATCH
  ) {
    return {
      isValid: true,
      estimatedAttempts:
        estimatedAttempts,
      error: ''
    };
  }
  return {
    isValid: false,
    estimatedAttempts:
      estimatedAttempts,
    error:
      'Estimated verify attempts terlalu besar.\n\n' +
      'Batch size: ' +
      batchSize +
      '\n' +
      'Path columns: ' +
      pathColumnCount +
      '\n' +
      'Estimated attempts: ' +
      estimatedAttempts +
      '\n' +
      'Maximum allowed: ' +
      MAX_VERIFY_ATTEMPTS_PER_BATCH +
      '\n\n' +
      'Kurangi batch size atau jumlah path columns.'
  };
}

function confirmOutputDoesNotOverlapInputs_(
  pathColumns,
  fileColumn,
  rootIdColumn,
  extensionColumn,
  targetColumn,
  outputWidth
) {
  var outputStart = targetColumn;
  var outputEnd =
    targetColumn + outputWidth - 1;
var inputColumns =
  pathColumns.slice();
if (fileColumn) {
  inputColumns.push(fileColumn);
}
inputColumns.push(rootIdColumn);
if (extensionColumn) {
  inputColumns.push(extensionColumn);
}
  var overlappingColumns = [];
  var seen = {};
  for (
    var i = 0;
    i < inputColumns.length;
    i++
  ) {
    var inputColumn =
      inputColumns[i];
    if (seen[inputColumn]) {
      continue;
    }
    seen[inputColumn] = true;
    if (
      inputColumn >= outputStart &&
      inputColumn <= outputEnd
    ) {
      overlappingColumns.push(
        convertColumnToLetter_(
          inputColumn
        )
      );
    }
  }
  if (
    overlappingColumns.length === 0
  ) {
    return true;
  }
  SpreadsheetApp.getUi().alert(
    '⚠️ Output Overlaps Input',
    'Output range bertabrakan dengan input column:\n\n' +
      overlappingColumns.join(', ') +
      '\n\n' +
      'Pilih output column lain.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return false;
}

function confirmOutputWithinSheetBoundary_(
  sheet,
  targetColumn,
  outputWidth
) {
  var maxColumns =
    sheet.getMaxColumns();
  var outputEndColumn =
    targetColumn + outputWidth - 1;
  if (
    outputEndColumn <= maxColumns
  ) {
    return true;
  }
  SpreadsheetApp.getUi().alert(
    '⚠️ Output Exceeds Sheet Boundary',
    'Output membutuhkan kolom sampai ' +
      convertColumnToLetter_(
        outputEndColumn
      ) +
      ', sedangkan sheet hanya sampai ' +
      convertColumnToLetter_(
        maxColumns
      ) +
      '.\n\n' +
      'Tambahkan kolom atau pilih output column yang lebih awal.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return false;
}

function confirmNonBlankMainOutput_(
  sheet,
  startRow,
  targetColumn,
  numRows
) {
  var values = sheet
    .getRange(
      startRow,
      targetColumn,
      numRows,
      1
    )
    .getValues();
  var nonBlankCount = 0;
  for (
    var i = 0;
    i < values.length;
    i++
  ) {
    if (values[i][0] !== '') {
      nonBlankCount++;
    }
  }
  if (nonBlankCount === 0) {
    return true;
  }
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    '⚠️ Output Already Exists',
    'Ditemukan ' +
      nonBlankCount +
      ' row pada output utama yang sudah berisi data.\n' +
      'Row tersebut akan dilewati oleh sistem.\n\n' +
      'Klik OK untuk lanjut.\n' +
      'Klik Cancel untuk membatalkan.',
    ui.ButtonSet.OK_CANCEL
  );
  return response === ui.Button.OK;
}

function normalizeOutputMapping_(
  mapping,
  allowedFields,
  fallbackStartColumn
) {
  var normalized = {};
  var hasMapping =
    mapping !== null &&
    mapping !== undefined;

  if (
    !hasMapping &&
    fallbackStartColumn
  ) {
    return buildSequentialOutputMapping_(
      allowedFields,
      fallbackStartColumn
    );
  }

  if (!mapping) {
    mapping = {};
  }

  for (
    var i = 0;
    i < allowedFields.length;
    i++
  ) {
    var field = allowedFields[i];
    var columnValue = mapping[field];

    if (
      columnValue === null ||
      columnValue === undefined ||
      columnValue === ''
    ) {
      continue;
    }

    var columnNumber =
      normalizeOutputColumnValue_(
        columnValue
      );

    normalized[field] = columnNumber;
  }

  var validation =
    validateOutputMapping_(
      normalized,
      allowedFields
    );

  if (!validation.isValid) {
    throw new Error(
      validation.error
    );
  }

  return normalized;
}

function normalizeOutputColumnValue_(
  columnValue
) {
  if (
    typeof columnValue === 'number' &&
    columnValue > 0
  ) {
    return columnValue;
  }

  var text = columnValue
    ? columnValue.toString().trim().toUpperCase()
    : '';

  if (!text) {
    throw new Error(
      'Output column tidak boleh kosong.'
    );
  }

  if (!isValidColumnLetter_(text)) {
    throw new Error(
      'Output column tidak valid: ' + text
    );
  }

  return convertLetterToColumn(text);
}

function buildSequentialOutputMapping_(
  fields,
  startColumn
) {
  var mapping = {};
  var start =
    typeof startColumn === 'number'
      ? startColumn
      : normalizeOutputColumnValue_(
          startColumn
        );

  for (
    var i = 0;
    i < fields.length;
    i++
  ) {
    mapping[fields[i]] = start + i;
  }

  return mapping;
}

function validateOutputMapping_(
  mapping,
  allowedFields
) {
  var selectedCount = 0;
  var seenColumns = {};
  var allowedMap = {};

  for (
    var i = 0;
    i < allowedFields.length;
    i++
  ) {
    allowedMap[allowedFields[i]] = true;
  }

  for (var field in mapping) {
    if (!mapping.hasOwnProperty(field)) {
      continue;
    }

    if (!allowedMap[field]) {
      return {
        isValid: false,
        error:
          'Unknown output field: ' +
          field
      };
    }

    var columnNumber =
      parseInt(mapping[field], 10);

    if (
      isNaN(columnNumber) ||
      columnNumber < 1
    ) {
      return {
        isValid: false,
        error:
          'Invalid output column for ' +
          field +
          '.'
      };
    }

    if (seenColumns[columnNumber]) {
      return {
        isValid: false,
        error:
          'Duplicate output column: ' +
          convertColumnToLetter_(
            columnNumber
          )
      };
    }

    seenColumns[columnNumber] = true;
    selectedCount++;
  }

  if (selectedCount === 0) {
    return {
      isValid: false,
      error:
        'At least one output field must be selected.'
    };
  }

  return {
    isValid: true,
    error: ''
  };
}

function serializeOutputMapping_(
  mapping
) {
  return JSON.stringify(
    mapping || {}
  );
}

function parseStoredOutputMapping_(
  jsonText,
  allowedFields,
  fallbackStartColumn
) {
  if (!jsonText) {
    return normalizeOutputMapping_(
      null,
      allowedFields,
      fallbackStartColumn
    );
  }

  try {
    return normalizeOutputMapping_(
      JSON.parse(jsonText),
      allowedFields,
      fallbackStartColumn
    );
  } catch (err) {
    return normalizeOutputMapping_(
      null,
      allowedFields,
      fallbackStartColumn
    );
  }
}

function readMappedOutputRows_(
  sheet,
  startRow,
  numRows,
  mapping,
  fields
) {
  var rows = [];

  for (
    var r = 0;
    r < numRows;
    r++
  ) {
    rows.push({});
  }

  for (
    var i = 0;
    i < fields.length;
    i++
  ) {
    var field = fields[i];
    var column = mapping[field];

    if (!column) {
      continue;
    }

    var values = sheet
      .getRange(
        startRow,
        column,
        numRows,
        1
      )
      .getValues();

    for (
      var rowIndex = 0;
      rowIndex < numRows;
      rowIndex++
    ) {
      rows[rowIndex][field] =
        values[rowIndex][0];
    }
  }

  return rows;
}

function writeMappedOutputRows_(
  sheet,
  startRow,
  rowObjects,
  mapping,
  fields
) {
  var numRows = rowObjects.length;

  if (numRows === 0) {
    return;
  }

  for (
    var i = 0;
    i < fields.length;
    i++
  ) {
    var field = fields[i];
    var column = mapping[field];

    if (!column) {
      continue;
    }

    var values = [];

    for (
      var rowIndex = 0;
      rowIndex < numRows;
      rowIndex++
    ) {
      values.push([
        rowObjects[rowIndex][field] ===
          undefined
          ? ''
          : rowObjects[rowIndex][field]
      ]);
    }

    sheet
      .getRange(
        startRow,
        column,
        numRows,
        1
      )
      .setValues(values);
  }
}

function convertVerifyResultToObject_(
  result
) {
  return {
    Exists: result.exists,
    Type:
      result.type ||
      result.fileType ||
      '',
    CheckedPathCount:
      result.checkedPathCount || 0,
    MatchedPathColumn:
      result.matchedPathColumn || '',
    FileID: result.fileId || '',
    PathID:
      result.pathId ||
      result.parentId ||
      '',
    VerifiedFilePath:
      result.verifiedFilePath || '',
    Error: result.error || ''
  };
}

function buildVerifyOutputObject_(
  exists,
  type,
  checkedPathCount,
  matchedPathColumn,
  fileId,
  pathId,
  verifiedFilePath,
  error
) {
  return {
    Exists: exists,
    Type: type || '',
    CheckedPathCount:
      checkedPathCount || 0,
    MatchedPathColumn:
      matchedPathColumn || '',
    FileID: fileId || '',
    PathID: pathId || '',
    VerifiedFilePath:
      verifiedFilePath || '',
    Error: error || ''
  };
}

function convertResolveRowToObject_(
  row
) {
  row = row || [];

  return {
    ResolveStatus: row[0] || '',
    ResolvedID: row[1] || '',
    ResolvedType: row[2] || '',
    ResolvedPath: row[3] || '',
    MatchCount: row[4] || 0,
    MatchMethod: row[5] || '',
    Confidence: row[6] || '',
    ResolveNote: row[7] || ''
  };
}

function getMappedValue_(
  rowObject,
  field
) {
  if (!rowObject) {
    return '';
  }

  return rowObject[field] ===
    undefined
    ? ''
    : rowObject[field];
}
