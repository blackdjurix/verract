# Changelog

## v0.1.0 — Initial Design Files Management Build

- Added initial Google Apps Script-based verification and RootID resolver engine.
- Added support for fixed input structure: Owner, RootName, RootID, Path.
- Added standard output structure: Exists, TargetID, TargetType, ParentID, Error.
- Added batch processing with time-based trigger execution.
- Added instant first-batch execution before scheduled intervals.
- Added ScriptCache-based path traversal and resolution caching.
- Added watchdog monitoring and automatic quota backoff handling.
- Added persistent runtime state management using Script Properties.

---

## v0.1.1-beta — Runtime Stabilization Update

### Changes

- Optimized ScriptCache TTL from 1200s to 7200s.
- Improved trigger cleanup handling after final batch completion.
- Replaced batch pointer updates with safer property write operations.
- Added selected range boundary enforcement.
- Improved runtime stability for long-running Drive traversal batches.
- Prepared codebase for future modularization phase.

### Validation

- Successfully completed a 6,313-row production traversal run.
- Production setting used: 50 rows per batch with a 5-minute trigger interval.
- Total wall-clock runtime: approximately 10.5 hours.
- Highest observed batch runtime: approximately 295 seconds.
- No fatal trigger failures observed.
- No timeout cascade detected.
- No trigger overlap detected during production execution.
