# Prime Workout prototype — testing guide

Status: isolated development prototype, not deployed or browser-validated. The published Life Pilot application is unchanged.

## How to test
1. Open `prime-workout/index.html` from this branch in a local browser or serve the folder with a static HTTP server.
2. Log a pull-up entry, reload, and verify it persists.
3. Edit the entry and reload; verify the new values persist.
4. Export a JSON backup; add another entry; restore the backup and verify the original data replaces the newer state only after confirmation.
5. Delete an entry and confirm the history and workout-day count update.
6. Test on a phone-sized screen and with browser storage disabled or full.

## Current limits
- Records are browser-local and are not synchronized with Life Pilot or other devices.
- Each entry represents one exercise, not a full workout session.
- The exercise menu, sets/reps, optional effort, and notes are an initial slice of the approved product specification, not the complete MVP.
- No baseline tests, analytics forecasts, weekly adherence, user authentication, consent workflow, or AI integration yet.
- Do not enter sensitive information or treat local storage as a durable backup. Export often.
- No public launch or real-user data collection without security, privacy, consent, and testing review.
