console.log("📡 InboxAI Background Script Loaded");

// ====== CONFIG ======
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// ====== AUTH & TOKEN HANDLING ======
async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error("❌ Auth token error:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log("✅ OAuth token acquired.");
        resolve(token);
      }
    });
  });
}

// ====== GOOGLE API CALLER ======
async function googleApiRequest(apiUrl, token) {
  const res = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google API Error: ${res.status} - ${errText}`);
  }
  return res.json();
}

// ====== PARSE DATE RANGE FROM USER QUERY ======
function parseDateRange(query) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  query = query.toLowerCase();
  
  // Tomorrow
  if (query.includes("tomorrow")) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    return { timeMin: tomorrow, timeMax: dayAfter };
  }
  
  // This week (next 7 days)
  if (query.includes("this week") || query.includes("next 7 days")) {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return { timeMin: today, timeMax: weekEnd };
  }
  
  // Next week
  if (query.includes("next week")) {
    const nextWeekStart = new Date(today);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    return { timeMin: nextWeekStart, timeMax: nextWeekEnd };
  }
  
  // Default: today
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  return { timeMin: today, timeMax: endOfToday };
}

// ====== GET CALENDAR EVENTS (with flexible date range) ======
async function fetchCalendarEvents(query = "") {
  try {
    const token = await getAuthToken();
    const { timeMin, timeMax } = parseDateRange(query);

    const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`;

    const data = await googleApiRequest(apiUrl, token);
    const events = (data.items || []).map((event) => ({
      summary: event.summary,
      start: event.start.dateTime || event.start.date,
      description: event.description || ""
    }));

    console.log("📅 Calendar events:", events);
    return { success: true, events, dateRange: { timeMin, timeMax } };
  } catch (err) {
    console.error("❌ Calendar fetch error:", err);
    return { success: false, error: err.message };
  }
}

// ====== SEARCH GMAIL MESSAGES ======
async function searchGmailMessages(searchQuery) {
  try {
    console.log("🔍 Background: Searching Gmail for:", searchQuery);
    const token = await getAuthToken();
    
    // Use Gmail search with q parameter
    const encodedQuery = encodeURIComponent(searchQuery);
    const apiUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodedQuery}&maxResults=10`;
    
    console.log("🔍 Background: Gmail API URL:", apiUrl);
    const listRes = await googleApiRequest(apiUrl, token);
    console.log("🔍 Background: Gmail API response:", listRes);

    const messages = [];
    if (listRes.messages && listRes.messages.length > 0) {
      for (const msg of listRes.messages) {
        const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
        const detail = await googleApiRequest(detailUrl, token);

        const headers = detail.payload.headers;
        const subject = headers.find((h) => h.name === "Subject")?.value || "(No subject)";
        const from = headers.find((h) => h.name === "From")?.value || "(Unknown sender)";
        const date = headers.find((h) => h.name === "Date")?.value || "";
        const snippet = detail.snippet || "";

        messages.push({ id: msg.id, subject, from, date, snippet });
      }
    } else {
      console.log("🔍 Background: No messages found for query:", searchQuery);
    }

    console.log("🔍 Background: Returning", messages.length, "Gmail search results");
    return { success: true, messages, query: searchQuery };
  } catch (err) {
    console.error("❌ Background: Gmail search error:", err);
    return { success: false, error: err.message };
  }
}

// ====== GET GMAIL THREADS (recent inbox) ======
async function fetchGmailThreads() {
  try {
    const token = await getAuthToken();
    const apiUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10`;
    const listRes = await googleApiRequest(apiUrl, token);

    const messages = [];
    if (listRes.messages) {
      for (const msg of listRes.messages) {
        const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
        const detail = await googleApiRequest(detailUrl, token);

        const headers = detail.payload.headers;
        const subject = headers.find((h) => h.name === "Subject")?.value || "(No subject)";
        const from = headers.find((h) => h.name === "From")?.value || "(Unknown sender)";
        const snippet = detail.snippet || "";

        messages.push({ id: msg.id, subject, from, snippet });
      }
    }

    console.log("📧 Gmail threads:", messages);
    return { success: true, messages };
  } catch (err) {
    console.error("❌ Gmail fetch error:", err);
    return { success: false, error: err.message };
  }
}

// ====== OPENAI CHAT COMPLETION ======
async function askOpenAI(prompt, apiKey) {
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "(No response)";
    return { success: true, content };
  } catch (err) {
    console.error("❌ OpenAI request error:", err);
    return { success: false, error: err.message };
  }
}

// ====== MESSAGE HANDLER ======
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.type) {
        case "GET_CALENDAR_EVENTS":
          sendResponse(await fetchCalendarEvents(request.query || ""));
          break;

        case "GET_GMAIL_MESSAGES":
          sendResponse(await fetchGmailThreads());
          break;

        case "SEARCH_GMAIL":
          sendResponse(await searchGmailMessages(request.searchQuery));
          break;

        case "INBOXAI_OPENAI_CALL":
          const { prompt, apiKey } = request;
          sendResponse(await askOpenAI(prompt, apiKey));
          break;

        default:
          console.warn("⚠️ Unknown request type:", request.type);
          sendResponse({ success: false, error: "Unknown request type." });
      }
    } catch (err) {
      console.error("💥 Background error:", err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true; // Keeps sendResponse async
});