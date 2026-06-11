# Changelog

<details>
<summary>v0.2.1-beta - Multi-Path File Verification</summary>

### Features

* Added dynamic selection for one or more candidate path columns.
* Added support for non-contiguous columns and column ranges.
* Added separate RootID and filename column selection.
* Added multi-path file verification with first-match behavior.
* Added duplicate normalized path filtering.
* Added verified file path output.
* Added matched path-column tracking.
* Added checked path-count tracking.

### Safety

* Added input-column conflict validation.
* Added workload protection based on batch size and selected path-column count.
* Preserved existing output overlap, boundary, and non-blank safety checks.

### Validation

* Confirmed successful file matches across multiple candidate paths.
* Confirmed first-match stop behavior.
* Confirmed correct matched path-column output.
* Confirmed missing filename handling.
* Confirmed failed-path error output.

### Known Limitations

* Filename lookup currently supports exact matches only.
* Wildcard filename patterns are not supported.
* Final error output currently reflects only the last checked candidate path.

### Notes

* This release extends the Verify phase only.
* Resolve functionality remains outside the scope of v0.2.1-beta.
* The release remains in beta until larger-volume verification tests are completed.

</details>

<details>
<summary>v0.2.0-beta - Verify Engine Modularization</summary>

### Architecture

* Refactored the Verify engine from a monolithic single-file implementation into a modular architecture.
* Archived the final monolithic build as:

  * `src/legacy/verract_Initial_v0.1.2.gs`
* Introduced dedicated module structure:

  * `00_Config.gs`
  * `01_Menu.gs`
  * `02_Diagnostics.gs`
  * `03_Engine.gs`
  * `04_Resolver.gs`
  * `05_State.gs`
  * `06_Validation.gs`
  * `07_Utils.gs`
* Separated responsibilities between configuration, UI, diagnostics, engine orchestration, resolver logic, runtime state management, validation, and shared utilities.
* Established the architectural foundation for future modules:

  * Resolve
  * Target Validation
  * Action

### Behavior

* No functional behavior changes from v0.1.2-beta.
* Existing Verify workflows remain fully compatible.
* Existing runtime safeguards remain unchanged.

### Notes

* This release focuses exclusively on maintainability, readability, and long-term scalability.
* Modularization was completed before implementation of the Resolve phase.
* Serves as the architectural baseline for all future VERRACT modules.

</details>

<details>
<summary>v0.1.2-beta - Input & Output Safety Layer</summary>

### Added

* Added output column format validation (A, AA, AB, etc.).
* Added output sheet-boundary validation.
* Added output/source overlap detection.
* Added output main-column safety inspection.
* Added non-blank output warning dialog with user confirmation.
* Added batch size minimum and maximum guard.
* Added trigger interval minimum and maximum guard.

### Changed

* Clarified existing output skip behavior.
* Standardized batch-size fallback handling using configuration constants.
* Standardized trigger-gap fallback handling using configuration constants.

### Notes

* Engine remains monolithic and intentionally unchanged architecturally.
* This release focuses on preventing accidental data overwrite and invalid runtime configuration.
* Modularization phase remains scheduled for v0.2.0.

</details>

<details>
<summary>v0.1.1-beta - Runtime Stabilization Update</summary>

### Changes

* Optimized ScriptCache TTL from 1200s to 7200s.
* Improved trigger cleanup handling after final batch completion.
* Replaced batch pointer updates with safer property write operations.
* Added selected range boundary enforcement.
* Improved runtime stability for long-running Drive traversal batches.
* Prepared codebase for future modularization phase.

### Validation

* Successfully completed a 6,313-row production traversal run.
* Production setting used: 50 rows per batch with a 5-minute trigger interval.
* Total wall-clock runtime: approximately 10.5 hours.
* Highest observed batch runtime: approximately 295 seconds.
* No fatal trigger failures observed.
* No timeout cascade detected.
* No trigger overlap detected during production execution.

</details>

<details>
<summary>v0.1.0 - Initial Design Files Management Build</summary>

### Features

* Added initial Google Apps Script-based verification and RootID resolver engine.
* Added support for fixed input structure: Owner, RootName, RootID, Path.
* Added standard output structure: Exists, TargetID, TargetType, ParentID, Error.
* Added batch processing with time-based trigger execution.
* Added instant first-batch execution before scheduled intervals.
* Added ScriptCache-based path traversal and resolution caching.
* Added watchdog monitoring and automatic quota backoff handling.
* Added persistent runtime state management using Script Properties.

</details>