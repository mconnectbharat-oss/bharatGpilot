// Runs only after the user selects the page-summary context-menu action.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "REQUEST_DOM_TEXT") return;

  const selectors = ["article", "main", "[role='main']", ".content", "body"];
  let rawText = "";
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      rawText = element.innerText || element.textContent || "";
      if (rawText.trim()) break;
    }
  }

  const cleanText = rawText
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16000);
  sendResponse({ text: cleanText });
});
