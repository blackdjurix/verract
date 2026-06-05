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

---

## v0.1.2-beta — Input & Output Safety Layer

### Added

- Added output column format validation (A, AA, AB, etc.).
- Added output sheet-boundary validation.
- Added output/source overlap detection.
- Added output main-column safety inspection.
- Added non-blank output warning dialog with user confirmation.
- Added batch size minimum and maximum guard.
- Added trigger interval minimum and maximum guard.

### Changed

- Clarified existing output skip behavior.
- Standardized batch-size fallback handling using configuration constants.
- Standardized trigger-gap fallback handling using configuration constants.

### Notes

- Engine remains monolithic and intentionally unchanged architecturally.
- This release focuses on preventing accidental data overwrite and invalid runtime configuration.
- Modularization phase remains scheduled for v0.2.0.
