importScripts(
  "lib/storage.js",
  "lib/tokenEstimate.js",
  "lib/handoffPrompt.js",
  "lib/llmClient.js"
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "GENERATE_HANDOFF") return false;

  (async () => {
    try {
      const { platform, conversationId, tokenBudget } = message;
      const conversation = await CKStorage.getConversation(platform, conversationId);
      if (!conversation) {
        sendResponse({ ok: false, error: "No captured conversation found for this tab." });
        return;
      }

      const settings = await CKStorage.getSettings();
      if (!settings.apiKey || !settings.model) {
        sendResponse({
          ok: false,
          error: "Set your Gemini API key and model in Threadly options first.",
        });
        return;
      }

      const budget = tokenBudget || 800;
      const promptMessages = CKHandoffPrompt.buildHandoffMessages(conversation, budget);

      let handoff = await CKLlmClient.chatCompletion({
        apiKey: settings.apiKey,
        model: settings.model,
        baseUrl: settings.baseUrl,
        messages: promptMessages,
        maxOutputTokens: budget,
      });

      handoff = CKTokenEstimate.trimTextToBudget(handoff, budget);

      sendResponse({
        ok: true,
        handoff,
        estimatedTokens: CKTokenEstimate.estimateTokens(handoff),
      });
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();

  return true;
});
