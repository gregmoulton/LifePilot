# Browser matrix checkpoint — October 27, 2026, Arizona

Stacked on draft PR #29, exact parent 995d7beb74c4d552b7b8c424ebc553d2ea14c3ac. Application files are unchanged. This slice expands the existing browser harness and CI only; it does not merge, deploy or alter profile storage.

## Changes

- LIFEPILOT_BROWSER selects chromium (default), firefox or webkit. Invalid engine names fail rather than falling back.
- CHROMIUM_PATH remains optional and applies only to Chromium. Other engines use their Playwright-pinned runtime.
- CI installs each engine's dependencies and runs the same ten acceptance cases in independent matrix jobs; fail-fast is disabled. No unsupported capability is silently skipped.
- Work-machine owner acceptance is first priority, Android second, Chromebook last. Linux browser automation is not physical Windows/Android/ChromeOS acceptance.

## Actual local results

- 62 Node checks passed, zero failed, using PR #29's complete source snapshot.
- Original 38 Radar assertions passed separately under America/Phoenix.
- Python compilation passed.
- Firefox 153 downloaded and launched, but stalls creating a page even in an empty-page smoke test. Main browser suite was stopped without reporting any pass; this is a runtime/setup blocker, not a reproduced app defect.
- WebKit 26.5 downloaded but could not launch due to missing host libraries. Workspace package installation was denied by host privilege constraints. Zero browser cases ran.
- Chromium download returned truncated archives; no local Chromium rerun claimed. PR #29's historical Chromium CI evidence remains separate.

## Required evidence

Inspect all CI matrix jobs for this exact commit before claiming cross-engine coverage. Any failing case needs reproduction and repair; a green Node job alone does not close browser gates. Physical work-machine, Android and Chromebook acceptance and deployed HTTPS-origin behavior remain open. Test deployments require separate owner approval. Never point the owner at public v0.4 as if it were this candidate.

No private fixtures, production files, Pure changes, credentials or paid services were used.
