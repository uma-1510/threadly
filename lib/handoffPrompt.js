
(function (global) {
  const SECTIONS = [
    "Project Goal",
    "Key Decisions",
    "Constraints",
    "Completed Work",
    "Pending Tasks",
    "Code/Artifacts",
    "User Preferences",
  ];

  function formatTranscript(messages) {
    return messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");
  }

  function buildHandoffMessages(conversation, targetTokens) {
    const system =
      "You are compressing a conversation into a handoff briefing for a fresh chat session " +
      "that has no memory of it. Write only the sections below, skip any section with nothing " +
      "to report, and stay under roughly " + targetTokens + " tokens total. Be concrete: quote " +
      "specifics (names, decisions, code, numbers) rather than vague summaries.\n\n" +
      SECTIONS.map((s) => `## ${s}`).join("\n");

    const user =
      `Conversation title: ${conversation.title}\n\n` +
      `Transcript:\n${formatTranscript(conversation.messages)}`;

    return [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
  }

  global.CKHandoffPrompt = {
    SECTIONS,
    formatTranscript,
    buildHandoffMessages,
  };
})(typeof window !== "undefined" ? window : self);
