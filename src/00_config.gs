/**
 * VERRACT v0.2.0-beta
 * Design Files Management Build
 *
 * Release Focus:
 * - Modularized Verify foundation
 * - Logic preserved from v0.1.2-beta
 * - Config, menu, diagnostics, engine, resolver, state, validation, and utility layers separated
 *
 * Architecture:
 * - Modular Apps Script structure
 * - No behavioral change from v0.1.2-beta
 */

var ENGINE_STATE_KEY = 'IS_ENGINE_RUNNING';
var INPUT_WIDTH = 4;
var OUTPUT_WIDTH = 5;
var METADATA_KEYS = [
  'AUTO_CURRENT_ROW',
  'AUTO_END_ROW',
  'AUTO_SOURCE_COL',
  'AUTO_TARGET_COL',
  'AUTO_SPREADSHEET_ID',
  'AUTO_SHEET_NAME',
  'DYNAMIC_BATCH_SIZE',
  'AUTO_LAST_SUCCESS_TS',
  'AUTO_ENGINE_STARTED_AT'
];
var DEFAULT_BATCH_SIZE = 20;
var MIN_BATCH_SIZE = 1;
var MAX_BATCH_SIZE = 500;
var DEFAULT_TRIGGER_GAP_MINUTES = 5;
var MIN_TRIGGER_GAP_MINUTES = 5;
var MAX_TRIGGER_GAP_MINUTES = 60;