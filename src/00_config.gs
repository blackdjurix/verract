var ENGINE_STATE_KEY = 'IS_ENGINE_RUNNING';

var MIN_PATH_COLUMN_COUNT = 1;
var EXTENSION_COLUMN_OPTIONAL = true;

var MAX_VERIFY_ATTEMPTS_PER_BATCH = 250;
var PATH_COLUMN_WARNING_THRESHOLD = 10;

var OUTPUT_WIDTH = 8;

var METADATA_KEYS = [
  'AUTO_CURRENT_ROW',
  'AUTO_END_ROW',
  'AUTO_PATH_COLUMNS',
  'AUTO_FILE_COLUMN',
  'AUTO_EXTENSION_COLUMN',
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

/**
 * Resolve output:
 * ResolveStatus
 * ResolvedID
 * ResolvedType
 * ResolvedPath
 * MatchCount
 * MatchMethod
 * Confidence
 * ResolveNote
 */

var RESOLVE_OUTPUT_WIDTH = 8;

var RESOLVE_METADATA_KEYS = [
  'RESOLVE_CURRENT_ROW',
  'RESOLVE_END_ROW',
  'RESOLVE_PATH_COLUMNS',
  'RESOLVE_FILE_COLUMN',
  'RESOLVE_EXTENSION_COLUMN',
  'RESOLVE_VERIFY_OUTPUT_COLUMN',
  'RESOLVE_ROOT_ID_COLUMN',
  'RESOLVE_TARGET_COL',
  'RESOLVE_SPREADSHEET_ID',
  'RESOLVE_SHEET_NAME',
  'RESOLVE_BATCH_SIZE',
  'RESOLVE_LAST_SUCCESS_TS',
  'RESOLVE_ENGINE_STARTED_AT'
];

var RESOLVE_DEFAULT_BATCH_SIZE = 20;

var RESOLVE_MIN_BATCH_SIZE = 1;
var RESOLVE_MAX_BATCH_SIZE = 200;

var RESOLVE_DEFAULT_TRIGGER_GAP_MINUTES = 5;

var RESOLVE_MIN_TRIGGER_GAP_MINUTES = 5;
var RESOLVE_MAX_TRIGGER_GAP_MINUTES = 60;

var RESOLVE_MAX_CANDIDATES_PER_ROW = 10;


/**
 * Verify evidence output fields.
 * These are method-specific results from the Verify workflow.
 */
var VERIFY_BASE_OUTPUT_FIELDS = [
  'Exists',
  'Type',
  'CheckedPathCount',
  'MatchedPathColumn',
  'FileID',
  'PathID',
  'VerifiedFilePath',
  'Error'
];

/**
 * Resolve evidence output fields.
 * These are method-specific results from the Resolve workflow.
 */
var RESOLVE_BASE_OUTPUT_FIELDS = [
  'ResolveStatus',
  'ResolvedID',
  'ResolvedType',
  'ResolvedPath',
  'MatchCount',
  'MatchMethod',
  'Confidence',
  'ResolveNote'
];

/**
 * Shared output fields.
 *
 * UI label:
 * SharedPathID   -> PathID
 * SharedFileID   -> FileID
 * SharedPath     -> Path
 * SharedFilename -> Filename
 * SharedSource   -> Source
 */
var SHARED_OUTPUT_FIELDS = [
  'SharedPathID',
  'SharedFileID',
  'SharedPath',
  'SharedFilename',
  'SharedSource'
];

var VERIFY_OUTPUT_FIELDS =
  VERIFY_BASE_OUTPUT_FIELDS.concat(
    SHARED_OUTPUT_FIELDS
  );

var RESOLVE_OUTPUT_FIELDS =
  RESOLVE_BASE_OUTPUT_FIELDS.concat(
    SHARED_OUTPUT_FIELDS
  );

var VERIFY_OUTPUT_MAPPING_PROPERTY =
  'VERIFY_OUTPUT_MAPPING';

var RESOLVE_OUTPUT_MAPPING_PROPERTY =
  'RESOLVE_OUTPUT_MAPPING';

var SHARED_OUTPUT_MAPPING_PROPERTY =
  'SHARED_OUTPUT_MAPPING';
