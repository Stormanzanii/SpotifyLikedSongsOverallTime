# Liked Songs Overall Time

A Spicetify extension that adds cached total playtime for `Liked Songs`.

It adds a manual `Generate Playtime` button to the `Liked Songs` header, calculates the full duration from Spotify's internal `PlaylistAPI`, and stores the result locally so it can be shown again without recalculating every time.

## Features

- Adds total `day hr min` playtime to the `Liked Songs` page
- Adds a `Cached on ...` timestamp
- Uses a manual button instead of running automatically on every page load
- Avoids Spotify Web API rate-limit issues by using the internal client playlist contents

## Installation

### Option 1: PowerShell installer

Run [install.ps1](/install.ps1) from this repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### Option 2: Manual install

1. Copy [liked-songs-overall-time.js](/liked-songs-overall-time.js) into your Spicetify `Extensions` folder.
2. Enable the extension:

```powershell
spicetify config extensions liked-songs-overall-time.js
spicetify apply
```

3. Open `Liked Songs`.
4. Click `Generate Playtime`.

## Notes

- Route: `/collection/tracks`
- Data source: `Spicetify.Platform.PlaylistAPI.getContents(...)`
- Cache storage: `Spicetify.LocalStorage`

## License

MIT
