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
  const platformLabelEl = document.getElementById("platformLabel");
  const refreshBtn = document.getElementById("refresh");
  const updatedAtEl = document.getElementById("updatedAt");
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
  const usageSectionEl = document.getElementById("usageSection");
  const sessionPctEl = document.getElementById("sessionPct");
  const sessionBarEl = document.getElementById("sessionBar");
  const sessionResetEl = document.getElementById("sessionReset");
  const weeklyPctEl = document.getElementById("weeklyPct");
  const weeklyBarEl = document.getElementById("weeklyBar");
  const weeklyResetEl = document.getElementById("weeklyReset");

  let currentConversation = null;

  function relativeTime(timestamp) {
    if (!timestamp) return "";
    const diffMin = Math.round((Date.now() - timestamp) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.round(diffHr / 24)}d ago`;
  }

  function formatRelativeReset(isoString) {
    if (!isoString) return "";
    const diffMs = new Date(isoString).getTime() - Date.now();
    if (diffMs <= 0) return "Resets soon";
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.round((diffMs % 3600000) / 60000);
    return `Resets in ${hours}h ${minutes}m`;
  }

  function formatAbsoluteReset(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
    const time = date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `Resets ${weekday} ${time}`;
  }

  function setUsageBar(pctEl, barEl, resetEl, window, formatReset) {
    const pct = Math.round(window.utilization);
    pctEl.textContent = `${pct}%`;
    barEl.style.width = `${pct}%`;
    barEl.classList.toggle("high", pct >= 90);
    resetEl.textContent = formatReset(window.resetsAt);
  }

  async function renderUsageLimits(platform) {
    const usage = await CKStorage.getUsageLimits(platform);
    if (!usage || (!usage.fiveHour && !usage.sevenDay)) {
      usageSectionEl.classList.add("hidden");
      return;
    }

    usageSectionEl.classList.remove("hidden");

    if (usage.fiveHour) {
      setUsageBar(sessionPctEl, sessionBarEl, sessionResetEl, usage.fiveHour, formatRelativeReset);
    }
    if (usage.sevenDay) {
      setUsageBar(weeklyPctEl, weeklyBarEl, weeklyResetEl, usage.sevenDay, formatAbsoluteReset);
    }
  }

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
    platformLabelEl.textContent =
      "/ " + conversation.platform.charAt(0).toUpperCase() + conversation.platform.slice(1);
    updatedAtEl.textContent = "Updated " + relativeTime(conversation.updatedAt);

    resultBlockEl.classList.add("hidden");
    generateStatusEl.textContent = "";
    renderContinueButtons(conversation);
    renderUsageLimits(conversation.platform);
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
  refreshBtn.addEventListener("click", init);

  init();
})();
