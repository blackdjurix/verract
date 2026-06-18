function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ verract')
    // HTML UI
    .addItem(
      '🖥️ Open Control Panel',
      'OPEN_VERRACT_SIDEBAR'
    )
    .addSeparator()
    // Legacy Workflow
    .addItem(
      '⏰ Verify (Legacy Prompt)',
      'CREATE_TIME_TRIGGER_MULTI'
    )
    .addItem(
      '🔎 Resolve (Legacy Prompt)',
      'CREATE_RESOLVE_TRIGGER_MULTI'
    )
    .addSeparator()
    // Utilities
    .addItem(
      '📋 Inspect System Logs',
      'CHECK_SYSTEM_DIAGNOSTICS'
    )
    .addItem(
      '👤 Stamp Active Account',
      'WRITE_CURRENT_ACCOUNT_TO_CELL'
    )
    .addItem(
      '🛑 Stop & Reset',
      'MANUAL_CLEAR_TRIGGER_AND_STATE'
    )
    .addSeparator()
    // About
    .addItem(
      'ℹ️ About verract',
      'SHOW_VERSION_INFO'
    )
    .addToUi();
}