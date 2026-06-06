
function isValidColumnLetter_(value) {
  return /^[A-Z]+$/.test(value);
}

function confirmOutputDoesNotOverlapSource_(sourceColumn, inputWidth, targetColumn, outputWidth) {
  var sourceStart = sourceColumn;
  var sourceEnd = sourceColumn + inputWidth - 1;

  var outputStart = targetColumn;
  var outputEnd = targetColumn + outputWidth - 1;

  var isOverlapping = outputStart <= sourceEnd && outputEnd >= sourceStart;

  if (!isOverlapping) {
    return true;
  }
  SpreadsheetApp.getUi().alert(
    '⚠️ Output Overlaps Source',
    'Kolom output bertabrakan dengan kolom input.\n' +
      'Source range: kolom ' + sourceStart + ' sampai ' + sourceEnd + '\n' +
      'Output range: kolom ' + outputStart + ' sampai ' + outputEnd + '\n\n' +
      'Pilih kolom output lain agar data input tidak tertimpa.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return false;
}

function confirmOutputWithinSheetBoundary_(sheet, targetColumn, outputWidth) {
  var maxColumns = sheet.getMaxColumns();
  var outputEndColumn = targetColumn + outputWidth - 1;
  if (outputEndColumn <= maxColumns) {
    return true;
  }
  SpreadsheetApp.getUi().alert(
    '⚠️ Output Exceeds Sheet Boundary',
    'Output membutuhkan kolom sampai ' +
      outputEndColumn +
      ', sedangkan sheet hanya memiliki ' +
      maxColumns +
      ' kolom.\n\n' +
      'Tambahkan kolom terlebih dahulu atau pilih kolom output yang lebih awal.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return false;
}

function confirmNonBlankMainOutput_(sheet, startRow, targetColumn, numRows) {
  var values = sheet
    .getRange(startRow, targetColumn, numRows, 1)
    .getValues();
  var nonBlankCount = 0;
  for (var i = 0; i < values.length; i++) {
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
      ' row pada kolom output utama yang sudah berisi data.\n' +
      'Row tersebut akan dilewati (skip) oleh sistem.\n\n' +
      'Klik OK untuk lanjut.\n' +
      'Klik Cancel untuk membatalkan proses.',
    ui.ButtonSet.OK_CANCEL
  );
  return response === ui.Button.OK;
}