(function () {
  const PLATFORM = "chatgpt";

  const statusEl = document.getElementById("status");
  const summaryEl = document.getElementById("summary");
  const titleEl = document.getElementById("title");
  const countEl = document.getElementById("count");
  const dumpEl = document.getElementById("dump");

  function extractConversationId(url) {
    const match = url.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  }

  function isChatGptUrl(url) {
    return (
      url.hostname === "chatgpt.com" || url.hostname === "chat.openai.com"
    );
  }

  function showStatus(text) {
    statusEl.textContent = text;
    statusEl.classList.remove("hidden");
    summaryEl.classList.add("hidden");
    dumpEl.classList.add("hidden");
  }

  function showConversation(conversation) {
    statusEl.classList.add("hidden");
    summaryEl.classList.remove("hidden");
    dumpEl.classList.remove("hidden");
    titleEl.textContent = conversation.title;
    countEl.textContent = `${conversation.messages.length} messages captured`;
    dumpEl.textContent = JSON.stringify(conversation.messages, null, 2);
  }

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      showStatus("No active tab.");
      return;
    }

    const url = new URL(tab.url);
    if (!isChatGptUrl(url)) {
      showStatus("Open a ChatGPT conversation tab to see captured data.");
      return;
    }

    const conversationId = extractConversationId(url);
    if (!conversationId) {
      showStatus(
        "This looks like a new conversation without a saved ID yet. Send a message, then reopen the popup."
      );
      return;
    }

    const conversation = await CKStorage.getConversation(PLATFORM, conversationId);
    if (!conversation) {
      showStatus("No messages captured yet for this conversation.");
      return;
    }

    showConversation(conversation);
  }

  init();
})();
