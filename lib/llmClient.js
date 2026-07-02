
(function (global) {
  const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

  async function chatCompletion({ apiKey, model, baseUrl, messages, maxOutputTokens }) {
    if (!apiKey) throw new Error("Missing API key. Set it in Threadly options.");
    if (!model) throw new Error("Missing model. Set it in Threadly options.");

    const url = `${baseUrl || DEFAULT_BASE_URL}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxOutputTokens,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM response had no content.");
    return content;
  }

  global.CKLlmClient = {
    DEFAULT_BASE_URL,
    chatCompletion,
  };
})(typeof window !== "undefined" ? window : self);
