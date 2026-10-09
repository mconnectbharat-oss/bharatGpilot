// MV3 service worker: open the side panel and pass explicit user-requested page context.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Unable to enable side panel action:", error));

const CONTEXT_KEY = "bgp_pending_context";

async function deliverContext(type, data, tabId) {
  const payload = {
    type,
    data: typeof data === "string" ? data.slice(0, 16000) : "",
    sourceUrl: typeof tabId === "number" ? undefined : undefined,
    createdAt: Date.now()
  };
  // Session storage avoids persisting captured page text across browser restarts.
  await chrome.storage.session.set({ [CONTEXT_KEY]: payload });
  if (typeof tabId === "number") {
    try {
      await chrome.sidePanel.open({ tabId });
    } catch (error) {
      console.warn("Could not open the side panel for context:", error);
    }
  }
  try {
    await chrome.runtime.sendMessage({ type: "BGP_CONTEXT_AVAILABLE" });
  } catch {
    // The side panel may not be mounted yet; it reads the session-storage queue on open.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "explain-selection",
      title: "Ask BharatGPilot to explain selected text",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "summarize-page",
      title: "Summarize this page with BharatGPilot",
      contexts: ["page"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || typeof tab.id !== "number") return;

  if (info.menuItemId === "explain-selection") {
    const selection = typeof info.selectionText === "string" ? info.selectionText.trim() : "";
    if (selection) await deliverContext("CONTEXT_SELECTION", selection, tab.id);
    return;
  }

  if (info.menuItemId === "summarize-page") {
    try {
      // activeTab + scripting limits extraction to the tab the user acted on.
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["contentScript.js"]
      });
      const response = await chrome.tabs.sendMessage(tab.id, { type: "REQUEST_DOM_TEXT" });
      if (response && typeof response.text === "string" && response.text.trim()) {
        await deliverContext("CONTEXT_PAGE", response.text, tab.id);
      } else {
        await deliverContext("CONTEXT_ERROR", "No readable page text was found.", tab.id);
      }
    } catch (error) {
      console.warn("Page text extraction failed:", error);
      await deliverContext(
        "CONTEXT_ERROR",
        "This page does not permit text extraction (for example, a browser-internal or restricted page).",
        tab.id
      );
    }
  }
});
