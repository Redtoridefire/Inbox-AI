// content.js
// === INJECT CSS ===
(function injectCSS() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content.css');
  (document.head || document.documentElement).appendChild(link);
})();

// === INJECT THE SCRIPT INTO THE PAGE ===
(function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
})();

// === Listen for messages from the injected page ===
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data) return;

  const msg = event.data;

  // === Storage request ===
  if (msg.type === "INBOXAI_GET_STORAGE") {
    chrome.storage.local.get(msg.keys, (data) => {
      if (chrome.runtime.lastError) {
        console.error("Storage get error:", chrome.runtime.lastError);
        window.postMessage({ type: "INBOXAI_STORAGE_RESPONSE", data: {}, error: chrome.runtime.lastError.message }, window.location.origin);
      } else {
        window.postMessage({ type: "INBOXAI_STORAGE_RESPONSE", data }, window.location.origin);
      }
    });
  }

  // === OpenAI call forwarding ===
  if (msg.type === "INBOXAI_OPENAI_CALL") {
    chrome.runtime.sendMessage(
      {
        type: "INBOXAI_OPENAI_CALL",
        prompt: msg.prompt,
        apiKey: msg.apiKey,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime message error:", chrome.runtime.lastError);
          window.postMessage(
            { type: "INBOXAI_OPENAI_RESPONSE", data: { success: false, error: chrome.runtime.lastError.message } },
            window.location.origin
          );
        } else {
          window.postMessage(
            { type: "INBOXAI_OPENAI_RESPONSE", data: response },
            window.location.origin
          );
        }
      }
    );
  }

  // === Calendar request forwarding (with query for date parsing) ===
  if (msg.type === "INBOXAI_REQUEST_CALENDAR") {
    chrome.runtime.sendMessage(
      {
        type: "GET_CALENDAR_EVENTS",
        query: msg.query || ""
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime message error:", chrome.runtime.lastError);
          window.postMessage(
            { type: "INBOXAI_CALENDAR_RESPONSE", data: { success: false, error: chrome.runtime.lastError.message } },
            window.location.origin
          );
        } else {
          window.postMessage(
            { type: "INBOXAI_CALENDAR_RESPONSE", data: response },
            window.location.origin
          );
        }
      }
    );
  }

  // === Gmail search forwarding (NEW) ===
  if (msg.type === "INBOXAI_SEARCH_GMAIL") {
    chrome.runtime.sendMessage(
      {
        type: "SEARCH_GMAIL",
        searchQuery: msg.searchQuery
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime message error:", chrome.runtime.lastError);
          window.postMessage(
            { type: "INBOXAI_GMAIL_SEARCH_RESPONSE", data: { success: false, error: chrome.runtime.lastError.message } },
            window.location.origin
          );
        } else {
          window.postMessage(
            { type: "INBOXAI_GMAIL_SEARCH_RESPONSE", data: response },
            window.location.origin
          );
        }
      }
    );
  }

  // === Gmail context extraction (inbox overview) ===
  if (msg.type === "INBOXAI_REQUEST_INBOX") {
    const threads = Array.from(
      document.querySelectorAll("tr.zA")
    ).map((row) => {
      const sender = row.querySelector(".yX.xY .yW span")?.textContent || "Unknown";
      const subject = row.querySelector(".bog span")?.textContent || "";
      const snippet = row.querySelector(".y2")?.textContent?.trim() || "";
      return { sender, subject, snippet };
    });

    window.postMessage(
      { type: "INBOXAI_INBOX_CONTEXT", data: threads },
      window.location.origin
    );
  }
});