
(function (global) {
  function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  function trimTextToBudget(text, maxTokens) {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars).trim() + "\n\n[...trimmed to fit token budget]";
  }

  global.CKTokenEstimate = {
    estimateTokens,
    trimTextToBudget,
  };
})(typeof window !== "undefined" ? window : self);
