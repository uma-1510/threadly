(function () {
  const searchEl = document.getElementById("search");
  const platformFilterEl = document.getElementById("platformFilter");
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");

  let allConversations = [];

  function relativeTime(timestamp) {
    const diffMin = Math.round((Date.now() - timestamp) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.round(diffHr / 24)}d ago`;
  }

  function matchesSearch(conversation, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    if (conversation.title.toLowerCase().includes(q)) return true;
    return conversation.messages.some((m) => m.content.toLowerCase().includes(q));
  }

  function populatePlatformFilter(conversations) {
    const platforms = [...new Set(conversations.map((c) => c.platform))].sort();
    platformFilterEl.innerHTML =
      '<option value="">All platforms</option>' +
      platforms.map((p) => `<option value="${p}">${p}</option>`).join("");
  }

  function buildRow(conversation) {
    const row = document.createElement("div");
    row.className = "conv-row";
    row.innerHTML = `
      <div class="conv-header">
        <span class="conv-platform">${conversation.platform}</span>
        <span class="conv-title"></span>
        <span class="conv-time">${relativeTime(conversation.updatedAt)}</span>
      </div>
      <div class="conv-meta">${conversation.messages.length} messages</div>
      <div class="conv-actions">
        <button class="open-btn">Open</button>
        <button class="handoff-btn">Generate Handoff</button>
      </div>
      <div class="handoff-block hidden">
        <label class="budget-label">
          Token budget
          <input type="number" class="budget-input" value="800" min="100" step="100" />
        </label>
        <button class="run-btn">Generate</button>
        <div class="handoff-status"></div>
        <textarea class="handoff-result hidden" readonly rows="8"></textarea>
        <button class="copy-btn hidden">Copy to clipboard</button>
      </div>
    `;
    row.querySelector(".conv-title").textContent = conversation.title;

    row.querySelector(".open-btn").addEventListener("click", () => {
      chrome.tabs.create({ url: conversation.url });
    });

    const handoffBlock = row.querySelector(".handoff-block");
    row.querySelector(".handoff-btn").addEventListener("click", () => {
      handoffBlock.classList.toggle("hidden");
    });

    const statusEl = row.querySelector(".handoff-status");
    const resultEl = row.querySelector(".handoff-result");
    const copyBtn = row.querySelector(".copy-btn");
    const runBtn = row.querySelector(".run-btn");
    const budgetInput = row.querySelector(".budget-input");

    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      statusEl.textContent = "Generating…";
      resultEl.classList.add("hidden");
      copyBtn.classList.add("hidden");

      const tokenBudget = parseInt(budgetInput.value, 10) || 800;
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_HANDOFF",
        platform: conversation.platform,
        conversationId: conversation.conversationId,
        tokenBudget,
      });

      runBtn.disabled = false;

      if (!response || !response.ok) {
        statusEl.textContent = response?.error || "Something went wrong.";
        return;
      }

      statusEl.textContent = response.truncated
        ? `Done (~${response.estimatedTokens} tokens). Response was cut off — try raising the token budget.`
        : `Done (~${response.estimatedTokens} tokens).`;
      resultEl.value = response.handoff;
      resultEl.classList.remove("hidden");
      copyBtn.classList.remove("hidden");
    });

    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(resultEl.value);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy to clipboard"), 1500);
    });

    return row;
  }

  function render() {
    const query = searchEl.value.trim();
    const platform = platformFilterEl.value;

    const filtered = allConversations
      .filter((c) => !platform || c.platform === platform)
      .filter((c) => matchesSearch(c, query))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    listEl.innerHTML = "";
    emptyEl.classList.toggle("hidden", filtered.length > 0);
    filtered.forEach((conversation) => listEl.appendChild(buildRow(conversation)));
  }

  async function init() {
    allConversations = await CKStorage.listConversations();
    populatePlatformFilter(allConversations);
    render();
  }

  searchEl.addEventListener("input", render);
  platformFilterEl.addEventListener("change", render);

  init();
})();
