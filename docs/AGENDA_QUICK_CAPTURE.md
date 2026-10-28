# Agenda quick capture — October 27, 2026

Owner requested fewer clicks: Today beside date, plus visible priority ratings.

- Today fills the local calendar date only; it does not submit, save or modify existing tasks. Other dates and a blank date remain available.
- High / Normal / Low radios require one click. Normal is the default. Native Enter submission remains available from the task-name field.
- Owner importance is persisted additively as agenda_importance and mapped to the existing Radar importance signal (High 3, Normal 1, Low 0.5). This does not add location/availability scheduling or conversational batch entry.
- Within current Agenda prioritization, explicit approved-priority overrides retain precedence; other active/upcoming tasks sort High, Normal, Low. Legacy tasks without a rating retain Normal behavior, with no record rewrite.
- Labels on High/Low tasks make the setting visible after save. Existing HOLD, completion, due dates and profile relationships are preserved.

Local evidence: 66 Node tests and original 38 Radar assertions pass; JS syntax and Python compilation pass. New Node regressions cover local-day boundary near UTC midnight, Today not saving, explicit priority/restart, ordering and existing eight-goal/unknown-field preservation.

Browser acceptance additions: real Today click (no premature submit), three priority choices, Enter submission, persisted date/priority/reload and ordering, 360px control visibility/no horizontal overflow. These are authored tests, not passing browser evidence until exact-commit CI completes. Physical Android is separate from viewport checks.

No merge or deployment. Hosted saved version 2 remains at PR #47's previous tested commit until separate update approval.
