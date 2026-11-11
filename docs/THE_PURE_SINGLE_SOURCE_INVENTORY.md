# The Pure — single-source inventory and migration checklist

For issue #115 (approved architecture handoff). Inventory taken 2026-11-11 16:19 UTC by Claude.
Docs only. No code, deploy, merge, settings or data changes were made to produce this.

## 1. Why everyone has been confused

The Pure that Greg actually uses on his phone is **not in GitHub**.

| Where | What it is | Who can change it | Who can see the code |
|---|---|---|---|
| `https://the-pure-android.greg-moulton2.chatgpt.site` | **The real app** on Greg's Android home screen ("HIT 1.6 / TWO ROUNDS · WORKOUT READY", neon logo, owner-approved design). Holds Greg's workout history in Chrome storage for that address. | ChatGPT only | ChatGPT only. Claude cannot fetch it (blocked); no connected Chrome. Not in any GitHub branch (Claude searched every branch for `TWO ROUNDS` / `WORKOUT READY` app code — none). |
| `https://the-pure-hit16-preview.onrender.com` | Render static site, pinned to `c8fa11a`, auto-deploy off. | Anyone with Render access | GitHub |
| GitHub `pure/hit16-stabilization-20261111` (PR #113) | Most complete tested logic: verified save, no-HRM timed recovery, calibration + 70% floor, phone V2 import, PURE icon/manifest (`678e809`). **Owner rejected its look as the old design.** | GitHub | Everyone |

So two codebases have been edited in parallel: the hosted one (by ChatGPT) and the GitHub one (by Claude, Work, Grok, Cursor). Neither has the other's changes.

## 2. GitHub inventory (The Pure)

Repository is **public** (`private=false`). `main` is **not protected**. `pure/live` does **not exist yet**.

### Open draft PRs touching The Pure — 8
| PR | Branch | What |
|---|---|---|
| #113 | `pure/hit16-stabilization-20261111` | Consolidated candidate (#74 + #86 + recovery, calibration, V2 import, PWA icon) |
| #98 | `design/the-pure-polish-preview-20261106` | Visual polish preview |
| #97 | `docs/the-pure-release-registry-20261106` | Release registry / archive old links |
| #86 | `fix/pure-hrm-preflight-20261103` | HRM preflight, no-monitor gate (folded into #113) |
| #85 | `fix/pure-preflight-hrm-gate-20261103` | Earlier HRM gate attempt |
| #74 | `review/pure-work-hit16-verified-save-20261101` | Work's HIT 1.6 restoration + verified save (folded into #113) |
| #71 | `cursor/pure-v2-verified-save-f819` | Phone V2 verified-save import (#57) |
| #69 | `review/grok-pure-save-handoff-20261031` | Grok save-reliability module + 12 assertions |

### Pure-related branches — 20
| Last commit | Branch | Head |
|---|---|---|
| 2026-11-11 | `pure/scale-sync` | `9dab9ab` body metrics (FFM/FFMI) — **parked until ported onto the real design** |
| 2026-11-11 | `pure/hit16-stabilization-20261111` | `678e809` |
| 2026-11-11 | `preview/the-pure-hit16-c8fa11a` | `c8fa11a` (what Render preview serves) |
| 2026-11-11 | `parked/pure-finisher-20261111` | `278f5d0` Punisher/Finisher — on hold by owner |
| 2026-11-10 | `fix/pure-hrm-preflight-20261103` | `7c53dfb` |
| 2026-11-08 | `design/the-pure-polish-preview-20261106` | `3c388be` |
| 2026-11-06 | `docs/the-pure-release-registry-20261106` | `d4c0dce` |
| 2026-11-03 | `review/pure-work-hit16-verified-save-20261101` | `b547383` |
| 2026-11-03 | `fix/pure-preflight-hrm-gate-20261103` | `7ce94e5` |
| 2026-11-01 | `cursor/pure-v2-verified-save-f819` | `3ab8816` |
| 2026-10-31 | `review/grok-pure-save-handoff-20261031` | `a5d5c5a` |
| 2026-10-31 | `pure-workout-controls-20261020` | `83efd44` |
| 2026-10-31 | `fix/pure-save-verified-20261031` | `792983e` |
| 2026-10-20 | `pure-mobile-prototype-v1-20261018` | `bf62b9c` (saved body weight, estimated calories) |
| 2026-10-18 | `the-pure-max-round-lab-20261018` | `22a62ae` |
| 2026-10-18 | `pure-ai-coach-personality-spec-20261018` | `3cc8fd0` |
| 2026-10-16 | `pure-round-ready-2026-10-18` | `4710a5e` |
| 2026-10-16 | `prime-workout-mvp` | `a1d611e` |
| 2026-10-16 | `prime-progress-mvp` | `b3cf3bc` |
| 2026-11-09 | `main` | `a8c7284` (owner-locked design doc; old Prime Workout 1.0) |

### Render (workspace "Life Pilot")
| Service | Type | Source | Auto-deploy |
|---|---|---|---|
| `the-pure-hit16-preview` | static site | `preview/the-pure-hit16-c8fa11a` (pinned `c8fa11a`) | off |
| `LifePilot` | web service (free) | `ai-copilot` | on |

## 3. Feature-gap matrix

Cannot be completed until the hosted app's source is in GitHub (step A below). Known so far:

| Feature | Hosted phone app | GitHub #113 |
|---|---|---|
| Owner-approved look (neon logo, dark navy, WORKOUT READY) | Yes | No — rejected as old design |
| Verified save + rollback | ? | Yes, tested |
| No-HRM timed recovery | ? | Yes, tested |
| Calibration + historical-max 70% floor | ? | Yes, tested |
| Phone V2 import | n/a | Yes, tested |
| PURE launcher icon / manifest | ? | Yes (`678e809`) |
| Body metrics FFM/FFMI | No | `pure/scale-sync` only |
| Shows deployed commit in app | Unknown | Yes (`build-info.json`) |

## 4. Migration checklist (each ☐ is a gate; nothing skips ahead)

**A. Recover the real app (ChatGPT)**
- ☐ ChatGPT commits the exact hosted source of `the-pure-android.greg-moulton2.chatgpt.site`, unmodified, to new branch `recovery/the-pure-android-chatgpt-site`, with a file list and SHA-256 of each file.
- ☐ ChatGPT stops publishing changes to the chatgpt.site copy (it stays running for Greg until cutover).

**B. Make it the base**
- ☐ Claude verifies the recovered files render the owner-approved design (phone-size screenshots back to Greg).
- ☐ With Greg's approval, `pure/live` is created from the recovered source exactly.

**C. Bring the tested fixes onto the real design**
- ☐ One integration PR into `pure/live` ports #113's logic onto the recovered UI without changing its look. Screenshots before/after.
- ☐ The 7 other open Pure PRs are marked superseded and closed (nothing deleted; branches kept).

**D. Preview, then move history**
- ☐ With Greg's approval for that exact commit: free Render static site `the-pure` from `pure/live`, commit shown in-app.
- ☐ Greg: old site → **Save backup**. New site → import. Check record counts and a few workouts match.
- ☐ Greg runs the Android/Chromebook acceptance checklist on the new site.

**E. Cutover (separate explicit approval)**
- ☐ Greg installs the new site to his home screen. Old icon kept until he's satisfied.
- ☐ Only then: retire the chatgpt.site copy.

## 5. Release plan / protection (proposed — needs Greg's approval; changes repo settings)
- Protect `pure/live` and `main`: no direct pushes, no force-push, no deletion; changes only by PR; PR needs Greg's approval.
- The Pure Render site deploys only from `pure/live`.
- Every agent works on its own branch and opens a PR that links #115. One open integration PR for The Pure at a time.

## 6. Data and privacy
- This repository is **public**. No workout, body-weight, health or nutrition records, backups, screenshots of personal data, or secrets may be committed. Tests use fictional data only.
- Backups go to the private Drive folder per #115, not GitHub.
