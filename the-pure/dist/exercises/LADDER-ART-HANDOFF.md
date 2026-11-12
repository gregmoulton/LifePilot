# The Pure — ladder art implementation handoff

Approved by owner 2026-11-12. Source UI: PR #117 `pure/live-integrate-hit16`; do not change current layout, controls, audio or data.

## Six rungs (separate ELITE after rung 6)
| Rung | Push | Squat | Pull |
|---|---|---|---|
| 1 | Knee/incline push-ups | Chair squats | Bent-knee inverted rows |
| 2 | Standard push-ups | Bodyweight squats | Straight-leg inverted rows |
| 3 | Decline push-ups | Jump squats | Assisted pull-ups |
| 4 | Ring push-ups | Step-ups | Pull-ups |
| 5 | Parallel-bar dips | Bulgarian split squats | Chest-height high pulls |
| 6 | Ring dips | Pistol squats | Waist-height high pulls |

ELITE: weighted ring dips / weighted pistol squats / weighted waist-height high pulls. Weighted movements are NOT rung 6.

## Thresholds
Push/pull: 15 clean Round-1 reps; bilateral squats: 30; unilateral squats: 15 per side (lower side governs). Reassess jump-squat threshold for safe technique. Test whether ring push-ups are easier than dips for each user; owner confirmed ring push-ups substantially harder than declines. Validate definitions of high pulls and equipment before deploying those rungs.

## Asset contract
For each of 18 rungs, create a separate source PNG 400x280 and optimized 100x70 WebP in `the-pure/dist/exercises/`. Names `push-1-knee.webp`, etc. Same pose silhouette style as existing `ready-push.webp`, `ready-squat.webp`, `ready-pull.webp`. Push red-orange #E02810, background #180818; Squat green #20E020, background #001810; Pull magenta #E020E0, background #080820. Side profile, solid neon silhouette with slight glow, equipment same color, no labels, no outlines or internal details. At 54px rendered width the exercise must be recognizable. The full source images and WebP assets are NOT YET PRESENT in this branch; do not substitute the infographic for production art.

## UI contract
On workout screen, show current rung's image/name/progress and compact named next-rung teaser. Entire ladder optional under More/Progress. Achievement unlocked: trophy/chime, persistent record; switch active rung and image only after current workout ends. Preserve history and allow revisiting previously unlocked exercises. Exercise ID, not array index, keys assets and records. Missing art falls back to existing movement image.

## Safety/release
No changes to production branch, deployment, workout data, secrets, or billing. Claude to prepare side-by-side screenshots and Android test link for owner approval before release. GitHub #115 is coordination thread.
