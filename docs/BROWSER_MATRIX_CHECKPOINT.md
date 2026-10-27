# Cross-browser storage repair — October 27, 2026, Arizona

Stacked on draft PR #29 (995d7beb74c4d552b7b8c424ebc553d2ea14c3ac). No schema/key changes, migration, deployment, paid services or private data.

## Reproduced defect

The initial expanded matrix passed Chromium/WebKit but Firefox 153 failed the simultaneous stale-writer case. Settled-transaction diagnostics at c23ca36 showed both tabs retained different in-memory task additions, both reported success, and neither retained unsaved recovery data. The existing Web Lock alone did not make Firefox's localStorage snapshots coherent between tabs. This is a genuine lost-update safety failure, not a hidden test skip or an inferred device result.

## Repair

Keep the same exclusive lock across posted browser tasks before reading the saved checkpoint and after the critical section. MessageChannel provides task boundaries rather than arbitrary timing delays. The final checkpoint runs in finally, including failed writes, so pending storage operations settle before the next writer is granted the lock. Commit and restore share this boundary. No automatic merge or unlocked fallback is added; the losing tab still exports attempted changes and reloads.

Browser checkpoints are used where document and MessageChannel exist. Non-browser model/VM tests remain fixture tests; actual Firefox/Chromium/WebKit CI checks are required evidence for this behavior. Legacy clients that do not use this boundary still do not cooperate, and deployed-origin/physical-device acceptance remain open.

## Regression and CI

- Local final Node command: 64 passed, 0 failed (62 inherited plus two checkpoint regression cases, each covering successful and failed writes).
- Original Radar: 38 separate assertions pass.
- Python compilation and CI YAML parse pass. Existing ten browser cases retained, no capability skips.
- At first repair commit 7f8380f: CI run 40545698407 confirmed Firefox and Chromium success. Final exact-head CI must be checked after the failure-path finalization and documentation commit; do not transfer earlier results as final-head evidence.
- CI runs three browser engines independently, cancels superseded runs and bounds each job. Standard Chromium/Firefox runner libraries are validated by Playwright; WebKit retains its system dependency install. Earlier runtime installs timed out on slow Ubuntu package downloads, not application tests.

## Acceptance order and limits

Work machine first, Android second, Chromebook last (owner reports reboot instability). Linux automation is not physical Windows, Android or ChromeOS acceptance. Trusted localhost is not deployed HTTPS-origin verification. No owner test URL established by this change. No merge/deploy without separate approval. The Pure and production stay separate and unchanged.
