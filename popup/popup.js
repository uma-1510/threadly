(function () {
  const PLATFORM = "chatgpt";

  const statusEl = document.getElementById("status");
  const summaryEl = document.getElementById("summary");
  const titleEl = document.getElementById("title");
  const countEl = document.getElementById("count");
  const tokenBudgetEl = document.getElementById("tokenBudget");
  const generateBtn = document.getElementById("generate");
  const generateStatusEl = document.getElementById("generateStatus");
  const resultBlockEl = document.getElementById("resultBlock");
  const resultEl = document.getElementById("result");
  const copyBtn = document.getElementById("copy");
  const openOptionsBtn = document.getElementById("openOptions");
  const openLibraryBtn = document.getElementById("openLibrary");

  let currentConversation = null;

  function extractConversationId(url) {
    const match = url.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  }

  function isChatGptUrl(url) {
    return url.hostname === "chatgpt.com" || url.hostname === "chat.openai.com";
  }

  function showStatus(text) {
    statusEl.textContent = text;
    statusEl.classList.remove("hidden");
    summaryEl.classList.add("hidden");
  }

  function showConversation(conversation) {
    currentConversation = conversation;
    statusEl.classList.add("hidden");
    summaryEl.classList.remove("hidden");
    titleEl.textContent = conversation.title;
    countEl.textContent = `${conversation.messages.length} messages captured`;
    resultBlockEl.classList.add("hidden");
    generateStatusEl.textContent = "";
  }

  async function generateHandoff() {
    if (!currentConversation) return;
    generateBtn.disabled = true;
    generateStatusEl.textContent = "Generating…";
    resultBlockEl.classList.add("hidden");

    const tokenBudget = parseInt(tokenBudgetEl.value, 10) || 800;

    const response = await chrome.runtime.sendMessage({
      type: "GENERATE_HANDOFF",
      platform: currentConversation.platform,
      conversationId: currentConversation.conversationId,
      tokenBudget,
    });

    generateBtn.disabled = false;

    if (!response || !response.ok) {
      generateStatusEl.textContent = response?.error || "Something went wrong.";
      return;
    }

    generateStatusEl.textContent = response.truncated
      ? `Done (~${response.estimatedTokens} tokens). Response was cut off — try raising the token budget.`
      : `Done (~${response.estimatedTokens} tokens).`;
    resultEl.value = response.handoff;
    resultBlockEl.classList.remove("hidden");
  }

  async function copyResult() {
    await navigator.clipboard.writeText(resultEl.value);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy to clipboard"), 1500);
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

  generateBtn.addEventListener("click", generateHandoff);
  copyBtn.addEventListener("click", copyResult);
  openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
  openLibraryBtn.addEventListener("click", () =>
    chrome.tabs.create({ url: chrome.runtime.getURL("library/library.html") })
  );

  init();
})();
