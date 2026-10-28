# Today and Unscheduled

Today projects open tasks with a valid date on or before the local calendar day. Older dates retain the Carryover label and original date. Open tasks without a date project into Unscheduled; this is a display distinction, not a migration. Future tasks remain Upcoming. HOLD, prerequisite blocking, completed and review states take precedence. Approved priority and importance ordering applies within each open group.

Plan today is an explicit manual action offered on available undated tasks. It assigns the current local date, records a planned_today event with the previous value, and uses the existing safe-storage transaction. It cannot overwrite an existing due date, release HOLD, bypass prerequisites or reopen completed work. Repeated or stale actions fail without changes. Refresh remains proposal-only and does not rewrite carryover dates.

No keys, schema versions, historical records or backup formats change. Existing unknown fields and goals remain intact. Single and batch entries with blank dates now appear in Unscheduled. Device data remain local; there is no cloud synchronization or AI call.

Validation includes nonmutating/disjoint projections, local date near UTC midnight, rollover/reload, invalid/stale action guards, failed-save rollback with unsaved recovery, and browser add/reload/Plan today/reload/Refresh preservation. Physical usability acceptance remains separate from automated tests.
