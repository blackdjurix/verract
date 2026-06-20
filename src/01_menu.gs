function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ verract')
    .addItem('🖥️ Open Control Panel', 'OPEN_VERRACT_SIDEBAR')
    .addSeparator()
    .addItem('📋 Inspect System Logs', 'CHECK_SYSTEM_DIAGNOSTICS')
    .addItem('👤 Stamp Active Account', 'WRITE_CURRENT_ACCOUNT_TO_CELL')
    .addSeparator()
    .addItem('⏰ Start File Verification', 'CREATE_TIME_TRIGGER_MULTI')
    .addItem('🔎 Start Resolve Candidate Discovery', 'CREATE_RESOLVE_TRIGGER_MULTI')
    .addItem('🧭 Start Action Preview', 'CREATE_ACTION_PREVIEW_TRIGGER_MULTI')
    .addItem('🔗 Start Multi-Phase Preview', 'CREATE_MULTI_PHASE_PIPELINE')
    .addItem('🛑 Stop & Reset', 'MANUAL_CLEAR_TRIGGER_AND_STATE')
    .addSeparator()
    .addItem('ℹ️ About verract', 'SHOW_VERSION_INFO')
    .addToUi();
}
