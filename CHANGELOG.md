# Changelog

## v0.9.0 - 2026-07-05 - Row Chain Orchestration

### Added

- Configurable manual gap between continuation batches.
- Per-row chain execution across Verify, Resolve, and Action.
- Chain modes:
  - Verify
  - Verify → Resolve
  - Verify → Action
  - Verify → Resolve → Action
- Vertical-tab sidebar navigation.
- Operational Home dashboard for range, gap, batch size, execution, and status.

### Changed

- Continuation delay now uses the user-configured gap.
- Chain processing preserves fixed per-row phase order.
- Sidebar configuration is separated into Home, Shared, Verify, Resolve, and Action panels.
- Chain start and Stop & Reset UI messages are clearer.

## v0.8.0 - 2026-07-04 - Contract Reset

### Changed

- Added non-contiguous row-range support across Verify, Resolve, and Action.
- Rows hidden by an active sheet filter are skipped across Verify, Resolve, and Action.
- Added Verify continuation across batch boundaries until the full selected row range is complete.
- Fixed Stop & Reset so queued Verify continuation is removed and an active run stops cooperatively before the next row.
- Rebuilt verract around `VERIFY → RESOLVE → ACTION`.
- Locked global runtime behavior:
  - all phases process per line;
  - batch is only a GAS runtime guard;
  - row decisions do not depend on other rows.
- Rebuilt Verify contract:
  - Verify checks folder + file;
  - `Exists=TRUE` only when `PathID + FileID` are found;
  - optional skip applies only to existing `TRUE` rows;
  - `Type` is not part of Verify output.
- Rebuilt Resolve contract:
  - Resolve runs when Verify is not TRUE;
  - exact match remains the final truth;
  - high-confidence suggestions are report notes only;
  - no auto-selection from similar candidates.
- Enabled ACTION with folder/path-only scope:
  - source is `SharedPathID`;
  - operation is limited to `MOVE`;
  - target is checked live per row;
  - missing target parents are created when needed;
  - existing target folders receive moved source contents;
  - source cleanup handles empty folders and system junk;
  - source is retained when real content remains.
- Updated sidebar UI for Action Input and Action Output.
- Action performs the real mutation directly; there is no Action Preview or separate Execution phase.

- Changed Resolve suggestion candidate retrieval to Drive search, followed by verract RootID, extension, and similarity filtering.
- Limited Verify to configured candidate-path exact checks; Verify no longer runs root-wide Resolve fallback or suggestions.
### Removed

- Removed Workflow Output from the active contract.
- Removed Action Preview from the active contract.
- Removed separate Execution from the active contract.
- Removed `Type` from Verify Report.
- Removed cross-row duplicate planning.

- Fixed UI settings persistence for run fields and mappings.
- Normalized column inputs to uppercase.
- Fixed hidden-row detection to skip rows hidden by filter or user.
