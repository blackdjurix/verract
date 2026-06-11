function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ verract')
    .addItem('📋 Inspect System Logs', 'CHECK_SYSTEM_DIAGNOSTICS')
    .addItem('👤 Stamp Active Account', 'WRITE_CURRENT_ACCOUNT_TO_CELL')
    .addSeparator()
    .addItem('⏰ Start File Verification', 'CREATE_TIME_TRIGGER_MULTI')
    .addItem('🛑 Stop & Reset', 'MANUAL_CLEAR_TRIGGER_AND_STATE')
    .addSeparator()
    .addItem('ℹ️ About verract', 'SHOW_VERSION_INFO')
    .addToUi();
}