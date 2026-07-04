# verract Agent Contract

## Current architecture

```text
VERIFY → RESOLVE → ACTION
```

## Global runtime contract

- All phases are processed per line.
- Batch is only a guard for Google Apps Script runtime limits.
- Batch must not decide business logic.
- Verify continues across invocations until all selected row ranges are complete.
- All phases support non-contiguous row ranges.
- All phases skip rows hidden by an active sheet filter.
- Stop & Reset cancels queued continuation triggers and makes an active Verify run stop before processing the next row.
- One row must not depend on another row.
- A phase may overwrite its own previous output with the latest result.
- Shared Output is the latest object-resolution state, valid or partial.
- Current ACTION scope is folder/path only and requires a valid `SharedPathID`.

## Verify contract

- Verify checks folder + file.
- Verify only checks configured candidate paths; it does not run root-wide Resolve fallback or suggestions.
- `Exists=TRUE` only when `PathID + FileID` is found.
- Verify writes Verify Report and Shared Output.
- Old Verify output is overwritten by the new result.
- Skip option:
  - ON: rows with `Exists=TRUE` are skipped.
  - OFF: all selected rows are rechecked.
- Multi-path candidates are checked left to right.
- Filename and extension may be stored separately, then merged before lookup.
- Target path may be included as a candidate path.
- If source equals target, Verify only reports that the object is found.
- `Type` is not used.
- Verify does not handle duplicate detection.
- Verify does not decide Action.

## Resolve contract

- Resolve runs when `Verify Exists != TRUE`.
- Resolve searches for whatever Verify could not satisfy.
- Resolve uses the latest row input.
- Resolve final decision is exact-match only.
- If exact match fails, Resolve may provide high-confidence suggestions for user review.
- Suggestions are not resolution and must not make a row actionable.
- Resolve does not auto-select similar files or folders.
- Resolve may write partial Shared Output.
- Resolve succeeds only when `PathID + FileID` is found.
- Resolve does not rewrite Verify Report.
- Resolve does not decide Action.
- Resolve does not check duplicates.
- Resolve does not mutate files or folders.

## Resolve suggestion contract

- Suggestions are used only when exact match fails.
- Path found, file missing: suggest similar filenames with the same extension inside the found path.
- Path not found: suggest similar paths under RootID and similar filenames with the same extension under RootID, including candidate locations.
- Minimum similarity threshold is 90%.
- Suggestion candidate retrieval uses Drive search; verract then filters by RootID scope, extension, and similarity threshold.
- Suggestions are written to ResolveNote only.
- Suggestions never populate Shared FileID and never allow Action.

## Action contract

- ACTION scope is folder/path only.
- ACTION uses `SharedPathID` as the source folder.
- ACTION performs the real mutation directly.
- ACTION supports only `MOVE`.
- ACTION performs a live source and target check before mutation.
- ACTION does not use cross-row duplicate detection.
- If source is missing: `SOURCE_MISSING`.
- If source folder and target folder are the same folder: `SKIPPED_ALREADY_AT_TARGET`.
- If target does not exist: create missing target parents, move source folder, and rename it to the final target folder name when needed.
- If target already exists and is a different folder: move source contents into the existing target folder.
- After merge:
  - empty source folder: remove source folder;
  - source with system junk only: remove junk, then remove source folder;
  - source with real content remaining: retain source folder.
- Old source parent folders are not cleaned automatically.
- System junk names: `desktop.ini`, `Thumbs.db`, `.DS_Store`.

## Scope lock

Do not add features beyond the contracts above.

No auto-select from Resolve suggestions, no duplicate planner, no workflow status, no action preview, no separate execution phase, and no cross-row dependency.

## Batch B workload rules
- Preserve all sidebar run settings and mappings across sidebar reloads.
- Normalize column references to uppercase.
- Skip rows hidden by filter or manually hidden in Verify, Resolve, and Action.
