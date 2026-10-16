# Prime Workout 1.0 — pre-release acceptance checklist

**Status:** Draft PR #1 only. No production merge or deployment authorized.

## Safe setup
1. On the Chromebook, open the **development-branch** `prime-workout/index.html` file from PR #1 and download the HTML file using GitHub's Raw/Download action. Open the downloaded file in a browser **as a local file** (not the existing live GitHub Pages URL). If the browser refuses to open local HTML, stop and report that blocker; do not change production.
2. The development HTML uses browser-local storage under `prime-workout-mvp-v01`. **Export a backup of any existing workouts before testing**. Local-file storage may behave differently from the hosted origin. Do not restore test backups into the live app.
3. Use only clearly labeled TEST records on the development copy. Do not delete any genuine workouts. If there is any doubt about which page is open, stop.

## Chromebook acceptance
- [ ] Open development copy and confirm Prime Workout form, Progress, and History appear.
- [ ] Log TEST Inverted row, 3 sets, 8 reps, effort 7; verify 24 total reps.
- [ ] Refresh the development page; confirm TEST entry remains.
- [ ] Edit TEST entry to 3 × 10; confirm 30 reps and refreshed history.
- [ ] Filter progress to Inverted row; verify first/latest calculation is meaningful.
- [ ] Export JSON backup; confirm file downloads.
- [ ] Delete **only** the TEST entry and verify history updates.
- [ ] Restore the exported TEST backup and verify the entry returns.
- [ ] Check keyboard access: Tab to controls, activate buttons, and read labels.
- [ ] Note any warnings or errors.

## Phone acceptance
- [ ] Open a separately downloaded development HTML copy on the phone, if local HTML is supported. Do **not** use the live Pages URL to test unpublished features.
- [ ] Confirm no horizontal scrolling, clipped inputs, or overlapping buttons.
- [ ] Confirm buttons are comfortably tappable and date/number fields usable.
- [ ] Create and edit one TEST entry, then refresh to check persistence.
- [ ] Try JSON export and file-picker restore only if supported by the phone browser.
- [ ] Do not expect Chromebook entries to appear on the phone: data is browser-local.

## Acceptance gate
- [ ] All GitHub Actions checks pass on the **final commit SHA**.
- [ ] Chromebook smoke test passes; phone test passes or limitations documented.
- [ ] Existing real workout backup is retained outside the browser.
- [ ] No unexpected data loss, crashes, or unusable mobile controls.
- [ ] Owner explicitly approves **merge and deployment** separately.

Report: Chromebook PASS/FAIL, phone PASS/FAIL/UNSUPPORTED, and any issue details.
