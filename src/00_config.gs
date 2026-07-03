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

var VERIFY_REQUIRED_OUTPUT_FIELDS = [
  'Exists'
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

var RESOLVE_REQUIRED_OUTPUT_FIELDS = [];

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

var FILE_OBJECT_RESULT_REQUIRED_FIELDS = [
  'SharedFileID',
  'SharedPathID'
];

var FOLDER_OBJECT_RESULT_REQUIRED_FIELDS = [
  'SharedPathID'
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
 * Unified Workflow Output.
 *
 * Shared Output and Pipeline Output remain supported internally during
 * the v0.6.0 migration, but the UI exposes them as one Workflow Output.
 */
var WORKFLOW_OUTPUT_FIELDS = [
  'SharedPathID',
  'SharedFileID',
  'SharedPath',
  'SharedFilename',
  'SharedSource',
  'PipelineStatus',
  'FinalSource',
  'FinalSourceObjectID',
  'FinalSourceType',
  'FinalSourcePath',
  'FinalPhase',
  'PipelineNote'
];

var WORKFLOW_OUTPUT_MAPPING_PROPERTY =
  'WORKFLOW_OUTPUT_MAPPING';

/**
 * Workflow Result fields used by Multi-Phase and Real Execution.
 *
 * Kept as a compatibility alias while Shared Output and Pipeline Output
 * are represented together in the Workflow Output UI.
 */
var PIPELINE_OUTPUT_FIELDS = [
  'PipelineStatus',
  'FinalSource',
  'FinalSourceObjectID',
  'FinalSourceType',
  'FinalSourcePath',
  'FinalPhase',
  'PipelineNote'
];

var PIPELINE_REQUIRED_OUTPUT_FIELDS = [
  'PipelineStatus'
];




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
  'OperationNote'
];

var ACTION_REQUIRED_OUTPUT_FIELDS = [
  'OperationStatus',
  'Operation'
];

var ACTION_OUTPUT_WIDTH = ACTION_OUTPUT_FIELDS.length;

var ACTION_RUNTIME_OUTPUT_FIELDS =
  ACTION_OUTPUT_FIELDS.concat(PIPELINE_OUTPUT_FIELDS);

var ACTION_METADATA_KEYS = [
  'ACTION_CURRENT_ROW',
  'ACTION_END_ROW',
  'ACTION_SOURCE_OBJECT_ID_COLUMN',
  'ACTION_SOURCE_PATH_ID_COLUMN',
  'ACTION_SOURCE_FILE_ID_COLUMN',
  'ACTION_SOURCE_OBJECT_MODE',
  'ACTION_OPERATION_MODE',
  'ACTION_OPERATION_VALUE',
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
  'ACTION_VERIFY_EXISTS_COLUMN',
  'ACTION_VERIFY_FILE_ID_COLUMN',
  'ACTION_VERIFY_PATH_ID_COLUMN',
  'ACTION_RESOLVED_ID_COLUMN',
  'ACTION_RESOLVE_STATUS_COLUMN',
  'ACTION_RESOLVE_MATCH_COUNT_COLUMN'
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
  'COPY_RENAME',
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
  'PIPELINE_RUN_VERIFY',
  'PIPELINE_RUN_RESOLVE',
  'PIPELINE_RUN_ACTION',
  'PIPELINE_STARTED_AT',
  'PIPELINE_LAST_ERROR'
];


/**
 * v0.6.0 Real Execution runtime contract.
 */
var EXECUTION_DEFAULT_BATCH_SIZE = 10;
var EXECUTION_MIN_BATCH_SIZE = 1;
var EXECUTION_MAX_BATCH_SIZE = 50;

var EXECUTION_CONFIRMATION_TEXT = 'EXECUTE';

var FOLDER_OPERATION_IGNORED_FILE_NAMES = [
  'desktop.ini',
  'thumbs.db',
  '.ds_store'
];

var EXECUTION_OUTPUT_FIELDS = [
  'ExecutionStatus',
  'ExecutionRunID',
  'ExecutedAt',
  'ExecutionNote'
];

var EXECUTION_REQUIRED_OUTPUT_FIELDS = [
  'ExecutionStatus',
  'ExecutionNote'
];

var FILE_POST_VERIFY_REQUIRED_FIELDS = [
  'Exists',
  'Type',
  'MatchedPathColumn',
  'FileID',
  'PathID',
  'SharedFileID',
  'SharedPathID'
];

var FOLDER_POST_VERIFY_REQUIRED_FIELDS = [
  'Exists',
  'Type',
  'MatchedPathColumn',
  'PathID',
  'SharedPathID'
];

var EXECUTION_METADATA_KEYS = [
  'EXECUTION_ACTIVE',
  'EXECUTION_RUN_ID',
  'EXECUTION_CURRENT_ROW',
  'EXECUTION_END_ROW',
  'EXECUTION_SPREADSHEET_ID',
  'EXECUTION_SHEET_NAME',
  'EXECUTION_PLAN_STATUS_COLUMN',
  'EXECUTION_OPERATION_COLUMN',
  'EXECUTION_SOURCE_ID_COLUMN',
  'EXECUTION_SOURCE_PATH_ID_COLUMN',
  'EXECUTION_SOURCE_FILE_ID_COLUMN',
  'EXECUTION_SOURCE_OBJECT_MODE',
  'EXECUTION_TARGET_COLUMN',
  'EXECUTION_ROOT_ID_COLUMN',
  'EXECUTION_POST_VERIFY_MAPPING',
  'EXECUTION_OUTPUT_MAPPING',
  'EXECUTION_BATCH_SIZE',
  'EXECUTION_CLEANUP_MODE',
  'EXECUTION_STARTED_AT',
  'EXECUTION_LAST_SUCCESS_TS',
  'EXECUTION_LAST_ERROR'
];

var EXECUTION_ALLOWED_PLAN_STATUSES = [
  'READY',
  'READY_CREATE_TARGET_PARENT',
  'READY_MERGE_TARGET',
  'READY_MERGE_EXISTING_FOLDER'
];
