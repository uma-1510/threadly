importScripts(
  "lib/storage.js",
  "lib/tokenEstimate.js",
  "lib/handoffPrompt.js",
  "lib/llmClient.js",
  "lib/pasteTargets.js"
);

async function generateHandoff({ platform, conversationId, tokenBudget }) {
  const conversation = await CKStorage.getConversation(platform, conversationId);
  if (!conversation) {
    return { ok: false, error: "No captured conversation found for this tab." };
  }

  const settings = await CKStorage.getSettings();
  if (!settings.apiKey || !settings.model) {
    return { ok: false, error: "Set your Gemini API key and model in Threadly options first." };
  }

  const budget = tokenBudget || 800;
  const promptMessages = CKHandoffPrompt.buildHandoffMessages(conversation, budget);

  // maxOutputTokens is a hard API cutoff, not the target length -- give the
  // model headroom above the requested budget so it can finish every section
  // instead of getting cut off mid-sentence. The budget itself is enforced
  // below by trimming the finished response, not by starving the generation.
  const outputCeiling = Math.max(budget * 2, 1024);

  const { content, finishReason } = await CKLlmClient.chatCompletion({
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
    messages: promptMessages,
    maxOutputTokens: outputCeiling,
  });

  const handoff = CKTokenEstimate.trimTextToBudget(content, budget);

  return {
    ok: true,
    handoff,
    estimatedTokens: CKTokenEstimate.estimateTokens(handoff),
    truncated: finishReason === "length",
  };
}

function pasteIntoInput(text, inputSelector) {
  const el = document.querySelector(inputSelector);
  if (!el) return { ok: false, error: "Could not find the input box on this page." };

  el.focus();

  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
  }

  return { ok: true };
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function openAndPaste({ platform, conversationId, tokenBudget, targetPlatform }) {
  const target = CKPasteTargets.PASTE_TARGETS.find((t) => t.platform === targetPlatform);
  if (!target) return { ok: false, error: "Unknown destination platform." };

  const handoffResult = await generateHandoff({ platform, conversationId, tokenBudget });
  if (!handoffResult.ok) return handoffResult;

  const tab = await chrome.tabs.create({ url: target.newChatUrl });
  await waitForTabLoad(tab.id);
  // Give the destination site's own JS a moment to mount its input box
  // after the tab reports "complete".
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: pasteIntoInput,
    args: [handoffResult.handoff, target.inputSelector],
  });

  return result || { ok: false, error: "Paste script did not run." };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GENERATE_HANDOFF") {
    generateHandoff(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  }

  if (message?.type === "OPEN_AND_PASTE") {
    openAndPaste(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  }

  return false;
});
