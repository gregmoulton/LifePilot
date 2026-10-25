# Dashboard-first Command Center — review candidate

**Status:** Draft UI only; not deployed or merged. Built atop still-draft Agenda/Forward Radar PR #28, which itself depends on safe-storage PR #27.

## Owner-approved design direction
The opening page is a light, spacious executive dashboard that displays actual profile-derived task counts, agenda projections, goal status, and pending approvals. A floating Cockpit button remains on every screen (desktop and mobile). Its manual command drawer offers navigation, Add Task, review shortcuts, and a Light/Dark preference. This is one application with two modes, not separate applications.

Visual reference: the owner's Life Pilot / Design Mockups Library folder. The light business mockup provides design direction only, not real financial or health readings.

## Implementation boundaries
- New command-center.js loads after persistence.js, wraps baseRender and replaces only the previous Overview cards. Profile schema, import/export, agenda engine, and transactional storage boundary stay unchanged.
- Dashboard counts derive from the saved local profile, and agenda counts from LifePilotAgenda.projection. Unavailable projections are displayed as unavailable, not zero.
- No AI, network, payments, messages, approvals, background jobs or scheduling actions were added.
- Light/Dark browser preference uses a separate UI-only localStorage key. No account data or cross-device sync.
- The Pure and Prime Life Recovery remain out of scope.

## Review and acceptance
1. Automated test/command-center.test.cjs verifies actual counts, empty states, HTML escaping, no profile mutation and approval counts.
2. Ensure parent PR #28 plus PR #27 remain green.
3. Test in real HTTPS Chrome with fictional data: initial dashboard, agenda save/reload reflected, Add Task shortcut, approval queue, light/dark, narrow-screen drawer and mobile.
4. Existing #27 release gates remain open: native Web Locks concurrency, downloaded backup restore and physical Android testing.
5. Do not merge or deploy without explicit owner acceptance.

## Limitations
AI staff, email/calendar/finance/fitness integrations and cross-device synchronization are not active in this UI slice. The cockpit gives access to existing owner-operated controls, not conversational or autonomous execution.
