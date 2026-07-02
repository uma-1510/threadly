
(function () {
  const PLATFORM = "chatgpt";
  let draftId = null;
  let debounceTimer = null;
  let lastPath = location.pathname;

  function extractConversationId() {
    const match = location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
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
    return raw.replace(/\s*[-–—]\s*ChatGPT\s*$/i, "").trim() || "Untitled conversation";
  }

  function scanMessages() {
    const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
    const messages = [];
    turns.forEach((turn, idx) => {
      const roleEl = turn.querySelector("[data-message-author-role]");
      if (!roleEl) return;
      const role = roleEl.getAttribute("data-message-author-role");
      if (role !== "user" && role !== "assistant") return;
      const text = (roleEl.innerText || "").trim();
      if (!text) return;
      const msgId = roleEl.getAttribute("data-message-id") || `idx-${idx}`;
      messages.push({ id: msgId, role, content: text, index: idx });
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
      // A broken selector should stop capture, not break ChatGPT for the user.
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