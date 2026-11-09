# Existing goal context in Agenda

Tasks created by Execution already carry goal_id, program_id and milestone_id. Agenda now resolves those explicit IDs into a compact Goal → Program → Milestone reference line. It does not copy tasks, infer new parent IDs or create a parallel store. Standalone quick-capture tasks remain uncluttered.

Missing/ambiguous references, absent task parent IDs and contradictory parent chains show Link needs review. These are informational warnings, not automatic repairs or new completion gates. Existing HOLD/prerequisite protections remain unchanged. Resolving context and rendering/reloading never saves. Completion, backup, restore, carryover and Refresh preserve the original IDs and unknown fields. Display-only agenda_context is not written into task records.

Names and warnings are escaped before rendering and long names wrap on narrow screens. This slice adds no link-editing workflow, cloud synchronization, AI calls, architecture change or migration.

Validation covers resolved chains, missing/ambiguous IDs, contradictory parents, standalone tasks, display-only context, completion/restart preservation and narrow-browser rendering/reload/HOLD with an orphan milestone. Synthetic data only.
