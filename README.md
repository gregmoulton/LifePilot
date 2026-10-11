# Life Pilot v0.4

Static application: open `index.html`, or serve this directory with a local HTTP server. Deploy both `index.html` and `execution.js` together. No build or external runtime dependency is required.

## Implemented
- Additive Goal → selected Program → measurable Milestone → scheduled Task records.
- Required task prerequisites enforce the chosen program's sequence.
- Actual minutes, completion/partial/missed results, and overdue commitment detection.
- Predicted versus observed tests for initiation, effort, achievement, retention and efficiency.
- Motivation Lab asks why before making a transparent rule-based recommendation.
- Review, trade-off, retain-current-plan alternative, explicit approval, decision log and small experiment records.
- Approved schedule adjustments retain prior task results in history. Other interventions are recorded experiments for the owner to carry out; no goal or program is automatically substituted.

## Compatibility and privacy
The `lifepilot-v02-profile` storage key remains unchanged. Existing schema 0.1/0.2 goals and decisions remain supported. New data lives under an additive `execution` field; unknown existing profile and goal fields remain preserved. Import/export includes the new records. The legacy importer removes its original `import_status` draft marker, as before.

No personal profile is bundled. Clean-slate onboarding remains available. Profile JSON files are ignored by Git. Data remains local browser storage, without cloud sync, account separation or encryption. Keep exported backups. Loading locally uses a separate storage origin from GitHub Pages; do not expect the live browser profile to appear automatically in a local preview.

## Validation
Automated acceptance checks passed for legacy profile compatibility, all execution workflows, prerequisite enforcement, approval gating, System Improvement Log entries, and backup round trips. The owner confirmed Chrome user acceptance testing on October 11, 2026, including legacy import, task execution, the System Improvement Log, and backup restoration.

Private profiles, test fixtures, and the isolated acceptance copy are excluded from the published release.

## Limits
Recommendations are transparent rules, not live AI or autonomous learning. Experiments provide descriptive completion/effort comparisons; they do not establish causal superiority. Performance tests are entered by the user and are not independently verified. Program steps are entered explicitly, with required prerequisites; external course content is not imported automatically. Experiment windows and interventions are owner-defined. Scheduling uses the browser's local time. Route Lab retains the existing illustrative allocation model.

## Approval boundary
The owner authorized committing and publishing the approved v0.4 release on October 11, 2026. This implements the locked v0.4 plan; consequential future changes require review and approval.

## System Improvement Log addition
A separate tab captures recommendation outcomes, user corrections, observed system failures and improvement proposals. Each entry includes a timestamp, summary, details, optional goal/reference and evidence. Proposals remain `proposed`; saving entries does not execute changes or alter approved plans or rules. Entries are user-recorded, with no background monitoring.

The additive top-level `system_improvement_log` array is included in normal profile backups/imports. Old profiles need no conversion; the array is created only when the first entry is saved. Tests cover all four types, safe text rendering, backup round trips, and unchanged goals, execution records, decisions and optimization policy.
