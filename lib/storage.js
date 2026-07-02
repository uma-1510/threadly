
(function (global) {
  function conversationKey(platform, conversationId) {
    return `conv:${platform}:${conversationId}`;
  }

  async function getConversation(platform, conversationId) {
    const key = conversationKey(platform, conversationId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  async function saveConversation(conversation) {
    const key = conversationKey(conversation.platform, conversation.conversationId);
    conversation.updatedAt = Date.now();
    await chrome.storage.local.set({ [key]: conversation });
    return conversation;
  }

  async function listConversations() {
    const all = await chrome.storage.local.get(null);
    return Object.keys(all)
      .filter((key) => key.startsWith("conv:"))
      .map((key) => all[key]);
  }

  const SETTINGS_KEY = "settings";
  const DEFAULT_SETTINGS = {};

  async function getSettings() {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  }

  async function saveSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
    return merged;
  }

  global.CKStorage = {
    conversationKey,
    getConversation,
    saveConversation,
    listConversations,
    getSettings,
    saveSettings,
  };
})(typeof window !== "undefined" ? window : self);