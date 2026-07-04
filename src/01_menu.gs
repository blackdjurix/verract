function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ verract')
    .addItem('🖥️ Open Control Panel', 'OPEN_VERRACT_SIDEBAR')
    .addSeparator()
    .addItem('✅ Run Verify', 'CREATE_TIME_TRIGGER_MULTI')
    .addItem('🔎 Run Resolve', 'CREATE_RESOLVE_TRIGGER_MULTI')
    .addItem('▶️ Run Action', 'CREATE_ACTION_TRIGGER_MULTI')
    .addSeparator()
    .addItem('📋 Inspect System Logs', 'CHECK_SYSTEM_DIAGNOSTICS')
    .addItem('👤 Stamp Active Account', 'WRITE_CURRENT_ACCOUNT_TO_CELL')
    .addItem('🛑 Stop & Reset', 'MANUAL_CLEAR_TRIGGER_AND_STATE')
    .addSeparator()
    .addItem('ℹ️ About verract', 'SHOW_VERSION_INFO')
    .addToUi();
}
