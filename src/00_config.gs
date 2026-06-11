/**
 * VERRACT v0.2.1-beta
 * Design Files Management Build
 * Author  : blackdjurix
 *
 * Feature : Multi-Path File Verification
 *
 * Highlights:
 * - Supports dynamic path-column selection
 * - Supports non-contiguous columns and column ranges
 * - Verifies filename against multiple candidate paths
 * - Skips duplicate normalized paths per row
 * - Stops at the first valid file match
 * - Adds workload protection for batch execution
 */

var ENGINE_STATE_KEY = 'IS_ENGINE_RUNNING';

/**
 * Input model is now dynamic.
 *
 * Required:
 * - One or more path columns
 * - One filename column
 *
 * Path examples:
 * B
 * B,C
 * B-C,F,G-I
 */

var MIN_PATH_COLUMN_COUNT = 1;

/**
 * Maximum number of candidate path checks allowed
 * in one batch before the process is rejected.
 *
 * Estimated workload:
 * batch size × selected path column count
 */

var MAX_VERIFY_ATTEMPTS_PER_BATCH = 250;

/**
 * Show a warning when many path columns are selected.
 * This is not a hard limit.
 */

var PATH_COLUMN_WARNING_THRESHOLD = 10;

/**
 * Verify output:
 * Exists
 * FileID
 * FileType
 * ParentID
 * VerifiedFilePath
 * MatchedPathColumn
 * CheckedPathCount
 * Error
 */

var OUTPUT_WIDTH = 8;

var METADATA_KEYS = [
  'AUTO_CURRENT_ROW',
  'AUTO_END_ROW',
  'AUTO_PATH_COLUMNS',
  'AUTO_FILE_COLUMN',
  'AUTO_TARGET_COL',
  'AUTO_SPREADSHEET_ID',
  'AUTO_SHEET_NAME',
  'DYNAMIC_BATCH_SIZE',
  'AUTO_LAST_SUCCESS_TS',
  'AUTO_ENGINE_STARTED_AT',
  'AUTO_ROOT_ID_COLUMN'
];

var DEFAULT_BATCH_SIZE = 20;
var MIN_BATCH_SIZE = 1;
var MAX_BATCH_SIZE = 500;

var DEFAULT_TRIGGER_GAP_MINUTES = 5;
var MIN_TRIGGER_GAP_MINUTES = 5;
var MAX_TRIGGER_GAP_MINUTES = 60;

var CACHE_TTL_SECONDS = 7200;