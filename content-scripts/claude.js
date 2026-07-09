
(function () {
  const PLATFORM = "claude";
  let draftId = null;
  let debounceTimer = null;
  let lastPath = location.pathname;

  function extractConversationId() {
    const match = location.pathname.match(/\/chat\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  }

  function getConversationId() {
    const real = extractConversationId();
    if (real) return real;
    if (!draftId) draftId = "draft-" + Math.random().toString(36).slice(2, 10);
    return draftId;
  }

  function cleanTitle() {
    const raw = document.title || "";
    return raw.replace(/\s*[-–—]\s*Claude\s*$/i, "").trim() || "Untitled conversation";
  }

  function scanMessages() {
    const nodes = document.querySelectorAll(
      '[data-testid="user-message"], .font-claude-message'
    );
    const messages = [];
    nodes.forEach((node, idx) => {
      const role = node.matches('[data-testid="user-message"]') ? "user" : "assistant";
      const text = (node.innerText || "").trim();
      if (!text) return;
      messages.push({ id: `idx-${idx}`, role, content: text, index: idx });
    });
    return messages;
  }

  async function syncConversation() {
    try {
      const messages = scanMessages();
      if (messages.length === 0) return;

      const conversationId = getConversationId();
      const existing = await CKStorage.getConversation(PLATFORM, conversationId);

      // Skip the write if nothing actually changed (cheap dedupe).
      if (existing && existing.messages.length === messages.length) {
        const lastExisting = existing.messages[existing.messages.length - 1];
        const lastNew = messages[messages.length - 1];
        if (lastExisting.content === lastNew.content) return;
      }

      const conversation = {
        platform: PLATFORM,
        conversationId,
        url: location.href,
        title: cleanTitle(),
        createdAt: existing?.createdAt || Date.now(),
        messages,
      };

      await CKStorage.saveConversation(conversation);
      console.debug(
        `[Threadly] saved ${messages.length} messages for conversation ${conversationId}`
      );
    } catch (err) {
      // A broken selector should stop capture, not break Claude for the user.
      console.debug("[Threadly] sync skipped:", err);
    }
  }

  function scheduleSync() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(syncConversation, 800);
  }

  function watchForNavigation() {
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        scheduleSync();
      }
    }, 1500);
  }

  function getOrgIdFromCookie() {
    try {
      return (
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("lastActiveOrg="))
          ?.split("=")[1] || null
      );
    } catch (err) {
      return null;
    }
  }

  function parseUsageWindow(w) {
    if (!w || typeof w !== "object") return null;
    if (typeof w.utilization !== "number" || !Number.isFinite(w.utilization)) return null;
    return {
      utilization: Math.max(0, Math.min(100, w.utilization)),
      resetsAt: typeof w.resets_at === "string" ? w.resets_at : null,
    };
  }

  function parseUsageResponse(raw) {
    if (!raw || typeof raw !== "object") return null;
    const fiveHour = parseUsageWindow(raw.five_hour);
    const sevenDay = parseUsageWindow(raw.seven_day);
    if (!fiveHour && !sevenDay) return null;
    return { fiveHour, sevenDay };
  }

  async function refreshUsageLimits() {
    try {
      const orgId = getOrgIdFromCookie();
      if (!orgId) return;

      const res = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) return;

      const parsed = parseUsageResponse(await res.json());
      if (!parsed) return;

      await CKStorage.saveUsageLimits(PLATFORM, parsed);
    } catch (err) {
      // Endpoint shape/availability isn't guaranteed -- don't break capture over it.
      console.debug("[Threadly] usage limit fetch skipped:", err);
    }
  }

  function init() {
    console.debug("[Threadly] content script loaded on", location.href);
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    watchForNavigation();
    scheduleSync(); // in case messages are already on the page at load
    refreshUsageLimits();
    setInterval(refreshUsageLimits, 60000);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }
})();
