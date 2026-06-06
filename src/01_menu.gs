function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ System Tool')
    .addItem('📋 Inspect System Logs', 'CHECK_SYSTEM_DIAGNOSTICS')
    .addItem('👤 Stamp Active Account', 'WRITE_CURRENT_ACCOUNT_TO_CELL')
    .addSeparator()
    .addItem('⏰ Start RootID Resolver', 'CREATE_TIME_TRIGGER_MULTI')
    .addItem('🛑 Stop & Reset', 'MANUAL_CLEAR_TRIGGER_AND_STATE')
    .addToUi();
}