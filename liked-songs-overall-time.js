(() => {
    "use strict";

    const ROUTE = "/collection/tracks";
    const HEADER_SELECTOR = ".main-entityHeader-headerText";
    const TITLE_SELECTOR = "h1";
    const LABEL_ID = "liked-songs-overall-time-label";
    const ROW_SELECTOR = '[data-testid="tracklist-row"]';
    const DURATION_SELECTOR = '[data-testid="track-duration"], .main-trackList-rowDuration';
    const TRACK_COUNT_SELECTOR = '[data-testid="playlist-tracklist-count"], .main-entityHeader-metaData span';
    const TOTAL_COUNT_CACHE_KEY = "liked-songs-overall-time-total-count-v1";

    let renderScheduled = false;
    let observer = null;
    let totalCountPromise = null;

    function waitForSpicetify() {
        if (!window.Spicetify?.Platform?.History) {
            setTimeout(waitForSpicetify, 300);
            return;
        }

        start();
    }

    function start() {
        Spicetify.Platform.History.listen(() => handleRouteChange());
        handleRouteChange();
    }

    function handleRouteChange() {
        disconnectObserver();

        if (!isLikedSongsPage()) {
            document.getElementById(LABEL_ID)?.remove();
            return;
        }

        scheduleRender();
        attachObserver();
    }

    function attachObserver() {
        observer = new MutationObserver(() => {
            if (!isLikedSongsPage()) {
                return;
            }

            scheduleRender();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    function disconnectObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    function scheduleRender() {
        if (renderScheduled) {
            return;
        }

        renderScheduled = true;
        requestAnimationFrame(() => {
            renderScheduled = false;
            renderLikedSongsDuration();
        });
    }

    function isLikedSongsPage() {
        return Spicetify.Platform.History.location?.pathname === ROUTE;
    }

    function findLikedSongsHeader() {
        const title = Array.from(document.querySelectorAll(TITLE_SELECTOR)).find(
            (node) => node.textContent?.trim() === "Liked Songs"
        );

        if (!title) {
            return null;
        }

        return title.closest(HEADER_SELECTOR) || title.parentElement?.closest(HEADER_SELECTOR) || null;
    }

    function ensureLabel(header) {
        let label = document.getElementById(LABEL_ID);
        if (label && label.parentElement !== header) {
            label.remove();
            label = null;
        }

        if (!label) {
            label = document.createElement("div");
            label.id = LABEL_ID;
            label.className = "main-entityHeader-metaData main-type-mesto";
            label.style.marginTop = "8px";
            label.style.fontSize = "0.875rem";
            label.style.color = "var(--spice-subtext, rgba(255,255,255,0.7))";
            header.appendChild(label);
        }

        return label;
    }

    function readCachedTotalCount() {
        try {
            const raw = Spicetify.LocalStorage.get(TOTAL_COUNT_CACHE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            return typeof parsed?.count === "number" ? parsed.count : null;
        } catch {
            return null;
        }
    }

    function writeCachedTotalCount(count) {
        try {
            Spicetify.LocalStorage.set(TOTAL_COUNT_CACHE_KEY, JSON.stringify({
                count,
                updatedAt: Date.now(),
            }));
        } catch {
            // Ignore cache write failures.
        }
    }

    function getAccessToken() {
        const token = Spicetify.Platform.Session?.accessToken;
        return typeof token === "string" && token.length > 0 ? token : null;
    }

    async function fetchLikedSongsTotalCount() {
        if (totalCountPromise) {
            return totalCountPromise;
        }

        totalCountPromise = (async () => {
            const token = getAccessToken();
            if (!token) {
                throw new Error("Spotify session token is not ready yet.");
            }

            const response = await fetch("https://api.spotify.com/v1/me/tracks?limit=1&offset=0", {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Spotify API request failed with status ${response.status}.`);
            }

            const data = await response.json();
            const count = Number(data?.total ?? 0);
            writeCachedTotalCount(count);
            return count;
        })();

        try {
            return await totalCountPromise;
        } finally {
            totalCountPromise = null;
        }
    }

    function refreshTotalCountInBackground() {
        fetchLikedSongsTotalCount().catch(() => {
            // Keep the UI on cached/DOM data if the total-count request fails.
        });
    }

    function parseDurationText(text) {
        if (!text) {
            return 0;
        }

        const parts = text.trim().split(":").map(Number);
        if (parts.some((part) => Number.isNaN(part))) {
            return 0;
        }

        if (parts.length === 2) {
            return (parts[0] * 60 + parts[1]) * 1000;
        }

        if (parts.length === 3) {
            return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        }

        return 0;
    }

    function formatDuration(totalMs) {
        const totalSeconds = Math.floor(totalMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        const parts = [];
        if (days > 0) {
            parts.push(`${days} day${days === 1 ? "" : "s"}`);
        }
        if (hours > 0) {
            parts.push(`${hours} hr`);
        }
        parts.push(`${minutes} min`);
        return parts.join(" ");
    }

    function getLoadedTrackStats() {
        const rows = Array.from(document.querySelectorAll(ROW_SELECTOR));
        let totalDurationMs = 0;
        let loadedTracks = 0;

        for (const row of rows) {
            const durationNode = row.querySelector(DURATION_SELECTOR);
            const durationMs = parseDurationText(durationNode?.textContent ?? "");
            if (durationMs > 0) {
                totalDurationMs += durationMs;
                loadedTracks += 1;
            }
        }

        return {
            loadedTracks,
            totalDurationMs,
        };
    }

    function getTotalTrackCount() {
        const cachedCount = readCachedTotalCount();
        if (typeof cachedCount === "number") {
            return cachedCount;
        }

        const nodes = Array.from(document.querySelectorAll(TRACK_COUNT_SELECTOR));
        for (const node of nodes) {
            const text = node.textContent ?? "";
            const match = text.match(/([\d,]+)\s+song/i);
            if (match) {
                return Number(match[1].replace(/,/g, ""));
            }
        }

        return null;
    }

    function renderLikedSongsDuration() {
        if (!isLikedSongsPage()) {
            document.getElementById(LABEL_ID)?.remove();
            return;
        }

        const header = findLikedSongsHeader();
        if (!header) {
            return;
        }

        const label = ensureLabel(header);
        const stats = getLoadedTrackStats();
        const totalTrackCount = getTotalTrackCount();

        if (totalTrackCount === null) {
            refreshTotalCountInBackground();
        }

        if (stats.loadedTracks === 0) {
            if (totalTrackCount) {
                label.textContent = `Scroll the list to calculate playtime (0/${totalTrackCount} tracks loaded)`;
            } else {
                label.textContent = "Scroll the list to calculate playtime";
            }
            return;
        }

        const durationText = formatDuration(stats.totalDurationMs);
        if (totalTrackCount && stats.loadedTracks < totalTrackCount) {
            label.textContent = `${durationText} loaded (${stats.loadedTracks}/${totalTrackCount} tracks)`;
            return;
        }

        label.textContent = durationText;
    }

    waitForSpicetify();
})();
