// 100% local HTML-to-Markdown converter designed for AI chat outputs.
// Strips UI chrome (copy buttons, toolbar icons) while preserving code blocks,
// tables, lists, blockquotes, links, headings, and inline/block LaTeX math.

(function (globalScope) {
  const UI_CHROME_SELECTORS = [
    "button",
    "svg",
    "nav",
    "header",
    "footer",
    "[role='toolbar']",
    "[role='menu']",
    "[aria-label*='Copy']",
    "[aria-label*='Edit']",
    "[aria-label*='Regenerate']",
    ".sr-only",
    ".visually-hidden",
  ]

  function detectCodeLanguage(preEl, codeEl) {
    const classStr = `${preEl?.className || ""} ${codeEl?.className || ""}`
    const match = classStr.match(/(?:language-|lang-)([a-zA-Z0-9_+#-]+)/)
    if (match) return match[1].toLowerCase()

    // ChatGPT / Claude often place the language label in a preceding sibling span/div
    const header = preEl?.previousElementSibling || preEl?.querySelector("div, span")
    if (header && header !== codeEl) {
      const label = (header.textContent || "").trim().toLowerCase()
      if (/^[a-z0-9_+#-]{1,20}$/.test(label) && label !== "copy" && label !== "code") {
        return label
      }
    }
    return ""
  }

  function convertTable(tableEl) {
    const rows = Array.from(tableEl.querySelectorAll("tr"))
    if (rows.length === 0) return ""

    const matrix = rows.map((row) =>
      Array.from(row.querySelectorAll("th, td")).map((cell) =>
        nodeToMarkdown(cell).replace(/\n+/g, " ").replace(/\|/g, "\\|").trim(),
      ),
    )
    const colCount = Math.max(...matrix.map((r) => r.length), 0)
    if (colCount === 0) return ""

    const padRow = (row) => {
      const copy = row.slice()
      while (copy.length < colCount) copy.push("")
      return `| ${copy.join(" | ")} |`
    }

    const header = padRow(matrix[0])
    const separator = `| ${Array(colCount).fill("---").join(" | ")} |`
    const body = matrix.slice(1).map(padRow)
    return `\n\n${[header, separator, ...body].join("\n")}\n\n`
  }

  function extractKatexTex(el) {
    const annotation = el.querySelector?.("annotation[encoding='application/x-tex']")
    if (annotation?.textContent) {
      return annotation.textContent.trim()
    }
    return null
  }

  function nodeToMarkdown(node, depth = 0) {
    if (!node) return ""

    // Text node (nodeType === 3)
    if (node.nodeType === 3) {
      return (node.nodeValue || "").replace(/\u00a0/g, " ")
    }

    // Ignore non-element nodes
    if (node.nodeType !== 1) return ""

    const tag = (node.tagName || "").toLowerCase()

    // Skip invisible or UI-only elements
    if (
      tag === "button" ||
      tag === "svg" ||
      tag === "script" ||
      tag === "style" ||
      tag === "noscript" ||
      tag === "template"
    ) {
      return ""
    }

    // Handle KaTeX / MathJax annotations cleanly
    const cls = typeof node.className === "string" ? node.className : ""
    if (cls.includes("katex-display")) {
      const tex = extractKatexTex(node)
      if (tex) return `\n\n$$\n${tex}\n$$\n\n`
    }
    if (cls.includes("katex")) {
      const tex = extractKatexTex(node)
      if (tex) return `$${tex}$`
    }

    if (tag === "pre") {
      const codeEl = node.querySelector?.("code")
      const lang = detectCodeLanguage(node, codeEl)
      const rawCode = (codeEl ? codeEl.textContent : node.textContent) || ""
      const cleaned = rawCode.replace(/\n$/, "")
      const fence = cleaned.includes("```") ? "````" : "```"
      return `\n\n${fence}${lang}\n${cleaned}\n${fence}\n\n`
    }

    if (tag === "code") {
      const text = node.textContent || ""
      if (!text) return ""
      const tick = text.includes("`") ? "``" : "`"
      return `${tick}${text}${tick}`
    }

    if (tag === "table") {
      return convertTable(node)
    }

    if (tag === "br") return "  \n"
    if (tag === "hr") return "\n\n---\n\n"

    const childrenMd = Array.from(node.childNodes || [])
      .map((child) => nodeToMarkdown(child, depth))
      .join("")

    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = Number(tag[1])
        const content = childrenMd.trim()
        return content ? `\n\n${"#".repeat(level)} ${content}\n\n` : ""
      }
      case "p": {
        const content = childrenMd.trim()
        return content ? `\n\n${content}\n\n` : ""
      }
      case "strong":
      case "b": {
        const content = childrenMd.trim()
        return content ? `**${content}**` : ""
      }
      case "em":
      case "i": {
        const content = childrenMd.trim()
        return content ? `*${content}*` : ""
      }
      case "del":
      case "s": {
        const content = childrenMd.trim()
        return content ? `~~${content}~~` : ""
      }
      case "a": {
        const href = node.getAttribute?.("href") || ""
        const text = childrenMd.trim() || href
        if (!href || href.startsWith("javascript:")) return text
        return `[${text}](${href})`
      }
      case "img": {
        const src = node.getAttribute?.("src") || ""
        const alt = (node.getAttribute?.("alt") || "image").trim()
        return src ? `![${alt}](${src})` : ""
      }
      case "blockquote": {
        const lines = childrenMd
          .trim()
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")
        return lines ? `\n\n${lines}\n\n` : ""
      }
      case "ul": {
        const items = Array.from(node.children || [])
          .filter((el) => (el.tagName || "").toLowerCase() === "li")
          .map((li) => {
            const inner = Array.from(li.childNodes || [])
              .map((child) => nodeToMarkdown(child, depth + 1))
              .join("")
              .trim()
              .replace(/\n/g, `\n${"  ".repeat(depth + 1)}`)
            return `${"  ".repeat(depth)}- ${inner}`
          })
          .join("\n")
        return items ? `\n\n${items}\n\n` : ""
      }
      case "ol": {
        const items = Array.from(node.children || [])
          .filter((el) => (el.tagName || "").toLowerCase() === "li")
          .map((li, index) => {
            const inner = Array.from(li.childNodes || [])
              .map((child) => nodeToMarkdown(child, depth + 1))
              .join("")
              .trim()
              .replace(/\n/g, `\n${"  ".repeat(depth + 1)}`)
            return `${"  ".repeat(depth)}${index + 1}. ${inner}`
          })
          .join("\n")
        return items ? `\n\n${items}\n\n` : ""
      }
      default:
        return childrenMd
    }
  }

  function cleanMarkdown(md) {
    return md
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  function htmlElementToMarkdown(rootEl) {
    if (!rootEl) return ""
    const clone = rootEl.cloneNode(true)
    if (clone.querySelectorAll) {
      for (const selector of UI_CHROME_SELECTORS) {
        for (const el of clone.querySelectorAll(selector)) {
          // Keep code-block language headers if needed, only remove buttons/svgs/etc.
          el.remove()
        }
      }
    }
    return cleanMarkdown(nodeToMarkdown(clone, 0))
  }

  const api = {
    htmlElementToMarkdown,
    cleanMarkdown,
  }

  globalScope.ChatVaultHtmlToMd = api
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api
  }
})(typeof globalThis !== "undefined" ? globalThis : window)
