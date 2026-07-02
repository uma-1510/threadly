
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

  global.CKStorage = {
    conversationKey,
    getConversation,
    saveConversation,
  };
})(typeof window !== "undefined" ? window : self);