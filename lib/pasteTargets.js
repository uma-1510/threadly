
(function (global) {
  const PASTE_TARGETS = [
    {
      platform: "chatgpt",
      label: "ChatGPT",
      newChatUrl: "https://chatgpt.com/",
      inputSelector: "#prompt-textarea",
    },
    {
      platform: "claude",
      label: "Claude",
      newChatUrl: "https://claude.ai/new",
      inputSelector: 'div[contenteditable="true"]',
    },
  ];

  global.CKPasteTargets = { PASTE_TARGETS };
})(typeof window !== "undefined" ? window : self);
