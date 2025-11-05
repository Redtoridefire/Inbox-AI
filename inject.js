// inject.js
(function () {
  // ========== CHECK OR CREATE CONTAINER ==========
  let container = document.getElementById("inboxai-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "inboxai-root";
    document.body.appendChild(container);
  }

  // ========== LOAD MINIMIZED STATE ==========
  let isMinimized = localStorage.getItem('inboxai-minimized') === 'true';
  if (isMinimized) {
    container.classList.add('minimized');
  }

  // ========== CREATE MAIN CONTAINER ==========
  const mainContainer = document.createElement("div");
  mainContainer.className = "inboxai-container";

  // ========== HEADER WITH MINIMIZE BUTTON ==========
  const header = document.createElement("div");
  header.className = "inboxai-header";

  const title = document.createElement("div");
  title.className = "inboxai-title";
  title.textContent = "💬 InboxAI — GPT-4o-mini";

  const minimizeBtn = document.createElement("button");
  minimizeBtn.className = "minimize-btn";
  minimizeBtn.innerHTML = "−";
  minimizeBtn.title = "Minimize";

  minimizeBtn.onclick = () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      container.classList.add('minimized');
      minimizeBtn.innerHTML = "−";
      localStorage.setItem('inboxai-minimized', 'true');
    } else {
      container.classList.remove('minimized');
      minimizeBtn.innerHTML = "−";
      localStorage.setItem('inboxai-minimized', 'false');
    }
  };

  // Click to expand when minimized
  mainContainer.onclick = () => {
    if (isMinimized) {
      isMinimized = false;
      container.classList.remove('minimized');
      localStorage.setItem('inboxai-minimized', 'false');
    }
  };

  header.appendChild(title);
  header.appendChild(minimizeBtn);

  // ========== CONTENT WRAPPER ==========
  const contentWrapper = document.createElement("div");
  contentWrapper.className = "inboxai-content";

  // ========== CHAT AREA ==========
  const chatArea = document.createElement("div");
  chatArea.className = "inboxai-response";
  chatArea.style.minHeight = "200px";
  chatArea.style.maxHeight = "300px";

  // ========== INPUT AREA ==========
  const inputArea = document.createElement("div");
  inputArea.className = "inboxai-input-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "inboxai-input";
  input.placeholder = "Ask about your emails or calendar...";

  const sendBtn = document.createElement("button");
  sendBtn.className = "inboxai-button";
  sendBtn.textContent = "Ask AI";

  inputArea.appendChild(input);
  inputArea.appendChild(sendBtn);

  // ========== STATUS MESSAGES AREA ==========
  const statusArea = document.createElement("div");
  statusArea.className = "inboxai-status";

  contentWrapper.appendChild(statusArea);
  contentWrapper.appendChild(chatArea);
  contentWrapper.appendChild(inputArea);

  mainContainer.appendChild(header);
  mainContainer.appendChild(contentWrapper);
  container.appendChild(mainContainer);

  // ========== STATUS MESSAGE HELPER ==========
  const addStatusMessage = (text, type = "info") => {
    const statusMsg = document.createElement("div");
    statusMsg.className = `status-message status-${type}`;
    statusMsg.textContent = text;
    statusArea.appendChild(statusMsg);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      statusMsg.style.transition = "all 0.3s ease";
      statusMsg.style.opacity = "0";
      statusMsg.style.transform = "translateX(-20px)";
      setTimeout(() => statusMsg.remove(), 300);
    }, 5000);
  };

  // ========== SAFE MESSAGE HELPER ==========
  const addMessage = (sender, text, color = "#58a6ff") => {
    chatArea.textContent = ""; // Clear previous

    if (sender === "System") {
      addStatusMessage(text, "info");
      return;
    }

    if (sender === "Error") {
      chatArea.textContent = `❌ ${text}`;
      chatArea.style.color = "#fca5a5";
      return;
    }

    // Display AI response
    chatArea.textContent = text;
    chatArea.style.color = "#e2e8f0";
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
      addStatusMessage("🔍 Checking calendar...", "info");
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
        addStatusMessage(`🔍 Searching emails for: "${searchTerms}"`, "info");
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
        addStatusMessage("🔑 API key loaded and ready!", "success");
      }
    }

    if (msg.type === "INBOXAI_EMAIL_CONTEXT") {
      currentEmail = msg.data;
      addStatusMessage(`📥 Email: "${currentEmail.subject}" from ${currentEmail.sender}`, "info");
    }

    if (msg.type === "INBOXAI_INBOX_CONTEXT") {
      inboxOverview = msg.data || [];
      addStatusMessage(`📬 Inbox updated — ${inboxOverview.length} threads.`, "info");
    }

    if (msg.type === "INBOXAI_CALENDAR_RESPONSE") {
      const { success, events, dateRange } = msg.data || {};
      if (success && events) {
        calendarEvents = events;
        const dateInfo = dateRange ? ` (${new Date(dateRange.timeMin).toLocaleDateString()} - ${new Date(dateRange.timeMax).toLocaleDateString()})` : "";
        addStatusMessage(`📅 Calendar loaded — ${events.length} event(s)${dateInfo}`, "success");
      }
    }

    if (msg.type === "INBOXAI_GMAIL_SEARCH_RESPONSE") {
      const { success, messages, query, error } = msg.data || {};
      
      if (!success) {
        addStatusMessage(`❌ Email search failed: ${error || "Unknown error"}`, "error");
        gmailSearchResults = [];
        return;
      }

      if (messages && messages.length > 0) {
        gmailSearchResults = messages;
        addStatusMessage(`✉️ Found ${messages.length} email(s) for "${query}"`, "success");
      } else {
        gmailSearchResults = [];
        addStatusMessage(`📭 No emails found for "${query}"`, "warning");
      }
    }

    if (msg.type === "INBOXAI_OPENAI_RESPONSE") {
      const { success, content, error } = msg.data || {};
      sendBtn.disabled = false;
      sendBtn.textContent = "Ask AI";

      if (success) {
        chatArea.textContent = content;
        chatArea.style.color = "#e2e8f0";
      } else {
        chatArea.textContent = `❌ ${error || "Something went wrong."}`;
        chatArea.style.color = "#fca5a5";
      }
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
      chatArea.textContent = "⚠️ Missing API key. Save it in the extension popup.";
      chatArea.style.color = "#fde047";
      return;
    }

    // Show user message and loading
    chatArea.innerHTML = '<div class="inboxai-thinking"><div class="inboxai-dot"></div><div class="inboxai-dot"></div><div class="inboxai-dot"></div></div>';
    input.value = "";
    sendBtn.disabled = true;
    sendBtn.textContent = "Thinking...";

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