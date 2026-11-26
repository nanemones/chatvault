// Formatters for ChatVault exports:
// - Free: Clean Markdown (.md)
// - Pro: Obsidian Markdown (YAML frontmatter + callouts), Print-ready PDF HTML, JSON Archive

(function (globalScope) {
  function sanitizeFilename(title, fallback = "ai-chat-export") {
    const cleaned = (title || "")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 72)
      .replace(/^-+|-+$/g, "")
    return cleaned || fallback
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function formatMarkdown(conversation, options = {}) {
    const { includeMetadata = true } = options
    const lines = []
    lines.push(`# ${conversation.title || "AI Conversation"}`)
    if (includeMetadata) {
      lines.push("")
      lines.push(`- **Platform**: ${conversation.platform}`)
      if (conversation.url) lines.push(`- **Source**: ${conversation.url}`)
      lines.push(`- **Exported**: ${conversation.exportedAt}`)
      lines.push(`- **Messages**: ${conversation.messages.length}`)
    }
    lines.push("")
    lines.push("---")

    for (const msg of conversation.messages) {
      const label = msg.role === "user" ? "User" : conversation.platform || "Assistant"
      lines.push("")
      lines.push(`## ${label}`)
      lines.push("")
      lines.push((msg.markdown || "").trim())
    }

    return `${lines.join("\n").trim()}\n`
  }

  function formatObsidianMarkdown(conversation, options = {}) {
    const tags = options.tags || ["ai-chat", (conversation.platform || "ai").toLowerCase()]
    const safeTitle = (conversation.title || "AI Conversation").replace(/"/g, '\\"')
    const frontmatter = [
      "---",
      `title: "${safeTitle}"`,
      `source: "${conversation.url || ""}"`,
      `platform: "${conversation.platform || "AI"}"`,
      `created: ${conversation.exportedAt.slice(0, 10)}`,
      `exported_at: "${conversation.exportedAt}"`,
      `message_count: ${conversation.messages.length}`,
      `tags: [${tags.map((t) => `"${t}"`).join(", ")}]`,
      "---",
      "",
    ].join("\n")

    const body = conversation.messages
      .map((msg) => {
        if (msg.role === "user") {
          const quoted = (msg.markdown || "")
            .trim()
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n")
          return `> [!question] User\n${quoted}`
        }
        return `### ${conversation.platform || "Assistant"}\n\n${(msg.markdown || "").trim()}`
      })
      .join("\n\n---\n\n")

    return `${frontmatter}# ${conversation.title || "AI Conversation"}\n\n${body}\n`
  }

  function markdownToSimpleHtml(md) {
    let html = escapeHtml(md || "")

    // Fenced code blocks
    html = html.replace(
      /```([a-zA-Z0-9_+#-]*)\n([\s\S]*?)```/g,
      (_, lang, code) =>
        `<pre class="code-block" data-lang="${lang}"><code>${code}</code></pre>`,
    )

    // Inline code
    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>")

    // Headings
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>")
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>")
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>")

    // Bold & italic
    html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>")

    // Links
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    )

    // Paragraphs
    return html
      .split(/\n{2,}/)
      .map((block) => {
        const trimmed = block.trim()
        if (!trimmed) return ""
        if (/^<(h[1-6]|pre|ul|ol|table|blockquote)/.test(trimmed)) return trimmed
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`
      })
      .join("\n")
  }

  function formatPrintHtml(conversation, options = {}) {
    const theme = options.theme || "clean" // "clean" | "academic" | "dark"
    const isDark = theme === "dark"
    const fontFamily =
      theme === "academic"
        ? "'Georgia', 'Noto Serif TC', serif"
        : "-apple-system, BlinkMacSystemFont, 'Inter', 'Noto Sans TC', sans-serif"

    const messagesHtml = conversation.messages
      .map((msg) => {
        const isUser = msg.role === "user"
        const roleLabel = isUser ? "You" : conversation.platform || "Assistant"
        const contentHtml = markdownToSimpleHtml(msg.markdown)
        return `
          <article class="msg ${isUser ? "msg-user" : "msg-assistant"}">
            <div class="msg-role">${escapeHtml(roleLabel)}</div>
            <div class="msg-body">${contentHtml}</div>
          </article>
        `
      })
      .join("\n")

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(conversation.title || "AI Conversation")}</title>
  <style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0 auto;
      max-width: 820px;
      padding: 32px 24px;
      font-family: ${fontFamily};
      font-size: 14px;
      line-height: 1.65;
      color: ${isDark ? "#e5e7eb" : "#111827"};
      background: ${isDark ? "#0f172a" : "#ffffff"};
    }
    header.doc-header {
      border-bottom: 2px solid ${isDark ? "#334155" : "#e5e7eb"};
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    header.doc-header h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      line-height: 1.25;
    }
    .meta {
      font-size: 12px;
      color: ${isDark ? "#94a3b8" : "#6b7280"};
    }
    .msg {
      margin-bottom: 20px;
      padding: 14px 18px;
      border-radius: 10px;
      page-break-inside: avoid;
    }
    .msg-user {
      background: ${isDark ? "#1e293b" : "#f3f4f6"};
      border-left: 4px solid #6366f1;
    }
    .msg-assistant {
      background: ${isDark ? "#0b1120" : "#ffffff"};
      border: 1px solid ${isDark ? "#1e293b" : "#e5e7eb"};
    }
    .msg-role {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${isDark ? "#818cf8" : "#4f46e5"};
      margin-bottom: 6px;
    }
    pre.code-block {
      background: ${isDark ? "#020617" : "#111827"};
      color: #f8fafc;
      padding: 12px 14px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12.5px;
      line-height: 1.5;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
    }
    p code {
      background: ${isDark ? "#1e293b" : "#f3f4f6"};
      padding: 2px 5px;
      border-radius: 4px;
    }
    .print-bar {
      position: fixed;
      top: 14px;
      right: 16px;
      display: flex;
      gap: 8px;
    }
    .print-bar button {
      background: #4f46e5;
      color: #fff;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    @media print {
      .print-bar { display: none; }
      body { padding: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button onclick="window.print()">Save as PDF / Print</button>
  </div>
  <header class="doc-header">
    <h1>${escapeHtml(conversation.title || "AI Conversation")}</h1>
    <div class="meta">
      ${escapeHtml(conversation.platform)} • ${escapeHtml(conversation.exportedAt.slice(0, 10))} • ${conversation.messages.length} messages
    </div>
  </header>
  <main>
    ${messagesHtml}
  </main>
</body>
</html>`
  }

  function formatJson(conversation) {
    return `${JSON.stringify(conversation, null, 2)}\n`
  }

  const api = {
    sanitizeFilename,
    formatMarkdown,
    formatObsidianMarkdown,
    formatPrintHtml,
    formatJson,
  }

  globalScope.ChatVaultFormatters = api
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api
  }
})(typeof globalThis !== "undefined" ? globalThis : window)
