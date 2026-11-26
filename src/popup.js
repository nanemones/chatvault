// Popup controller for ChatVault

const state = {
  conversation: null,
  selectedIndices: new Set(),
  isPro: false,
}

const el = {
  planBadge: document.getElementById("plan-badge"),
  statusBanner: document.getElementById("status-banner"),
  platformPill: document.getElementById("platform-pill"),
  msgCount: document.getElementById("msg-count"),
  chatTitle: document.getElementById("chat-title"),
  selectorSection: document.getElementById("selector-section"),
  messageList: document.getElementById("message-list"),
  selectAllBtn: document.getElementById("select-all-btn"),
  selectNoneBtn: document.getElementById("select-none-btn"),
  btnCopyMd: document.getElementById("btn-copy-md"),
  btnDownloadMd: document.getElementById("btn-download-md"),
  btnExportPdf: document.getElementById("btn-export-pdf"),
  btnExportObsidian: document.getElementById("btn-export-obsidian"),
  btnExportJson: document.getElementById("btn-export-json"),
  pdfTheme: document.getElementById("pdf-theme"),
  upgradeCard: document.getElementById("upgrade-card"),
  buyProLink: document.getElementById("buy-pro-link"),
  licenseInput: document.getElementById("license-input"),
  btnActivate: document.getElementById("btn-activate"),
  licenseMsg: document.getElementById("license-msg"),
  btnDeactivate: document.getElementById("btn-deactivate"),
}

function showBanner(text, variant = "") {
  el.statusBanner.textContent = text
  el.statusBanner.className = `status-banner ${variant}`.trim()
  el.statusBanner.classList.remove("hidden")
}

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function getActiveConversation() {
  if (!state.conversation) return null
  if (!state.isPro) return state.conversation
  const filtered = state.conversation.messages.filter((m) =>
    state.selectedIndices.has(m.index),
  )
  return {
    ...state.conversation,
    messages: filtered,
  }
}

function updatePlanUI() {
  if (state.isPro) {
    el.planBadge.textContent = "PRO"
    el.planBadge.className = "badge badge-pro"
    el.upgradeCard.classList.add("hidden")
    el.btnDeactivate.classList.remove("hidden")
  } else {
    el.planBadge.textContent = "FREE"
    el.planBadge.className = "badge badge-free"
    el.upgradeCard.classList.remove("hidden")
    el.btnDeactivate.classList.add("hidden")
  }
  renderMessageList()
}

function renderMessageList() {
  if (!state.conversation || state.conversation.messages.length === 0) {
    el.selectorSection.classList.add("hidden")
    return
  }
  el.selectorSection.classList.remove("hidden")
  el.messageList.innerHTML = ""

  for (const msg of state.conversation.messages) {
    const label = document.createElement("label")
    label.className = "msg-item"

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.checked = state.selectedIndices.has(msg.index)
    checkbox.disabled = !state.isPro
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedIndices.add(msg.index)
      else state.selectedIndices.delete(msg.index)
      el.msgCount.textContent = `${state.selectedIndices.size}/${state.conversation.messages.length} selected`
    })

    const roleTag = document.createElement("span")
    roleTag.className = "msg-role-tag"
    roleTag.textContent = msg.role === "user" ? "YOU" : "AI"

    const preview = document.createElement("span")
    preview.className = "msg-preview"
    preview.textContent = msg.preview || "(empty)"

    label.append(checkbox, roleTag, preview)
    el.messageList.appendChild(label)
  }
}

function requirePro() {
  if (state.isPro) return true
  showBanner("This feature is part of ChatVault Pro ($9.99 one-time).", "error")
  el.licenseInput.focus()
  return false
}

async function loadConversationFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    showBanner("No active tab found.", "error")
    return
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "CHATVAULT_EXTRACT",
    })
    if (!response?.ok || !response.conversation) {
      throw new Error(response?.error || "Unable to read this page.")
    }

    state.conversation = response.conversation
    state.selectedIndices = new Set(
      state.conversation.messages.map((m) => m.index),
    )

    el.platformPill.textContent = state.conversation.platform
    el.chatTitle.textContent = state.conversation.title
    el.msgCount.textContent = `${state.conversation.messages.length} messages`

    if (state.conversation.messages.length === 0) {
      showBanner("No chat messages detected yet. Scroll the chat and reopen ChatVault.", "error")
    }
    renderMessageList()
  } catch {
    el.platformPill.textContent = "Unsupported tab"
    el.chatTitle.textContent = "Open ChatGPT, Claude, Gemini, or NotebookLM"
    el.btnCopyMd.disabled = true
    el.btnDownloadMd.disabled = true
    el.btnExportPdf.disabled = true
    el.btnExportObsidian.disabled = true
    el.btnExportJson.disabled = true
  }
}

el.selectAllBtn.addEventListener("click", () => {
  if (!requirePro() || !state.conversation) return
  state.selectedIndices = new Set(state.conversation.messages.map((m) => m.index))
  el.msgCount.textContent = `${state.selectedIndices.size}/${state.conversation.messages.length} selected`
  renderMessageList()
})

el.selectNoneBtn.addEventListener("click", () => {
  if (!requirePro() || !state.conversation) return
  state.selectedIndices.clear()
  el.msgCount.textContent = `0/${state.conversation.messages.length} selected`
  renderMessageList()
})

el.btnCopyMd.addEventListener("click", async () => {
  const conv = getActiveConversation()
  if (!conv || conv.messages.length === 0) return
  const md = window.ChatVaultFormatters.formatMarkdown(conv)
  await navigator.clipboard.writeText(md)
  showBanner("Copied clean Markdown to clipboard!", "success")
})

el.btnDownloadMd.addEventListener("click", () => {
  const conv = getActiveConversation()
  if (!conv || conv.messages.length === 0) return
  const md = window.ChatVaultFormatters.formatMarkdown(conv)
  const name = `${window.ChatVaultFormatters.sanitizeFilename(conv.title)}.md`
  triggerDownload(name, md, "text/markdown;charset=utf-8")
  showBanner(`Downloaded ${name}`, "success")
})

el.btnExportObsidian.addEventListener("click", () => {
  if (!requirePro()) return
  const conv = getActiveConversation()
  if (!conv || conv.messages.length === 0) return
  const md = window.ChatVaultFormatters.formatObsidianMarkdown(conv)
  const name = `${window.ChatVaultFormatters.sanitizeFilename(conv.title)}-obsidian.md`
  triggerDownload(name, md, "text/markdown;charset=utf-8")
  showBanner(`Exported Obsidian note: ${name}`, "success")
})

el.btnExportPdf.addEventListener("click", () => {
  if (!requirePro()) return
  const conv = getActiveConversation()
  if (!conv || conv.messages.length === 0) return
  const html = window.ChatVaultFormatters.formatPrintHtml(conv, {
    theme: el.pdfTheme.value,
  })
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  chrome.tabs.create({ url })
  showBanner("Opened clean print view — click 'Save as PDF'!", "success")
})

el.btnExportJson.addEventListener("click", () => {
  if (!requirePro()) return
  const conv = getActiveConversation()
  if (!conv || conv.messages.length === 0) return
  const json = window.ChatVaultFormatters.formatJson(conv)
  const name = `${window.ChatVaultFormatters.sanitizeFilename(conv.title)}.json`
  triggerDownload(name, json, "application/json;charset=utf-8")
  showBanner(`Exported ${name}`, "success")
})

el.btnActivate.addEventListener("click", async () => {
  const key = el.licenseInput.value.trim()
  el.licenseMsg.textContent = "Verifying..."
  el.btnActivate.disabled = true
  try {
    const result = await window.ChatVaultLicense.verifyGumroadLicense(key)
    if (!result.valid) {
      el.licenseMsg.textContent = result.error
      return
    }
    await window.ChatVaultLicense.saveLicense(result)
    state.isPro = true
    el.licenseMsg.textContent = ""
    updatePlanUI()
    showBanner("ChatVault Pro activated! Thank you for supporting indie software.", "success")
  } catch {
    el.licenseMsg.textContent = "Network error while verifying license key."
  } finally {
    el.btnActivate.disabled = false
  }
})

el.btnDeactivate.addEventListener("click", async () => {
  await window.ChatVaultLicense.clearLicense()
  state.isPro = false
  updatePlanUI()
  showBanner("License key removed from this browser.", "")
})

async function init() {
  el.buyProLink.href = window.ChatVaultLicense.GUMROAD_CHECKOUT_URL
  const saved = await window.ChatVaultLicense.getSavedLicense()
  state.isPro = Boolean(saved?.valid)
  updatePlanUI()
  await loadConversationFromActiveTab()
}

init()
