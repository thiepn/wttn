# WTTN account integration — v2.11.0

WTTN is a consumer of THIEPN Account SDK 1.x. No second identity system or Supabase project is created. The shared SDK is loaded from `/account-platform/sdk/v1/index.js`; the locally vendored Supabase JS dependency is pinned to 2.116.0 with its license and npm lockfile.

## Release gate

The game integration is staged on `codex/wttn-account-cloud-saves`. The account-management UI is still being built, so no speculative management URL is exposed. Do not merge to `main` until the central account owner verifies Google sign-in, callback allowlisting, shared sessions, and cross-device smoke tests using designated test accounts.

In the existing Supabase project `hycegznamzjhwinegaai`, allow exactly `https://thiepn.dev/wttn/` as the game OAuth return URL. Add explicit development callback origins only when testing locally. Google's authorized redirect remains the Supabase provider callback; no Google client secret belongs in this repository. The WTTN integration does not change project-wide Auth configuration.

## Backend contract

Migration `wttn_cloud_saves` adds private save/history tables, owner-checked transactional commands, and four public SECURITY INVOKER RPCs: `wttn_read_save`, `wttn_write_save`, `wttn_delete_save`, `wttn_save_history`. The private command is SECURITY DEFINER because callers must not have direct writes that bypass revision checks; it checks `auth.uid()` and current account existence on every call. All functions have a fixed empty search path. Anonymous access and direct table access are revoked; RLS is enabled as defense in depth.

Writes use expected revision + UUID request ID. An exact retry returns the existing revision. Stale revisions return a conflict with the current snapshot. A deleted record retains its revision with no payload; only explicit re-enabling against the current revision can restore it. History is bounded to five significant pre-change snapshots. Both tables reference `auth.users ON DELETE CASCADE`. Platform metadata/export discovers WTTN through the existing account registry; full game-data export remains app-owned.

The backend accepts at most 2 MiB per full snapshot. Client validators check the unchanged economic envelope, supported state version, checksum and approved placement IDs before loading. Checksums detect corruption, not cheating; this is a private single-player backup service, not an authoritative multiplayer economy.

## Local state and recovery

Economic schema 8 and `wttn.phase6.save.v6` remain unchanged. `wttn.cloud.v1.*` records store the original save, guest/account slots, revisions, pending request IDs and recovery copies; never credentials. Account switching uses a verified journal that is recovered before the main save is loaded. Local storage failure stops account linking/switching rather than accepting progress without a recovery copy. Account-owned slots are the startup authority; the legacy key is a compatibility mirror. An older client cannot attribute its writes to an account by overwriting that key.

Web Locks permit one active WTTN writer per origin. A second game tab waits and resumes automatically when the active tab closes. Browsers without Web Locks retain guest play/export but cannot link cloud saves. This guard protects local saves independently of database revision checks.

Offline simulation runs before the restored snapshot receives a new timestamp. Retry never replays simulation. A network failure does not log out the user. Routine cloud saving is limited to once a minute; important transitions may sync immediately. Exit saves locally and does not rely on a last network request.

## Verification and rollout

- `npm run test:account`: deterministic two-device, conflict, storage, retry, deletion and offline-queue tests.
- `tests/cloud-database.sql`: transactional database tests with disposable synthetic identities, all rolled back. No real user saves are inspected or changed.
- `node tools/run-release-tests.cjs`: economy, numeric, save, presentation, delivery and account suites.
- `python tools/build.py`: content-hashed static build; no Auth/save API responses enter the service-worker cache.
- `.github/workflows/thiepn-account.yml`: consumer conformance pinned to the published platform release.

Before promotion, verify Google login from both the central account UI and WTTN, shared local sign-out, desktop/phone continuation, real offline reconnection, account deletion, and the final central account-management link. The game remains available to guests if the account SDK or backend is unavailable.

For repeatable UI checks without an account, run `python tools/preview-account.py --port 8797 --sdk tests/fixtures/account-sdk.mjs`. This explicitly substitutes a local fake account and cloud save. The fixture is never copied into the deployable site and never contacts Google or Supabase.
