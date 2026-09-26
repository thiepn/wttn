# Privacy — Word to the Nations

Word to the Nations is designed as a **local-first** game.

## Game data

The game stores progress in the browser's local storage. It maintains a primary checksummed save, recovery snapshots, and separate guest/account save slots. Export works without an account.

Word to the Nations itself does not:

- require an account,
- include analytics code,
- include advertising code,
- sell user data,
- send analytics about Scripture reading or gameplay.

## Optional THIEPN Account and cloud saves

WTTN uses the shared THIEPN Account service and Google sign-in. THIEPN Account owns identity and sessions; the game does not store a separate password or copy authentication tokens into its save files. Signing out on this browser signs out its shared THIEPN session, not other devices.

After you enable cloud backup, WTTN sends complete game snapshots to the shared Supabase project, associated with your account ID. Snapshots contain campaign progress, purchasing plans, reading bookmarks and decoration placements. Cloud backup therefore includes reading preferences as part of the save, not as analytics. Visual quality, motion and audio remain device-local.

One active cloud campaign and up to five recovery snapshots are retained. Server revisions prevent stale devices from silently replacing newer progress. You can export your current save and cloud recovery snapshots from Account & cloud saves. Choosing between conflicting saves preserves a local recovery copy.

Delete WTTN cloud progress removes the active payload and its cloud recovery snapshots. A revision marker remains to prevent old devices from automatically re-uploading deleted progress. Deleting your THIEPN account removes its WTTN cloud records, including that marker. Local copies on other devices are not remotely erased; remove those copies on each device if required. Account deletion must be performed through THIEPN Account when that interface is available.

Browser storage and cloud saving can fail independently. WTTN reports their status separately and keeps play available offline. Hosting and Supabase may retain ordinary operational logs and backups according to their own retention policies.

Import and export are initiated by the player and operate on local save files.

## Hosting

A website host may independently keep ordinary web-server logs (for example IP address, requested file, timestamp, or browser user agent). Those logs are controlled by the host, not by the Word to the Nations application code.

## Installed app / service worker

The service worker caches the application shell locally so the game can start offline. It does not upload gameplay data.
