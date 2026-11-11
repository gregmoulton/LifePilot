# The Pure: before/after evidence for PR #113 at 7e5f2ac

- **BEFORE:** the installed Android app's recovered source, `recovery/the-pure-android-chatgpt-site` at `14ed555`, `source/dist` (byte-identical to `pure/live`).
- **AFTER:** PR #113 `prototypes/the-pure-hit-1-6-work-review/dist` at `7e5f2ac9b09d36af5d9177531a6d179d26e51546`.
- **How the screenshots were made:** with `capture-evidence.cjs` in real Chromium. Both builds ran through identical scripted steps with fictional data only, served from localhost with external network blocked.
- **Viewports:** 360×780, 384×832 and 412×915 CSS px (shown at 2×).
- **Seeded states:** states 5 and 6 are seeded with three fictional calibration workouts with Round 1 of 20 / 30 / 10.
- **Expected differences:** the 70% floor display does not exist in BEFORE. BEFORE shows no Max/Floor in Round 2.
- **Voice message:** "Local voice unavailable" appears in both builds because the voice-model download is blocked in this test environment. It is not a regression.
- **State 1b:** BEFORE shows the approved build's existing warning when Start is tapped without a live heart-rate reading. AFTER shows the new **Use Without HRM** confirmation.
