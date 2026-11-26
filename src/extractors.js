// Platform-specific DOM extractors for ChatGPT, Claude, Gemini & NotebookLM.
// Designed with multiple fallback selectors so minor UI updates don't break exports.

(function (globalScope) {
  function getHtmlToMd() {
    if (globalScope.ChatVaultHtmlToMd) return globalScope.ChatVaultHtmlToMd
    if (typeof require === "function") return require("./html-to-md.js")
    throw new Error("ChatVaultHtmlToMd is not loaded")
  }

  function detectPlatform(hostname) {
    const host = (hostname || "").toLowerCase()
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
      return "ChatGPT"
    }
    if (host.includes("claude.ai")) return "Claude"
    if (host.includes("gemini.google.com")) return "Gemini"
    if (host.includes("notebooklm.google.com")) return "NotebookLM"
    return "Web"
  }

  function makeTurn(index, role, element, htmlToMd) {
    const markdown = htmlToMd.htmlElementToMarkdown(element)
    if (!markdown) return null
    const preview = markdown.replace(/\s+/g, " ").slice(0, 90)
    return {
      index,
      role,
      markdown,
      preview,
    }
  }

  function extractChatGPT(doc, htmlToMd) {
    const nodes = Array.from(doc.querySelectorAll("[data-message-author-role]"))
    const messages = []
    nodes.forEach((node) => {
      const roleAttr = (node.getAttribute("data-message-author-role") || "").toLowerCase()
      const role = roleAttr === "user" ? "user" : "assistant"
      const contentEl = node.querySelector(".markdown, .whitespace-pre-wrap") || node
      const turn = makeTurn(messages.length, role, contentEl, htmlToMd)
      if (turn) messages.push(turn)
    })
    return messages
  }

  function extractClaude(doc, htmlToMd) {
    const selectors = [
      "[data-testid='user-message'], [data-testid='assistant-message']",
      ".font-user-message, .font-claude-message, .font-claude-response",
    ]
    let nodes = []
    for (const sel of selectors) {
      nodes = Array.from(doc.querySelectorAll(sel))
      if (nodes.length > 0) break
    }
    const messages = []
    nodes.forEach((node) => {
      const testId = (node.getAttribute("data-testid") || "").toLowerCase()
      const cls = typeof node.className === "string" ? node.className.toLowerCase() : ""
      const isUser = testId.includes("user") || cls.includes("user-message")
      const turn = makeTurn(messages.length, isUser ? "user" : "assistant", node, htmlToMd)
      if (turn) messages.push(turn)
    })
    return messages
  }

  function extractGemini(doc, htmlToMd) {
    const nodes = Array.from(
      doc.querySelectorAll(
        "user-query, model-response, [data-test-id='user-query'], [data-test-id='model-response']",
      ),
    )
    const messages = []
    nodes.forEach((node) => {
      const tag = (node.tagName || "").toLowerCase()
      const testId = (node.getAttribute("data-test-id") || "").toLowerCase()
      const isUser = tag === "user-query" || testId.includes("user")
      const contentEl =
        node.querySelector(".query-text, .markdown, message-content") || node
      const turn = makeTurn(messages.length, isUser ? "user" : "assistant", contentEl, htmlToMd)
      if (turn) messages.push(turn)
    })
    return messages
  }

  function extractNotebookLM(doc, htmlToMd) {
    const nodes = Array.from(
      doc.querySelectorAll(
        ".chat-message-pair, chat-message, [data-message-role], .from-user-container, .to-user-container",
      ),
    )
    const messages = []
    nodes.forEach((node) => {
      const cls = typeof node.className === "string" ? node.className.toLowerCase() : ""
      const roleAttr = (node.getAttribute("data-message-role") || "").toLowerCase()

      if (cls.includes("chat-message-pair")) {
        const q = node.querySelector(".from-user-container, .user-message")
        const a = node.querySelector(".to-user-container, .assistant-message, .message-text-content")
        if (q) {
          const t = makeTurn(messages.length, "user", q, htmlToMd)
          if (t) messages.push(t)
        }
        if (a) {
          const t = makeTurn(messages.length, "assistant", a, htmlToMd)
          if (t) messages.push(t)
        }
        return
      }

      const isUser =
        roleAttr === "user" ||
        cls.includes("from-user") ||
        cls.includes("user-message")
      const turn = makeTurn(messages.length, isUser ? "user" : "assistant", node, htmlToMd)
      if (turn) messages.push(turn)
    })
    return messages
  }

  function extractConversation(doc, loc) {
    const htmlToMd = getHtmlToMd()
    const hostname = loc?.hostname || ""
    const platform = detectPlatform(hostname)

    let messages = []
    if (platform === "ChatGPT") messages = extractChatGPT(doc, htmlToMd)
    else if (platform === "Claude") messages = extractClaude(doc, htmlToMd)
    else if (platform === "Gemini") messages = extractGemini(doc, htmlToMd)
    else if (platform === "NotebookLM") messages = extractNotebookLM(doc, htmlToMd)

    // Generic article fallback if platform selectors returned 0 messages
    if (messages.length === 0) {
      const articles = Array.from(doc.querySelectorAll("main article, [role='article']"))
      articles.forEach((el, idx) => {
        const turn = makeTurn(messages.length, idx % 2 === 0 ? "user" : "assistant", el, htmlToMd)
        if (turn) messages.push(turn)
      })
    }

    const rawTitle = (doc.title || "")
      .replace(/\s*[-|•]\s*(ChatGPT|Claude|Gemini|NotebookLM)\s*$/i, "")
      .trim()

    return {
      title: rawTitle || `${platform} Conversation`,
      platform,
      url: loc?.href || "",
      exportedAt: new Date().toISOString(),
      messages,
    }
  }

  const api = {
    detectPlatform,
    extractConversation,
  }

  globalScope.ChatVaultExtractors = api
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api
  }
})(typeof globalThis !== "undefined" ? globalThis : window)
