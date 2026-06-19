# Changelog

<details>
<summary><strong>v0.3.4 - Shared Output & HTML Workflow</strong></summary>

### Added

* Shared output mapping system
* Shared PathID output
* Shared FileID output
* Shared Path output
* Shared Filename output
* Shared Source output
* Persistent selection workflow
* Set Selection action
* Clear Selection action
* Direct Verify ↔ Resolve navigation

### Improved

* Shared output configuration synchronization between Verify and Resolve
* Sidebar workflow and navigation
* Sidebar status reporting
* Column mapping normalization (automatic uppercase conversion)
* Selection handling across sidebar sessions

### Changed

* Shared output mapping is now globally managed
* Verify and Resolve can write to shared outputs independently
* Blank values no longer overwrite existing shared output values

### Removed

* Dependency on fallback HTML output columns

</details>

<details>
<summary>v0.3.3 - Custom Output Mapping</summary>

### Added

* Custom Output Mapping for Verify

  * Per-field output selection
  * Per-field output column assignment
  * Optional output fields

* Custom Output Mapping for Resolve

  * Per-field output selection
  * Per-field output column assignment
  * Optional output fields

* Output Mapping Persistence

  * Remembers last-used Verify output settings
  * Remembers last-used Resolve output settings

* Output Mapping Utilities

  * Select All
  * Clear All

### Changed

* Verify output writer now supports non-contiguous output columns

* Resolve output writer now supports non-contiguous output columns

* Output fields can be enabled or disabled independently

* Output columns are no longer restricted to a fixed output block

### Validation

* Prevents running Verify with no selected outputs

* Prevents running Resolve with no selected outputs

* Prevents duplicate output column assignments

* Requires output columns for selected output fields

### Notes

* Verify and Resolve output mappings are independent

* Existing workflows remain supported

* Shared Object Output architecture is being evaluated for future releases

</details>

<details>
<summary>v0.3.2 - HTML Control Panel & Verification Refactor</summary>

### Added

* HTML Control Panel
  * Sidebar-based UI
  * Home view
  * Verify view
  * Resolve view
  * Engine status panel
  * Diagnostics access
  * Stop & Reset access

* Selection Snapshot Workflow
  * Selected range capture
  * Verify selection snapshot
  * Resolve selection snapshot
  * Refresh Selection support

### Changed

* Verification output model refactored

  * Exists
  * Type
  * CheckedPathCount
  * MatchedPathColumn
  * FileID
  * PathID
  * VerifiedFilePath
  * Error

* Verification result states standardized

  * FALSE + null
    * Path not found
  * FALSE + folder
    * Path found
    * File not found
  * TRUE + file
    * Path found
    * File found

* ParentID semantics replaced by PathID

* Verify and Resolve configuration moved toward sidebar-based workflow

### Fixed

* Candidate path validation edge cases

* Valid path detection when target file is missing

* Incorrect FALSE results caused by filename mismatch on valid paths

* Verification reporting consistency

* Folder-only match handling

### Notes

* Legacy Verify Prompt remains available

* Legacy Resolve Prompt remains available

* HTML Control Panel is functional but status polling and UI refinements remain planned for future releases

</details>
<details>
<summary>v0.3.1-beta - Verify & Resolve Workflow Refinement</summary>

### Added
- Support rechecking failed Verify rows.
- Support Resolve hold behavior for blank Verify results.

### Changed
- Verify now skips only rows with Exists=TRUE.
- Verify now reprocesses rows with Exists=FALSE.
- Resolve now preserves existing results for unresolved rows.
- Resolve now updates to SKIPPED_ALREADY_VERIFIED when Verify becomes TRUE.

### Improved
- Better Verify → Resolve → Reverify workflow.
- Better synchronization between Verify and Resolve phases.
- Reduced manual cleanup requirements during iterative correction.

</details>

<details>
<summary>v0.3.0-beta - Resolve Batch Candidate Discovery</summary>

### Added
- Resolve configuration framework
- Resolve metadata management
- Resolve state cleanup integration
- Resolve helper utilities
- Verify error interpretation
- Object target extraction from Verify inputs
- Drive index candidate discovery
- RootID-scoped candidate filtering
- Resolve batch processing engine
- Resolve trigger workflow
- Resolve result builder
- Resolve diagnostic test suite

### Changed
- Resolve strategy shifted from recursive folder traversal to Drive index search
- Candidate discovery now targets actual objects instead of failed path segments
- Resolve workflow now processes failed Verify rows only
- Resolve output expanded to 8-column result structure

### Validated
- Verify error parsing workflow
- Object target extraction workflow
- Drive index candidate lookup
- RootID candidate filtering
- Single-match candidate resolution
- Batch processing workflow
- Resolve result generation
- Verify context integration into Resolve notes

### Notes
- Resolve currently supports candidate discovery only
- Resolve does not move, rename, delete, or create files
- Resolve results are advisory and require manual review when multiple candidates exist
- Action phase remains out of scope for v0.3.0-beta

</details>

<details>
<summary>v0.3.0-beta - Resolve Foundation</summary>

### Added

* Resolve configuration framework
* Resolve metadata management
* Resolve state cleanup integration
* Resolve helper utilities
* Verify error interpretation
* Object target extraction from Verify inputs
* Drive index candidate discovery
* Resolve result builder
* Resolve diagnostic test suite

### Changed

* Resolve strategy shifted from recursive folder traversal to Drive index search
* Candidate discovery now targets actual objects instead of failed path segments
* Resolve design aligned with large-scale batch processing requirements

### Validated

* Verify error parsing workflow
* Object target extraction workflow
* Drive index candidate lookup
* Single-match candidate resolution
* Resolve result generation
* Verify context integration into Resolve notes

### Notes

* Resolve currently provides foundation and candidate discovery components only
* Resolve batch engine has not been implemented yet
* Resolve trigger workflow has not been implemented yet
* Action phase remains out of scope for v0.3.0-beta

</details>

<details>
<summary>v0.2.2-beta - Flexible Verify Input Reference Parser</summary>

### Features

- Added flexible file reference parsing for the Verify phase.
- Preserved existing `path + file.ext` input behavior.
- Added support for full path input: `path\file.ext`.
- Added support for optional split input: `path + file + ext`.
- Added optional extension column handling.
- Added blank File Column support for full-path mode.
- Added runtime version metadata in `_version.gs`.
- Added `About verract` menu item and popup.

### Engine

- Updated Verify engine flow to normalize file references before resolver execution.
- Added support for inferring filename from the last segment of a full path.
- Added support for combining filename and extension when extension is stored in a separate column.
- Preserved multi-path first-match verification behavior.
- Preserved fixed Verify output structure.

### UX

- Added default fallback for blank batch size prompt.
- Added default fallback for blank trigger interval prompt.
- Kept invalid non-numeric prompt input rejected.
- Standardized project branding as all-lower-case `verract`.

### Validation

- Confirmed `path + file.ext` mode works.
- Confirmed `path\file.ext` full-path mode works.
- Confirmed `path + file + ext` mode works.
- Confirmed first-match behavior remains unchanged.
- Confirmed matched path-column output remains correct.
- Confirmed checked path-count output remains correct.
- Confirmed blank File Column works for full-path mode.

### Known Limitations

- Filename lookup currently supports exact matches only.
- Wildcard filename patterns are not supported.
- Full-path mode requires the path value to include both folder path and filename.
- Final error output currently reflects only the last checked candidate path.

### Notes

- This release extends the Verify phase only.
- Resolve functionality remains outside the scope of v0.2.2-beta.
- Output field selection and custom output placement are planned for later configuration work.

</details>

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