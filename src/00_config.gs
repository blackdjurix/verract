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


/**
 * Action Preview v0.4.0
 * User input: Source ObjectID + Operation + Target.
 * RootID is operation context for path resolution and single-root guard.
 */
var ACTION_OUTPUT_FIELDS = [
  'OperationStatus',
  'Operation',
  'SourceObjectID',
  'Target',
  'TargetParentID',
  'TargetObjectName',
  'CleanupCandidate',
  'OperationNote',
  'PipelineStatus',
  'FinalSource',
  'FinalSourceObjectID',
  'FinalSourceType',
  'FinalSourcePath',
  'FinalPhase',
  'PipelineNote'
];

var ACTION_OUTPUT_WIDTH = ACTION_OUTPUT_FIELDS.length;

var ACTION_METADATA_KEYS = [
  'ACTION_CURRENT_ROW',
  'ACTION_END_ROW',
  'ACTION_SOURCE_OBJECT_ID_COLUMN',
  'ACTION_OPERATION_COLUMN',
  'ACTION_TARGET_COLUMN',
  'ACTION_ROOT_ID_COLUMN',
  'ACTION_OUTPUT_MAPPING',
  'ACTION_SPREADSHEET_ID',
  'ACTION_SHEET_NAME',
  'ACTION_BATCH_SIZE',
  'ACTION_TRIGGER_GAP_MINUTES',
  'ACTION_LAST_SUCCESS_TS',
  'ACTION_ENGINE_STARTED_AT',
  'ACTION_PIPELINE_MODE',
  'ACTION_RESOLVED_ID_COLUMN',
  'ACTION_RESOLVE_STATUS_COLUMN',
  'ACTION_RESOLVE_MATCH_COUNT_COLUMN',
  'ACTION_SOURCE_LABEL_COLUMN',
  'ACTION_SOURCE_PATH_COLUMN',
  'ACTION_SOURCE_OBJECT_NAME_COLUMN'
];

var ACTION_DEFAULT_BATCH_SIZE = 50;
var ACTION_MIN_BATCH_SIZE = 1;
var ACTION_MAX_BATCH_SIZE = 200;
var ACTION_DEFAULT_TRIGGER_GAP_MINUTES = 5;
var ACTION_MIN_TRIGGER_GAP_MINUTES = 5;
var ACTION_MAX_TRIGGER_GAP_MINUTES = 60;

var ACTION_SUPPORTED_OPERATIONS = [
  'MOVE',
  'COPY',
  'RENAME',
  'MOVE_RENAME',
  'DELETE'
];

/**
 * Multi-phase pipeline foundation.
 * v0.4.0 ends at Action Preview; Drive mutation stays disabled.
 */
var PIPELINE_METADATA_KEYS = [
  'PIPELINE_ENABLED',
  'PIPELINE_PHASE',
  'PIPELINE_VERIFY_CONFIG',
  'PIPELINE_RESOLVE_CONFIG',
  'PIPELINE_ACTION_CONFIG',
  'PIPELINE_STARTED_AT',
  'PIPELINE_LAST_ERROR'
];
