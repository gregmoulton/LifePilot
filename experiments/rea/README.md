# REA static-analysis pilot — isolated and no-cost

This experiment evaluates [Reverse Engineer Anything (REA)](https://github.com/morluto/rea) against a **synthetic, owned JavaScript artifact**. It does **not** analyze user data, production Life Pilot code, third-party apps, or proprietary binaries.

## Purpose

1. Verify REA can statically inventory and analyze a JavaScript application directory without executing the artifact.
2. Retain the original JSON evidence and process diagnostics.
3. Review its reported module/import graph, parsed sources, coverage, and limitations **before** deciding whether it adds value to any future, authorized reverse-engineering task.
4. Keep the POC independent of the app, its dependencies, external services, and deployment.

## Safety boundaries

- Workflow is branch-scoped to `experiment/rea-static-proof-20261102`. It may also be dispatched manually only if GitHub makes it available.
- **Never** runs for main, pull requests, releases, or deployments.
- Minimal `contents: read` permission; checkout does not persist credentials.
- No API keys or secrets; no application database or live endpoint access.
- Synthetic fixture has a top-level `throw` to make accidental execution detectable.
- Uses GitHub-hosted Ubuntu, Node 24, and the pinned public `rea-agents@6.7.0` package, with npm lifecycle scripts disabled.
- Tool is installed in runner temporary storage only, not added to Life Pilot.
- Reports retained for seven days. Their presence does not imply complete coverage or security approval.
- No auto-fix, external action, commits, merges, deployments, or paid providers.
- Avoid converting this to a privileged `pull_request_target` workflow or broadening its branch scope.

## Expected result

The workflow builds the demo as an on-runner copy of `fixture/`, analyzes the directory using:

```bash
rea analyze-javascript-application "$RUNNER_TEMP/rea-owned-demo" --json --full-output
```

The result is an artifact named `rea-poc-evidence` containing:

- `analysis.json` — original REA output, or typed error if available.
- `analysis.stderr` — original diagnostics.
- `exit-code.txt` — command exit status.
- `input-sha256.txt` — hashes of the two JavaScript source files and manifest.

Success criteria: REA exits 0, emits valid JSON, identifies the inspected directory, reports relevant JavaScript modules/import relationships, and records any coverage limitations. Merely exiting 0 is **not** proof of complete analysis.

If npm installation or GitHub Actions is unavailable, report the failure instead of claiming success. The live app and the fixture are never executed by REA.

## Future decision

Normal source review remains preferable for Life Pilot and The Pure because we own their source code. Only extend REA to a shipped/compiled artifact or an externally obtained application we are **authorized** to inspect, after verifying security, licensing, scope, and evidence usefulness. This pilot does not authorize copying a commercial product or bypassing access controls.

Reference: [REA's documented GitHub Actions example](https://github.com/morluto/rea/blob/main/docs/ci-analysis.md).
