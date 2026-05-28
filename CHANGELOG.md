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

## v0.1.1-beta — Runtime Stabilization Update

- Optimized ScriptCache TTL from 1200s to 7200s.
- Improved trigger cleanup handling after final batch completion.
- Replaced batch pointer updates with safer setProperty() calls.
- Added selected range boundary enforcement.
- Improved runtime stability for long-running Drive traversal batches.
- Prepared codebase for future modularization phase.
