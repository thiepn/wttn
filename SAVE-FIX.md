# v2.10.5 — quota-safe primary saves

The save warning shown as “The browser has no room for this save” could be triggered even when the current save itself still fit. WTTN wrote the previous save into a second localStorage backup before replacing the primary. Because localStorage is quota-limited per origin (so apps under the same site share the same pool), that duplicate could consume the remaining space and make the real save fail.

v2.10.5 changes the order and recovery behavior:

- the verified primary save is written first;
- if that write hits quota, WTTN removes only redundant WTTN backup/legacy copies and retries the primary;
- the existing primary is never deleted before a verified replacement succeeds;
- unrelated keys from other apps are never touched;
- the previous save is written as a best-effort recovery backup only after the primary is safe;
- obsolete v1–v5 WTTN save keys are pruned after a successful current-schema save.

The warning still appears if the primary cannot be stored even after WTTN has reclaimed its own redundant copies. Export remains available in that genuine failure case.

Regression coverage verifies that quota recovery saves the new primary, removes only WTTN-owned redundant copies, preserves unrelated application data, and keeps the old primary intact when every write still fails.

---

# v2.10.2 — verified save status

The previous startup sequence could successfully replace the real save, then show a failure because a redundant extra storage-probe key could not be added. The same broad error handler also classified interface errors after writing as browser-storage failures. The reported user's exact browser condition was not reproduced in the available Chromium session, where saving already worked.

This patch removes the extra probe and bases status on the actual save write plus an exact read-back. It keeps real failures visible: capacity errors, blocked storage, non-retained writes and save-preparation failures receive distinct messages. A native hidden attribute and initially empty text prevent a warning flashing before initialization. Retry saving and Export progress are available directly in a genuine warning. Successful retries clear it. Invalid-save quarantine, recovery data, the storage key and schema 8 remain unchanged.

Ten regression groups cover real envelope round-trips, a full store that permits replacing the save but rejects the old probe, silently discarded writes, quota and permission failures, serialization errors, post-write UI exceptions, successful retries, quarantine and default warning visibility. The actual app save function is exercised in a DOM/storage test harness. Numeric and economy files are unchanged.

In the running v2.10.2 browser build, a purchased Scribe survived Save and reload; both primary and recovery were valid and the warning remained natively hidden. The available browser was Chromium. A game cannot override browser policies that genuinely deny all site storage; the corresponding warning and export option remain intentionally available.

To update an already-open installation, use Menu → System → Apply update when offered. If that browser cannot save, export current progress before reloading or closing it.
