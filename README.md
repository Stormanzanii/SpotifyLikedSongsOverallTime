# Liked Songs Overall Time

Spicetify extension that shows the total playtime for `Liked Songs`, similar to the duration shown on normal playlists.

## Install

1. Copy [liked-songs-overall-time.js](D:\Coding Proj\LikedSongsOverallTime\liked-songs-overall-time.js) into your Spicetify `Extensions` folder.
2. Enable it:

```powershell
spicetify config extensions liked-songs-overall-time.js
spicetify apply
```

3. Restart Spotify if needed, then open `Liked Songs`.

## Notes

- The extension runs on the `Liked Songs` page at `/collection/tracks`.
- It uses `Spicetify.Platform.LibraryAPI.getTracks(...)` against Spotify's internal liked-songs collection.
- Results are cached for 30 minutes and refreshed automatically when your liked-song count changes.
