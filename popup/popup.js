(function () {
  const PLATFORMS = [
    {
      platform: "chatgpt",
      hostnames: ["chatgpt.com", "chat.openai.com"],
      idPattern: /\/c\/([a-zA-Z0-9-]+)/,
    },
    {
      platform: "claude",
      hostnames: ["claude.ai"],
      idPattern: /\/chat\/([a-zA-Z0-9-]+)/,
    },
  ];

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
  const continueButtonsEl = document.getElementById("continueButtons");
  const continueStatusEl = document.getElementById("continueStatus");

  let currentConversation = null;

  function matchPlatform(url) {
    return PLATFORMS.find((p) => p.hostnames.includes(url.hostname)) || null;
  }

  function extractConversationId(url, idPattern) {
    const match = url.pathname.match(idPattern);
    return match ? match[1] : null;
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
    countEl.textContent = "Messages successfully captured";
    resultBlockEl.classList.add("hidden");
    generateStatusEl.textContent = "";
    renderContinueButtons(conversation);
  }

  function renderContinueButtons(conversation) {
    continueButtonsEl.innerHTML = "";
    continueStatusEl.textContent = "";

    const targets = CKPasteTargets.PASTE_TARGETS.filter(
      (t) => t.platform !== conversation.platform
    );

    targets.forEach((target, idx) => {
      const btn = document.createElement("button");
      btn.className = "llm-btn" + (idx === 0 ? " primary" : "");
      btn.textContent = target.label;
      btn.addEventListener("click", () => continueInTarget(target));
      continueButtonsEl.appendChild(btn);
    });
  }

  async function continueInTarget(target) {
    const buttons = continueButtonsEl.querySelectorAll("button");
    buttons.forEach((b) => (b.disabled = true));
    continueStatusEl.textContent = `Generating and opening ${target.label}…`;

    const tokenBudget = parseInt(tokenBudgetEl.value, 10) || 800;

    const response = await chrome.runtime.sendMessage({
      type: "OPEN_AND_PASTE",
      platform: currentConversation.platform,
      conversationId: currentConversation.conversationId,
      tokenBudget,
      targetPlatform: target.platform,
    });

    buttons.forEach((b) => (b.disabled = false));

    continueStatusEl.textContent =
      response && response.ok
        ? `Pasted into ${target.label}. Review it there before sending.`
        : response?.error || "Something went wrong.";
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
    const platformConfig = matchPlatform(url);
    if (!platformConfig) {
      showStatus("Open a ChatGPT or Claude conversation tab to see captured data.");
      return;
    }

    const conversationId = extractConversationId(url, platformConfig.idPattern);
    if (!conversationId) {
      showStatus(
        "This looks like a new conversation without a saved ID yet. Send a message, then reopen the popup."
      );
      return;
    }

    const conversation = await CKStorage.getConversation(platformConfig.platform, conversationId);
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
