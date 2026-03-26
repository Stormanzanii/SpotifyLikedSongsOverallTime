(() => {
    "use strict";

    const ROUTE = "/collection/tracks";
    const HEADER_SELECTOR = ".main-entityHeader-headerText";
    const TITLE_SELECTOR = "h1";
    const LABEL_ID = "liked-songs-overall-time-label";
    const CACHE_KEY = "liked-songs-overall-time-cache-v3";
    const CACHE_MAX_AGE_MS = 1000 * 60 * 30;
    const PAGE_SIZE = 50;
    const BASE_DELAY_MS = 250;
    const MAX_RETRIES = 5;

    let renderScheduled = false;
    let activeRequestToken = 0;
    let isRendering = false;

    function waitForSpicetify() {
        if (!window.Spicetify?.Platform?.History || !window.Spicetify?.Platform?.LibraryAPI) {
            setTimeout(waitForSpicetify, 300);
            return;
        }

        start();
    }

    function start() {
        Spicetify.Platform.History.listen(() => scheduleRender());

        new MutationObserver(() => {
            if (isLikedSongsPage()) {
                scheduleRender();
            }
        }).observe(document.body, {
            childList: true,
            subtree: true,
        });

        scheduleRender();
    }

    function scheduleRender() {
        if (renderScheduled || isRendering) {
            return;
        }

        renderScheduled = true;
        requestAnimationFrame(async () => {
            renderScheduled = false;
            await renderLikedSongsDuration();
        });
    }

    function isLikedSongsPage() {
        return Spicetify.Platform.History.location?.pathname === ROUTE;
    }

    function readCache() {
        try {
            const raw = Spicetify.LocalStorage.get(CACHE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function writeCache(cache) {
        try {
            Spicetify.LocalStorage.set(CACHE_KEY, JSON.stringify(cache));
        } catch {
            // Ignore cache write failures.
        }
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

    function setLabelText(label, text) {
        label.textContent = text;
    }

    function getAccessToken() {
        const token = Spicetify.Platform.Session?.accessToken;
        return typeof token === "string" && token.length > 0 ? token : null;
    }

    function sleep(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    async function fetchLikedSongsPage(offset, limit, attempt = 0) {
        const token = getAccessToken();
        if (!token) {
            throw new Error("Spotify session token is not ready yet.");
        }

        const response = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`, {
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        if (response.status === 429) {
            if (attempt >= MAX_RETRIES) {
                throw new Error("Spotify rate limit exceeded.");
            }

            const retryAfterSeconds = Number(response.headers.get("retry-after") ?? 1);
            await sleep(Math.max(retryAfterSeconds * 1000, 1000));
            return fetchLikedSongsPage(offset, limit, attempt + 1);
        }

        if (!response.ok) {
            throw new Error(`Spotify API request failed with status ${response.status}.`);
        }

        return response.json();
    }

    function extractDurationMs(item) {
        const candidates = [
            item?.durationMs,
            item?.duration_ms,
            item?.length?.milliseconds,
            item?.length?.totalMilliseconds,
            item?.trackMetadata?.durationMs,
            item?.trackMetadata?.duration_ms,
            item?.track?.durationMs,
            item?.track?.duration_ms,
            item?.track?.length?.milliseconds,
            item?.track?.length?.totalMilliseconds,
            item?.metadata?.durationMs,
            item?.metadata?.duration_ms,
            item?.audio?.durationMs,
            item?.audio?.duration_ms,
            item?.track?.duration_ms,
        ];

        for (const candidate of candidates) {
            if (typeof candidate === "number" && Number.isFinite(candidate)) {
                return candidate;
            }
        }

        return 0;
    }

    async function getLikedSongsStats() {
        const firstPage = await fetchLikedSongsPage(0, PAGE_SIZE);
        const totalTracks = Number(firstPage?.total ?? 0);
        let totalDurationMs = 0;
        let offset = 0;
        let items = Array.isArray(firstPage?.items) ? firstPage.items : [];

        while (offset < totalTracks) {
            if (offset !== 0) {
                await sleep(BASE_DELAY_MS);
                const page = await fetchLikedSongsPage(offset, PAGE_SIZE);
                items = Array.isArray(page?.items) ? page.items : [];
            }

            if (items.length === 0) {
                break;
            }

            for (const item of items) {
                totalDurationMs += extractDurationMs(item);
            }

            offset += items.length;
        }

        return {
            totalTracks,
            totalDurationMs,
        };
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

    async function getDurationText() {
        const cache = readCache();
        const now = Date.now();
        const stats = await getLikedSongsStats();

        if (
            cache &&
            cache.totalTracks === stats.totalTracks &&
            typeof cache.totalDurationMs === "number" &&
            now - Number(cache.updatedAt ?? 0) < CACHE_MAX_AGE_MS
        ) {
            return formatDuration(cache.totalDurationMs);
        }

        writeCache({
            totalTracks: stats.totalTracks,
            totalDurationMs: stats.totalDurationMs,
            updatedAt: now,
        });

        return formatDuration(stats.totalDurationMs);
    }

    async function renderLikedSongsDuration() {
        if (!isLikedSongsPage()) {
            document.getElementById(LABEL_ID)?.remove();
            return;
        }

        const header = findLikedSongsHeader();
        if (!header) {
            return;
        }

        const label = ensureLabel(header);
        const requestToken = ++activeRequestToken;
        setLabelText(label, "Calculating playtime...");
        isRendering = true;

        try {
            const durationText = await getDurationText();
            if (requestToken !== activeRequestToken || !isLikedSongsPage()) {
                return;
            }

            setLabelText(label, durationText);
        } catch (error) {
            if (requestToken !== activeRequestToken || !isLikedSongsPage()) {
                return;
            }

            console.error("liked-songs-overall-time", error);
            const message = String(error?.message || "");
            if (message.includes("not ready yet")) {
                setLabelText(label, "Waiting for Spotify session...");
                window.setTimeout(scheduleRender, 1000);
            } else if (message.includes("rate limit")) {
                setLabelText(label, "Rate limited, retrying soon...");
                window.setTimeout(scheduleRender, 1000);
            } else {
                setLabelText(label, "Playtime unavailable");
            }
        } finally {
            isRendering = false;
        }
    }

    waitForSpicetify();
})();
