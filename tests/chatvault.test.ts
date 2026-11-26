import { describe, expect, test } from "bun:test"

const formatters = require("../src/formatters.js")
const license = require("../src/license.js")
const extractors = require("../src/extractors.js")
const htmlToMd = require("../src/html-to-md.js")

describe("ChatVault formatters", () => {
  const sampleConversation = {
    title: "Build a Chrome Extension: Guide?",
    platform: "ChatGPT",
    url: "https://chatgpt.com/c/123",
    exportedAt: "2026-11-26T01:00:00.000Z",
    messages: [
      { index: 0, role: "user", markdown: "How do I export chats?", preview: "How do I export chats?" },
      {
        index: 1,
        role: "assistant",
        markdown: "Use **ChatVault**:\n\n```ts\nconsole.log('hi')\n```",
        preview: "Use ChatVault",
      },
    ],
  }

  test("sanitizes filenames safely", () => {
    expect(formatters.sanitizeFilename("Build a Chrome Extension: Guide?")).toBe(
      "Build-a-Chrome-Extension-Guide",
    )
    expect(formatters.sanitizeFilename("   ")).toBe("ai-chat-export")
  })

  test("formats clean Markdown with metadata and roles", () => {
    const md = formatters.formatMarkdown(sampleConversation)
    expect(md).toContain("# Build a Chrome Extension: Guide?")
    expect(md).toContain("- **Platform**: ChatGPT")
    expect(md).toContain("## User")
    expect(md).toContain("## ChatGPT")
    expect(md).toContain("```ts\nconsole.log('hi')\n```")
  })

  test("formats Obsidian Markdown with YAML frontmatter and question callout", () => {
    const md = formatters.formatObsidianMarkdown(sampleConversation)
    expect(md.startsWith("---\n")).toBe(true)
    expect(md).toContain('platform: "ChatGPT"')
    expect(md).toContain("created: 2026-11-26")
    expect(md).toContain("> [!question] User")
  })

  test("formats clean print-ready PDF HTML without watermark", () => {
    const html = formatters.formatPrintHtml(sampleConversation, { theme: "academic" })
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("Georgia")
    expect(html).toContain("Save as PDF / Print")
    expect(html).not.toContain("watermark")
  })

  test("formats valid JSON archive", () => {
    const parsed = JSON.parse(formatters.formatJson(sampleConversation))
    expect(parsed.platform).toBe("ChatGPT")
    expect(parsed.messages).toHaveLength(2)
  })
})

describe("ChatVault platform detection & markdown cleanup", () => {
  test("detects all 4 supported AI platforms", () => {
    expect(extractors.detectPlatform("chatgpt.com")).toBe("ChatGPT")
    expect(extractors.detectPlatform("claude.ai")).toBe("Claude")
    expect(extractors.detectPlatform("gemini.google.com")).toBe("Gemini")
    expect(extractors.detectPlatform("notebooklm.google.com")).toBe("NotebookLM")
    expect(extractors.detectPlatform("example.com")).toBe("Web")
  })

  test("normalizes excessive blank lines", () => {
    expect(htmlToMd.cleanMarkdown("hello   \n\n\n\nworld\r\n")).toBe("hello\n\nworld")
  })
})

describe("ChatVault Gumroad license verification", () => {
  test("rejects empty license key without network call", async () => {
    const res = await license.verifyGumroadLicense("   ")
    expect(res.valid).toBe(false)
  })

  test("accepts valid Gumroad license response", async () => {
    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({
        success: true,
        purchase: { email: "buyer@example.com", refunded: false, chargebacked: false },
      }),
    })
    const res = await license.verifyGumroadLicense("XXXX-YYYY-ZZZZ", fakeFetch)
    expect(res.valid).toBe(true)
    expect(res.email).toBe("buyer@example.com")
  })

  test("rejects refunded Gumroad license", async () => {
    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({
        success: true,
        purchase: { email: "buyer@example.com", refunded: true, chargebacked: false },
      }),
    })
    const res = await license.verifyGumroadLicense("XXXX-REFUND", fakeFetch)
    expect(res.valid).toBe(false)
  })
})
