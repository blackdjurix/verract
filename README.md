# verract

verract is a Google Apps Script tool for verifying, resolving, and moving Google Drive folder paths from Google Sheets.

```text
VERIFY → RESOLVE → ACTION
```

## Global runtime contract

- Every phase is processed per line.
- Batch size is only a guard for Apps Script runtime limits.
- Batch does not define business logic.
- Verify continues automatically across invocations until all selected row ranges are complete.
- All phases support non-contiguous row ranges such as `10:15,20:25`.
- All phases skip rows hidden by an active sheet filter.
- Stop & Reset removes queued continuation triggers and stops an active Verify run before the next row starts.
- A row does not depend on another row.
- Phase output may be overwritten by the latest result.
- Shared Output stores the latest object-resolution state.
- Current ACTION scope is folder/path only and requires `SharedPathID`.

## Verify

Verify checks whether a folder path and file exist together.

`Exists=TRUE` means:

```text
PathID + FileID found
```

### Verify input

| Field | Required |
|---|---|
| RootID | Yes |
| Candidate Path Columns | Yes |
| Filename | Yes |
| Extension | Conditional |
| Skip rows with Exists=TRUE | Optional |

### Verify output

| Field | Required |
|---|---|
| Exists | Yes |
| CheckedPathCount | No |
| MatchedPathColumn | No |
| Error | No |
| Shared PathID | Yes |
| Shared FileID | Yes |
| Shared Path | Yes |
| Shared Filename | Yes |
| Shared Source | Yes |

## Resolve

Resolve runs only for rows where `Verify Exists != TRUE`.

Resolve uses the latest row input. Exact match is required for final resolution. High-confidence suggestions may be written to `ResolveNote`, but suggestions never populate Shared FileID and never make the row resolved.

Suggestion candidates are retrieved with Drive search, then verract filters them by RootID scope, file extension, and the 90% similarity threshold. Verify remains limited to exact checks on configured candidate paths and does not run root-wide Resolve fallback or suggestion search.

### Resolve input

| Field | Required |
|---|---|
| RootID | Yes |
| Candidate Path Columns | Yes |
| Filename | Yes |
| Extension | Conditional |
| Verify Exists | Yes |

### Resolve output

| Field | Required |
|---|---|
| ResolveStatus | Yes |
| ResolveID | No |
| ResolveCandidateCount | No |
| ResolveNote | No |
| Shared PathID | Yes |
| Shared FileID | Yes |
| Shared Path | Yes |
| Shared Filename | Yes |
| Shared Source | Yes |

## Action

Current ACTION scope is folder/path only. ACTION performs the real mutation directly.

### Action input

| Field | Required |
|---|---|
| RootID | Yes |
| Shared PathID | Yes |
| Target Path | Yes |
| Operation | Yes |

Current operation:

```text
MOVE
```

### Action behavior

- Source missing → `SOURCE_MISSING`.
- Source and target are the same folder → `SKIPPED_ALREADY_AT_TARGET`.
- Target missing → create missing target parents, move the source folder, rename to final target name when required.
- Target exists and differs from source → move source contents into target.
- After merge:
  - empty source → remove source;
  - system junk only → remove junk and source;
  - real content remains → retain source.
- Old source parent folders are not cleaned automatically.

System junk:

```text
desktop.ini
Thumbs.db
.DS_Store
```

### Action output

| Field | Required |
|---|---|
| ActionStatus | Yes |
| ActionID | Yes |
| ActionAt | Yes |
| ActionNote | No |

### Action statuses

```text
EXECUTED
SKIPPED_ALREADY_AT_TARGET
SOURCE_MISSING
TARGET_CONFLICT
EXECUTED_SOURCE_RETAINED
FAILED
```

### Workload behavior
- Column inputs are normalized to uppercase.
- Saved UI run settings are restored when the sidebar opens.
- Rows hidden by filter or manually hidden are skipped during Verify, Resolve, and Action.
