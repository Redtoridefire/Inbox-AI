// content.js
console.log("InboxAI content script loaded");

// === INJECT THE SCRIPT INTO THE PAGE ===
(function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    console.log("inject.js loaded successfully");
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
      window.postMessage({ type: "INBOXAI_STORAGE_RESPONSE", data }, "*");
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
        window.postMessage(
          { type: "INBOXAI_OPENAI_RESPONSE", data: response },
          "*"
        );
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
        window.postMessage(
          { type: "INBOXAI_CALENDAR_RESPONSE", data: response },
          "*"
        );
      }
    );
  }

  // === Gmail search forwarding (NEW) ===
  if (msg.type === "INBOXAI_SEARCH_GMAIL") {
    console.log("🔍 Content script: Forwarding Gmail search request:", msg.searchQuery);
    chrome.runtime.sendMessage(
      {
        type: "SEARCH_GMAIL",
        searchQuery: msg.searchQuery
      },
      (response) => {
        console.log("📧 Content script: Gmail search response received:", response);
        window.postMessage(
          { type: "INBOXAI_GMAIL_SEARCH_RESPONSE", data: response },
          "*"
        );
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
      "*"
    );
  }
});

console.log("InboxAI bridge ready between inject.js and background.js");