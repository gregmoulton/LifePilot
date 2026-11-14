# The Purist — exercise art manifest (Ladder v1.0)

Source of truth for exercise IDs is `the-pure/dist/ladder.js` on `pure/live-integrate-hit16`. Owner art rules are in #122 (comment of 2026-11-14) and #115.

## Logo: one immutable master
- **Approved mark:** "Sleek P (Option 3, original)" from `brand/three-finalist-p-logos.png`.
- **Master files:**
  - `brand/sleek-p.svg` is the vector, traced 1:1 from Option 3;
  - `brand/sleek-p-white-1024.png` and `brand/sleek-p-black-1024.png` are transparent versions;
  - checksums are in `brand/SLEEK-P-SHA256SUMS.txt`.
- **Do / don't:** see `brand/sleek-p-reference-sheet.png`. Never mirror, rotate, slant, redraw, gradient, or add a swoosh. Always the same orientation.
- **Gap:** no original vector or designer source file exists in the repo. The SVG is a faithful trace of the approved raster. If a designer original exists, it replaces this file.

## Character and kit (every image)
- **Character:** the same Purist face, build and proportions. Short dark hair, light 5-o'clock stubble (clean-shaven acceptable). No beard, no long hair. Shirtless for demos.
- **Kit:**
  - black shorts with one thin category-colored side stripe;
  - dark athletic shoes, white sole, Sleek P on the outer side;
  - wristband with a small P.
- **Treatments:**
  - **photorealistic** for the active-exercise hero and queue thumbnails;
  - **stylized blue-lit** for Ready, Results, History and branding.
- **Rules:** no metallic effect; no third-party marks.

## Files per exercise
- `<id>-hero.png`: 1536×1024 (3:2) master. The figure fills about 80% of the frame. Plain dark background. No text.
- `<id>-thumb.png`: 512×512 square crop from the hero, centered on the body, readable at 56 px.
- **App conversion (done by Claude):**
  - WebP, quality 85;
  - hero widths 1080, 720 and 480;
  - thumbs 256 and 128;
  - all precached by the service worker.
- **Muscle highlight:** a subtle glow on primary muscles only, in category color: Push #FF5638, Squat #39E66B, Pull #B64DFF.
- **Licensing:** generated for The Pure. The owner keeps all rights. No stock or third-party elements.

## The 18 ladder rungs plus 3 ELITE: accuracy requirements
| ID | Exercise | Apparatus / setup | Position and range of motion | Primary muscles |
|---|---|---|---|---|
| push-1-knee-incline | Knee/incline push-up | Hands on a bench/box (incline) or knees on floor | Straight line knees/feet to head; chest to the edge | Chest, front delts, triceps |
| push-2-standard | Push-up | Floor | Hands just wider than shoulders; chest near floor; body rigid | Chest, front delts, triceps |
| push-3-decline | Decline push-up | **Feet on box/bench**, hands on floor | Hips not piked; chest near floor | Upper chest, front delts, triceps |
| push-4-ring | Ring push-up | Gymnastic rings low to the floor, feet on floor | Rings turned out at the top; chest between rings | Chest, delts, triceps, stabilizers |
| push-5-bar-dips | Parallel-bar dip | Parallel bars | Straight-arm support → shoulders just below elbows; slight forward lean | Lower chest, triceps, front delts |
| push-6-ring-dips | Ring dip | Rings at height | Arms close to body, rings turned out at the top | Chest, triceps, delts, stabilizers |
| push-elite-weighted-ring-dips | Weighted ring dip | Rings + weight vest (no brand) | As ring dip | As ring dip |
| squat-1-chair | Chair squat | Chair behind | Sit back to touch the chair, then stand; knees track toes | Quads, glutes |
| squat-2-bodyweight | Bodyweight squat | Floor | Thighs at or below parallel; heels down; arms forward | Quads, glutes, hamstrings |
| squat-3-jump | Jump squat | Floor | **Single figure**, airborne just after takeoff from a deep squat | Quads, glutes, calves |
| squat-4-step-up | Step-up | Box 12/14/16 in | One foot on the box, driving up to a full stand | Quads, glutes (working leg) |
| squat-5-bulgarian | Bulgarian split squat | Rear foot on a bench | Front thigh near parallel; torso upright | Quads, glutes (front leg) |
| squat-6-pistol | Pistol squat | Floor | One-leg squat to full depth; other leg straight forward | Quads, glutes, core |
| squat-elite-weighted-pistol | Weighted pistol | Holding a plate/kettlebell (no brand) | As pistol | As pistol |
| pull-1-inverted-bent | Inverted row, bent-knee | Bar at about waist height | **Knees bent, feet flat**; chest pulled to the bar; overhand grip | Lats, mid back, rear delts, biceps |
| pull-2-inverted-straight | Inverted row, straight-leg | Bar at about waist height | **Legs straight, heels down**; body rigid; chest to the bar | Lats, mid back, rear delts, biceps |
| pull-3-assisted | Assisted pull-up | Bar + resistance band under the foot or knee | Dead hang → chin over the bar | Lats, biceps |
| pull-4-pullup | Pull-up | Bar | Overhand grip, dead hang → chin over the bar | Lats, biceps, rear delts |
| pull-5-ring-pullup | Ring pull-up | Rings overhead | Neutral grip turning in; chin over the rings | Lats, biceps, grip |
| pull-6-assisted-archer | Assisted archer pull-up | Bar (+ band) | Pull toward one hand, other arm extended straight along the bar | Lats (working side), biceps |
| pull-elite-muscle-up | Bar muscle-up (strict) | Bar | Transition over the bar to straight-arm support; no kipping | Lats, chest, triceps, core |

## Production gate (owner)
1. Generate the **first triplet** with the verified P and the canonical character: push-3-decline, squat-3-jump, pull-1-inverted-bent.
2. Get owner visual acceptance.
3. Then the remaining 15 rungs; ELITE later.
4. No asset counts as existing until it is delivered and inspected (Claude checks SHA, logo, exercise accuracy and 56 px readability).
