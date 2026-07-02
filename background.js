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

      sendResponse({
        ok: true,
        handoff,
        estimatedTokens: CKTokenEstimate.estimateTokens(handoff),
        truncated: finishReason === "length",
      });
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();

  return true;
});
