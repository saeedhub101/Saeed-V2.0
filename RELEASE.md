# Release Procedure

Current published stable version: **4.4.1** (`v4.4.1`). Do not publish a new release until the current source changes and all release gates are verified.

## Required sequence

1. Confirm `package.json`, `VERSION` and Electron Builder `build.buildVersion` agree. Increment the version for the next stable release; never overwrite an existing tag.
2. Run `npm ci` and `npm test`. Fix failures and release-blocking warnings.
3. Inspect the Windows Actions run and each job's step logs. Verify test summaries, not just the workflow conclusion. Confirm the installer exists and its size/hash are recorded.
4. Verify on Windows: clean install, first startup, tray, Show/Hide, Character Settings, Chat/Mic, mute, rest-pose and animation persistence, learning/add-ons, graceful shutdown and update behavior.
5. Measure CPU/RAM per process at idle, with character rendering, Brain active, Mic ON, and after closing/hiding features. Confirm children terminate when no longer needed.
6. Publish only after required checks pass. Include the installer, checksum and concise release notes. Do not claim unexecuted Windows runtime checks passed.

A commit or successful Actions run does not itself publish a release. If release creation is unavailable through the connected GitHub actions, report that limitation rather than implying a release was created.
