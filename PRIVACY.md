# Privacy — Word to the Nations

Word to the Nations is designed as a **local-first** game.

## Game data

The game stores progress in the browser's local storage. It maintains a primary checksummed save and a local recovery snapshot.

Word to the Nations itself does not:

- require an account,
- send your save to a game server,
- include analytics code,
- include advertising code,
- sell user data,
- transmit Scripture/milestone activity to a backend.

Import and export are initiated by the player and operate on local save files.

## Hosting

A website host may independently keep ordinary web-server logs (for example IP address, requested file, timestamp, or browser user agent). Those logs are controlled by the host, not by the Word to the Nations application code.

## Installed app / service worker

The service worker caches the application shell locally so the game can start offline. It does not upload gameplay data.
