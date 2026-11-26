// Content script: runs 100% locally on supported AI chat pages and only
// extracts DOM content when explicitly triggered by the user via the popup.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CHATVAULT_EXTRACT") return false

  try {
    const conversation = window.ChatVaultExtractors.extractConversation(
      document,
      window.location,
    )
    sendResponse({ ok: true, conversation })
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  return true
})
