# Liked Songs Overall Time

Spicetify extension that adds a manual `Generate Playtime` button to `Liked Songs` and caches the full total duration locally.

## Install

1. Copy [liked-songs-overall-time.js](D:\Coding Proj\LikedSongsOverallTime\liked-songs-overall-time.js) into your Spicetify `Extensions` folder.
2. Enable it:

```powershell
spicetify config extensions liked-songs-overall-time.js
spicetify apply
```

3. Restart Spotify if needed, then open `Liked Songs`.
4. Click `Generate Playtime` on the `Liked Songs` page.

## Notes

- The extension runs on the `Liked Songs` page at `/collection/tracks`.
- It uses `Spicetify.Platform.PlaylistAPI.getContents(...)` with the `Liked Songs` collection URI.
- The button computes the full total on demand and stores the result in local cache.
