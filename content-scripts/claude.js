
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

  function init() {
    console.debug("[Threadly] content script loaded on", location.href);
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    watchForNavigation();
    scheduleSync(); // in case messages are already on the page at load
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }
})();
