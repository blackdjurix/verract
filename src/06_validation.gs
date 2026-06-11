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
      var firstColumn = convertLetterToColumn(
        startLetter
      );
      var secondColumn = convertLetterToColumn(
        endLetter
      );
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
    var columnNumber = convertLetterToColumn(
      token
    );
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

function validateFileColumn_(
  fileColumnText
) {
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
        'File column harus berupa huruf kolom valid.\n' +
        'Contoh: J, AA, AB'
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
  rootIdColumn
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
  if (fileColumn === rootIdColumn) {
    return {
      isValid: false,
      error:
        'File column dan RootID column tidak boleh sama.'
    };
  }
  for (
    var i = 0;
    i < pathColumns.length;
    i++
  ) {
    if (
      pathColumns[i] === fileColumn
    ) {
      return {
        isValid: false,
        error:
          'File column tidak boleh digunakan sebagai path column.'
      };
    }
    if (
      pathColumns[i] === rootIdColumn
    ) {
      return {
        isValid: false,
        error:
          'RootID column tidak boleh digunakan sebagai path column.'
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
  targetColumn,
  outputWidth
) {
  var outputStart = targetColumn;
  var outputEnd =
    targetColumn + outputWidth - 1;
  var inputColumns =
    pathColumns.slice();
  inputColumns.push(fileColumn);
  inputColumns.push(rootIdColumn);
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