// inject.js
(function () {
  // ========== CHECK OR CREATE CONTAINER ==========
  let container = document.getElementById("inboxai-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "inboxai-root";
    document.body.appendChild(container);
  }

  // ========== STYLE CONTAINER ==========
  Object.assign(container.style, {
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "340px",
    height: "440px",
    background: "#0b1623",
    border: "1px solid #2388ff",
    boxShadow: "0 0 14px rgba(35,136,255,0.35)",
    borderRadius: "10px",
    overflow: "hidden",
    fontFamily: "Inter, Arial, sans-serif",
    color: "#e6f1ff",
    zIndex: "2147483647",
  });

  // ========== HEADER ==========
  const header = document.createElement("div");
  Object.assign(header.style, {
    background: "#0e1b2a",
    padding: "10px",
    fontSize: "15px",
    fontWeight: "600",
    borderBottom: "1px solid #2388ff",
    textAlign: "center",
    color: "#e6f1ff",
  });
  header.textContent = "💬 InboxAI — GPT-4o-mini";

  // ========== CHAT AREA ==========
  const chatArea = document.createElement("div");
  Object.assign(chatArea.style, {
    flex: "1",
    overflowY: "auto",
    padding: "10px",
    height: "340px",
    scrollBehavior: "smooth",
  });

  // ========== INPUT AREA ==========
  const inputArea = document.createElement("div");
  Object.assign(inputArea.style, {
    display: "flex",
    borderTop: "1px solid #2388ff",
    background: "#0b1623",
    padding: "6px",
  });

  const input = document.createElement("textarea");
  Object.assign(input.style, {
    flex: "1",
    padding: "8px",
    background: "#101c2b",
    border: "1px solid #1f6feb",
    borderRadius: "6px",
    color: "#e6f1ff",
    fontSize: "14px",
    resize: "none",
    outline: "none",
  });
  input.rows = 2;
  input.placeholder = "Ask InboxAI something...";

  const sendBtn = document.createElement("button");
  Object.assign(sendBtn.style, {
    background: "#2388ff",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    marginLeft: "6px",
    padding: "0 16px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "background 0.2s ease",
  });
  sendBtn.textContent = "Send";
  sendBtn.onmouseenter = () => (sendBtn.style.background = "#2a98ff");
  sendBtn.onmouseleave = () => (sendBtn.style.background = "#2388ff");

  inputArea.appendChild(input);
  inputArea.appendChild(sendBtn);
  container.append(header, chatArea, inputArea);

  // ========== SAFE MESSAGE HELPER ==========
  const addMessage = (sender, text, color = "#58a6ff") => {
    const msg = document.createElement("div");
    msg.style.margin = "8px 0";
    msg.style.lineHeight = "1.5";
    const label = document.createElement("b");
    label.style.color = color;
    label.style.fontWeight = "600";
    label.textContent = `${sender}: `;
    const body = document.createElement("div");
    body.style.color = "#c9d1d9";
    body.style.marginTop = "4px";
    body.style.whiteSpace = "pre-wrap";

    // Use textContent to prevent XSS vulnerabilities
    // Basic formatting: convert numbered lists to bullets
    let formattedText = text.replace(/^\d+\.\s/gm, '• ');
    body.textContent = formattedText;

    msg.append(label, body);
    chatArea.appendChild(msg);
    chatArea.scrollTop = chatArea.scrollHeight;
  };

  // ========== STATE ==========
  let openaiApiKey = null;
  let currentEmail = null;
  let inboxOverview = [];
  let calendarEvents = [];
  let gmailSearchResults = [];

  // ========== REQUEST API KEY ==========
  function requestApiKey() {
    window.postMessage({ type: "INBOXAI_GET_STORAGE", keys: ["openaiApiKey"] }, window.location.origin);
  }
  let tries = 0;
  const maxRetries = 5;
  const retry = setInterval(() => {
    if (openaiApiKey || tries >= maxRetries) {
      clearInterval(retry);
      return;
    }
    requestApiKey();
    tries++;
  }, 1000);
  requestApiKey();

  // ========== SMART QUERY DETECTION ==========
  function detectQueryIntent(userInput) {
    const lower = userInput.toLowerCase();
    
    // Calendar query detection
    const calendarKeywords = ["meeting", "event", "calendar", "appointment", "schedule", "tomorrow", "this week", "next week"];
    const hasCalendarIntent = calendarKeywords.some(kw => lower.includes(kw));
    
    // Email search detection
    const emailKeywords = ["email", "message", "mail", "from", "about", "subject", "sent", "find", "search"];
    const hasEmailIntent = emailKeywords.some(kw => lower.includes(kw));
    
    return { hasCalendarIntent, hasEmailIntent };
  }

  // ========== EXTRACT SEARCH TERMS FROM QUERY ==========
  function extractSearchTerms(userInput) {
    const lower = userInput.toLowerCase().trim();
    
    // Check for explicit "from:" pattern
    const fromMatch = lower.match(/from:?\s*([a-zA-Z0-9@.\s]+?)(?:\s+about|\s+regarding|$)/i);
    if (fromMatch) {
      return `from:${fromMatch[1].trim()}`;
    }
    
    // Check for "from [name]" pattern
    const fromPattern = lower.match(/\b(?:from|by)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i);
    if (fromPattern) {
      return `from:${fromPattern[1].trim()}`;
    }
    
    // Check for "about [topic]" or "regarding [topic]"
    const aboutPattern = lower.match(/\b(?:about|regarding|concerning)\s+(.+?)(?:\s+from|$)/i);
    if (aboutPattern) {
      let topic = aboutPattern[1].trim();
      // Clean up punctuation
      topic = topic.replace(/[?!.,;]+$/, '');
      return topic;
    }
    
    // Remove common question words but keep the meat
    let searchQuery = lower
      .replace(/^(find|search|show|get|any|check)\s+/gi, "")
      .replace(/\b(emails?|messages?|mail|threads?)\b/gi, "")
      .replace(/\s+for\s+me\b/gi, "")
      .trim();
    
    // Clean up trailing punctuation
    searchQuery = searchQuery.replace(/[?!.,;]+$/, '');
    
    return searchQuery || userInput;
  }

  // ========== FETCH DATA BASED ON QUERY ==========
  async function fetchRelevantData(userInput) {
    const { hasCalendarIntent, hasEmailIntent } = detectQueryIntent(userInput);
    const promises = [];

    // Fetch calendar if needed
    if (hasCalendarIntent) {
      addMessage("System", "🔍 Checking calendar...", "#9be9a8");
      const calendarPromise = new Promise((resolve) => {
        const handler = (event) => {
          if (event.data?.type === "INBOXAI_CALENDAR_RESPONSE") {
            window.removeEventListener("message", handler);
            clearTimeout(timeoutId);
            resolve();
          }
        };
        window.addEventListener("message", handler);
        window.postMessage({ type: "INBOXAI_REQUEST_CALENDAR", query: userInput }, window.location.origin);
        // Timeout after 5 seconds
        const timeoutId = setTimeout(() => {
          window.removeEventListener("message", handler);
          resolve();
        }, 5000);
      });
      promises.push(calendarPromise);
    }
    
    // Search Gmail if needed
    if (hasEmailIntent) {
      const searchTerms = extractSearchTerms(userInput);
      if (searchTerms) {
        addMessage("System", `🔍 Searching emails for: "${searchTerms}"`, "#9be9a8");
        const gmailPromise = new Promise((resolve) => {
          const handler = (event) => {
            if (event.data?.type === "INBOXAI_GMAIL_SEARCH_RESPONSE") {
              window.removeEventListener("message", handler);
              clearTimeout(timeoutId);
              resolve();
            }
          };
          window.addEventListener("message", handler);
          window.postMessage({ type: "INBOXAI_SEARCH_GMAIL", searchQuery: searchTerms }, window.location.origin);
          // Timeout after 5 seconds
          const timeoutId = setTimeout(() => {
            window.removeEventListener("message", handler);
            resolve();
          }, 5000);
        });
        promises.push(gmailPromise);
      }
    }

    // Wait for all data to be fetched
    await Promise.all(promises);
  }

  // ========== HANDLE RESPONSES ==========
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg) return;

    if (msg.type === "INBOXAI_STORAGE_RESPONSE") {
      openaiApiKey = msg.data?.openaiApiKey || null;
      if (openaiApiKey) {
        addMessage("System", "🔑 API key loaded and ready!", "#9be9a8");
      }
    }

    if (msg.type === "INBOXAI_EMAIL_CONTEXT") {
      currentEmail = msg.data;
      addMessage("System", `📥 Email: "${currentEmail.subject}" from ${currentEmail.sender}`, "#9be9a8");
    }

    if (msg.type === "INBOXAI_INBOX_CONTEXT") {
      inboxOverview = msg.data || [];
      addMessage("System", `📬 Inbox updated — ${inboxOverview.length} threads.`, "#9be9a8");
    }

    if (msg.type === "INBOXAI_CALENDAR_RESPONSE") {
      const { success, events, dateRange } = msg.data || {};
      if (success && events) {
        calendarEvents = events;
        const dateInfo = dateRange ? ` (${new Date(dateRange.timeMin).toLocaleDateString()} - ${new Date(dateRange.timeMax).toLocaleDateString()})` : "";
        addMessage("System", `📅 Calendar loaded — ${events.length} event(s)${dateInfo}`, "#9be9a8");
      }
    }

    if (msg.type === "INBOXAI_GMAIL_SEARCH_RESPONSE") {
      const { success, messages, query, error } = msg.data || {};
      
      if (!success) {
        addMessage("System", `❌ Email search failed: ${error || "Unknown error"}`, "#f85149");
        gmailSearchResults = [];
        return;
      }
      
      if (messages && messages.length > 0) {
        gmailSearchResults = messages;
        addMessage("System", `✉️ Found ${messages.length} email(s) for "${query}"`, "#9be9a8");
      } else {
        gmailSearchResults = [];
        addMessage("System", `📭 No emails found for "${query}"`, "#ffa657");
      }
    }

    if (msg.type === "INBOXAI_OPENAI_RESPONSE") {
      const { success, content, error } = msg.data || {};
      if (success) addMessage("InboxAI", content);
      else addMessage("Error", error || "Something went wrong.", "#f85149");
    }
  });

  // ========== BUILD PROMPT ==========
  function buildPrompt(userInput) {
    let systemContext = "You are InboxAI, an AI assistant with access to the user's Gmail and Google Calendar data.\n\n";
    let dataContext = "";
    let availableData = [];
    
    // Add calendar context
    if (calendarEvents.length) {
      availableData.push("calendar events");
      const eventList = calendarEvents
        .map((e, i) => {
          const date = new Date(e.start);
          return `${i + 1}. ${e.summary} at ${date.toLocaleString()}${e.description ? ' - ' + e.description : ''}`;
        })
        .join("\n");
      dataContext += `=== CALENDAR EVENTS ===\n${eventList}\n\n`;
    }
    
    // Add Gmail search results (priority over inbox overview)
    if (gmailSearchResults.length) {
      availableData.push("Gmail search results");
      const searchList = gmailSearchResults
        .map((e, i) => `${i + 1}. From: ${e.from}\n   Subject: ${e.subject}\n   Date: ${e.date}\n   Preview: ${e.snippet}`)
        .join("\n\n");
      dataContext += `=== EMAIL SEARCH RESULTS ===\n${searchList}\n\n`;
    } else if (currentEmail) {
      availableData.push("current email");
      dataContext += `=== CURRENT EMAIL ===\nFrom: ${currentEmail.sender}\nSubject: ${currentEmail.subject}\nBody: ${currentEmail.body}\n\n`;
    } else if (inboxOverview.length) {
      availableData.push("inbox overview");
      const summary = inboxOverview
        .slice(0, 5)
        .map((e, i) => `${i + 1}. ${e.sender} — ${e.subject} (${e.snippet})`)
        .join("\n");
      dataContext += `=== RECENT INBOX ===\n${summary}\n\n`;
    }
    
    // Build system message
    if (availableData.length > 0) {
      systemContext += `You currently have access to: ${availableData.join(", ")}.\n`;
      systemContext += "Use this data to answer the user's question directly. Be concise and helpful.\n\n";
    } else {
      systemContext += "No email or calendar data is currently loaded. Let the user know you need them to grant permissions or that no relevant data was found.\n\n";
    }

    const fullPrompt = `${systemContext}${dataContext}User question: ${userInput}\n\nAnswer:`;
    return fullPrompt;
  }

  // ========== SEND BUTTON ==========
  sendBtn.addEventListener("click", async () => {
    const userInput = input.value.trim();
    if (!userInput) return;

    if (!openaiApiKey) {
      addMessage("System", "⚠️ Missing API key. Save it in the popup.", "#f85149");
      return;
    }

    addMessage("You", userInput, "#9be9a8");
    input.value = "";

    // Fetch relevant data and wait for it to complete
    await fetchRelevantData(userInput);
    
    // Now send to OpenAI with all the data
    window.postMessage(
      { type: "INBOXAI_OPENAI_CALL", prompt: buildPrompt(userInput), apiKey: openaiApiKey },
      window.location.origin
    );
  });

  // Allow Enter to send
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });
})();