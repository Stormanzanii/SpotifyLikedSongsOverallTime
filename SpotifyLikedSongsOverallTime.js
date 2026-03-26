(() => {
    "use strict";

    const ROUTE = "/collection/tracks";
    const HEADER_SELECTOR = ".main-entityHeader-headerText";
    const TITLE_SELECTOR = "h1";
    const CONTAINER_ID = "liked-songs-overall-time-container";
    const LABEL_ID = "liked-songs-overall-time-label";
    const SUBLABEL_ID = "liked-songs-overall-time-sublabel";
    const BUTTON_ID = "liked-songs-overall-time-button";
    const CACHE_KEY = "liked-songs-overall-time-cache-v4";
    const AUTO_REFRESH_INTERVAL_MS = 1000 * 60 * 90;

    let renderScheduled = false;
    let routePollTimer = null;
    let isCalculating = false;
    let lastAutoRefreshAttemptAt = 0;

    function waitForSpicetify() {
        if (!window.Spicetify?.Platform?.History || !window.Spicetify?.Platform?.PlaylistAPI || !window.Spicetify?.Platform?.LibraryAPI) {
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
        if (routePollTimer) {
            clearInterval(routePollTimer);
            routePollTimer = null;
        }

        scheduleRender();

        if (!isLikedSongsPage()) {
            document.getElementById(CONTAINER_ID)?.remove();
            return;
        }

        let attempts = 0;
        routePollTimer = setInterval(() => {
            attempts += 1;
            scheduleRender();

            if (document.getElementById(CONTAINER_ID) || attempts >= 20 || !isLikedSongsPage()) {
                clearInterval(routePollTimer);
                routePollTimer = null;
            }
        }, 500);
    }

    function scheduleRender() {
        if (renderScheduled) {
            return;
        }

        renderScheduled = true;
        requestAnimationFrame(() => {
            renderScheduled = false;
            renderUI();
        });
    }

    function isLikedSongsPage() {
        return Spicetify.Platform.History.location?.pathname === ROUTE;
    }

    function getLikedSongsUri() {
        return Spicetify.Platform.LibraryAPI._likedSongsUri;
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

    function formatDuration(totalMs) {
        const totalSeconds = Math.floor(totalMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${days} day${days === 1 ? "" : "s"} ${hours} hr ${minutes} min`;
    }

    function formatUpdatedAt(timestamp) {
        if (!timestamp) {
            return "";
        }

        try {
            return new Date(timestamp).toLocaleString();
        } catch {
            return "";
        }
    }

    function ensureUI(header) {
        let container = document.getElementById(CONTAINER_ID);
        if (container && container.parentElement !== header) {
            container.remove();
            container = null;
        }

        if (!container) {
            container = document.createElement("div");
            container.id = CONTAINER_ID;
            container.className = "main-entityHeader-metaData main-type-mesto";
            container.style.marginTop = "8px";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.alignItems = "flex-start";
            container.style.gap = "6px";

            const label = document.createElement("div");
            label.id = LABEL_ID;
            label.style.fontSize = "1rem";
            label.style.fontWeight = "700";
            label.style.color = "var(--spice-text, #fff)";

            const sublabel = document.createElement("div");
            sublabel.id = SUBLABEL_ID;
            sublabel.style.fontSize = "0.8125rem";
            sublabel.style.color = "var(--spice-subtext, rgba(255,255,255,0.7))";

            const button = document.createElement("button");
            button.id = BUTTON_ID;
            button.type = "button";
            button.textContent = "Generate Playtime";
            button.style.border = "1px solid rgba(255,255,255,0.28)";
            button.style.background = "transparent";
            button.style.color = "var(--spice-text, #fff)";
            button.style.borderRadius = "999px";
            button.style.padding = "6px 12px";
            button.style.fontSize = "0.8125rem";
            button.style.fontWeight = "600";
            button.style.cursor = "pointer";

            button.addEventListener("click", () => {
                calculateAndStorePlaytime().catch((error) => {
                    console.error("liked-songs-overall-time", error);
                    updateLabel("Playtime generation failed");
                    updateButtonState(false);
                });
            });

            container.appendChild(label);
            container.appendChild(sublabel);
            container.appendChild(button);
            header.appendChild(container);
        }

        return container;
    }

    function updateLabel(text) {
        const label = document.getElementById(LABEL_ID);
        if (label) {
            label.textContent = text;
        }
    }

    function updateSubLabel(text) {
        const sublabel = document.getElementById(SUBLABEL_ID);
        if (sublabel) {
            sublabel.textContent = text;
        }
    }

    function updateButtonState(disabled) {
        const button = document.getElementById(BUTTON_ID);
        if (!button) {
            return;
        }

        button.disabled = disabled;
        button.style.opacity = disabled ? "0.65" : "1";
        button.style.cursor = disabled ? "default" : "pointer";
        button.textContent = disabled ? "Generating..." : "Generate Playtime";
    }

    function renderCachedState() {
        const cache = readCache();
        if (!cache || typeof cache.totalDurationMs !== "number") {
            updateLabel("0 days 0 hr 0 min");
            updateSubLabel("Cached on -");
            return;
        }

        const durationText = formatDuration(cache.totalDurationMs);
        const updatedText = formatUpdatedAt(cache.updatedAt);
        updateLabel(durationText);
        updateSubLabel(updatedText ? `Cached on ${updatedText}` : "Cached on -");
    }

    function shouldAutoRefresh() {
        const cache = readCache();
        if (!cache || typeof cache.updatedAt !== "number") {
            return true;
        }

        const now = Date.now();
        return now - cache.updatedAt >= AUTO_REFRESH_INTERVAL_MS;
    }

    async function calculateAndStorePlaytime(options = {}) {
        if (isCalculating) {
            return;
        }

        const silent = Boolean(options.silent);
        isCalculating = true;
        updateButtonState(true);
        if (!silent) {
            updateLabel("Generating...");
            updateSubLabel("Cached on -");
        }

        try {
            const likedSongsUri = getLikedSongsUri();
            const contents = await Spicetify.Platform.PlaylistAPI.getContents(likedSongsUri);
            const items = Array.isArray(contents?.items) ? contents.items : [];

            const totalDurationMs = items.reduce((sum, item) => {
                return sum + Number(item?.duration?.milliseconds ?? 0);
            }, 0);

            writeCache({
                totalDurationMs,
                totalTracks: Number(contents?.totalLength ?? items.length),
                updatedAt: Date.now(),
            });

            renderCachedState();
        } finally {
            isCalculating = false;
            updateButtonState(false);
        }
    }

    function renderUI() {
        if (!isLikedSongsPage()) {
            document.getElementById(CONTAINER_ID)?.remove();
            return;
        }

        const header = findLikedSongsHeader();
        if (!header) {
            return;
        }

        ensureUI(header);
        updateButtonState(isCalculating);
        renderCachedState();

        if (!isCalculating && shouldAutoRefresh()) {
            const now = Date.now();
            if (now - lastAutoRefreshAttemptAt >= 60000) {
                lastAutoRefreshAttemptAt = now;
                calculateAndStorePlaytime({ silent: true }).catch((error) => {
                    console.error("liked-songs-overall-time", error);
                    updateButtonState(false);
                    renderCachedState();
                });
            }
        }
    }

    waitForSpicetify();
})();
