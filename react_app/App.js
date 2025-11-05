// react_app/App.js
import React, { useState, useEffect } from "react";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [thinking, setThinking] = useState(false);
  const [statusMessages, setStatusMessages] = useState([]);
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('inboxai-minimized') === 'true';
  });

  // Data state
  const [openaiApiKey, setOpenaiApiKey] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [gmailSearchResults, setGmailSearchResults] = useState([]);

  // Load API key on mount
  useEffect(() => {
    const requestApiKey = () => {
      window.postMessage({ type: "INBOXAI_GET_STORAGE", keys: ["openaiApiKey"] }, window.location.origin);
    };

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

    return () => clearInterval(retry);
  }, [openaiApiKey]);

  // Listen for messages from content script
  useEffect(() => {
    const messageHandler = (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "INBOXAI_STORAGE_RESPONSE") {
        const apiKey = msg.data?.openaiApiKey || null;
        if (apiKey) {
          setOpenaiApiKey(apiKey);
          addStatusMessage("🔑 API key loaded and ready!", "success");
        }
      }

      if (msg.type === "INBOXAI_CALENDAR_RESPONSE") {
        const { success, events, dateRange } = msg.data || {};
        if (success && events) {
          setCalendarEvents(events);
          const dateInfo = dateRange
            ? ` (${new Date(dateRange.timeMin).toLocaleDateString()} - ${new Date(dateRange.timeMax).toLocaleDateString()})`
            : "";
          addStatusMessage(`📅 Calendar loaded — ${events.length} event(s)${dateInfo}`, "success");
        }
      }

      if (msg.type === "INBOXAI_GMAIL_SEARCH_RESPONSE") {
        const { success, messages, query, error } = msg.data || {};

        if (!success) {
          addStatusMessage(`❌ Email search failed: ${error || "Unknown error"}`, "error");
          setGmailSearchResults([]);
          return;
        }

        if (messages && messages.length > 0) {
          setGmailSearchResults(messages);
          addStatusMessage(`✉️ Found ${messages.length} email(s) for "${query}"`, "success");
        } else {
          setGmailSearchResults([]);
          addStatusMessage(`📭 No emails found for "${query}"`, "warning");
        }
      }

      if (msg.type === "INBOXAI_OPENAI_RESPONSE") {
        const { success, content, error } = msg.data || {};
        if (success) {
          setResponse(content);
        } else {
          setResponse(`Error: ${error || "Something went wrong."}`);
        }
        setThinking(false);
      }
    };

    window.addEventListener("message", messageHandler);
    return () => window.removeEventListener("message", messageHandler);
  }, []);

  // Helper to add status messages
  const addStatusMessage = (message, type = "info") => {
    setStatusMessages(prev => [...prev, { message, type, timestamp: Date.now() }]);
    // Clear old messages after 5 seconds
    setTimeout(() => {
      setStatusMessages(prev => prev.filter(m => m.timestamp > Date.now() - 5000));
    }, 5000);
  };

  // Smart query detection
  const detectQueryIntent = (userInput) => {
    const lower = userInput.toLowerCase();

    const calendarKeywords = ["meeting", "event", "calendar", "appointment", "schedule", "tomorrow", "this week", "next week"];
    const hasCalendarIntent = calendarKeywords.some(kw => lower.includes(kw));

    const emailKeywords = ["email", "message", "mail", "from", "about", "subject", "sent", "find", "search"];
    const hasEmailIntent = emailKeywords.some(kw => lower.includes(kw));

    return { hasCalendarIntent, hasEmailIntent };
  };

  // Extract search terms from query
  const extractSearchTerms = (userInput) => {
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
      topic = topic.replace(/[?!.,;]+$/, '');
      return topic;
    }

    // Remove common question words but keep the meat
    let searchQuery = lower
      .replace(/^(find|search|show|get|any|check)\s+/gi, "")
      .replace(/\b(emails?|messages?|mail|threads?)\b/gi, "")
      .replace(/\s+for\s+me\b/gi, "")
      .trim();

    searchQuery = searchQuery.replace(/[?!.,;]+$/, '');

    return searchQuery || userInput;
  };

  // Fetch relevant data based on query
  const fetchRelevantData = async (userInput) => {
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

          const timeoutId = setTimeout(() => {
            window.removeEventListener("message", handler);
            resolve();
          }, 5000);
        });
        promises.push(gmailPromise);
      }
    }

    await Promise.all(promises);
  };

  // Build context prompt with Gmail/Calendar data
  const buildPrompt = (userInput) => {
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

    // Add Gmail search results
    if (gmailSearchResults.length) {
      availableData.push("Gmail search results");
      const searchList = gmailSearchResults
        .map((e, i) => `${i + 1}. From: ${e.from}\n   Subject: ${e.subject}\n   Date: ${e.date}\n   Preview: ${e.snippet}`)
        .join("\n\n");
      dataContext += `=== EMAIL SEARCH RESULTS ===\n${searchList}\n\n`;
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
  };

  // Toggle minimize
  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    localStorage.setItem('inboxai-minimized', newState.toString());
  };

  // Expand when clicking minimized container
  const handleContainerClick = () => {
    if (isMinimized) {
      setIsMinimized(false);
      localStorage.setItem('inboxai-minimized', 'false');
    }
  };

  // Main handler
  const handleAskAI = async () => {
    if (!prompt.trim()) return;

    if (!openaiApiKey) {
      setResponse("⚠️ Missing API key. Save it in the extension popup.");
      return;
    }

    setThinking(true);
    setResponse("");
    setStatusMessages([]);

    try {
      // Fetch relevant data and wait for it to complete
      await fetchRelevantData(prompt);

      // Now send to OpenAI with all the data
      window.postMessage(
        {
          type: "INBOXAI_OPENAI_CALL",
          prompt: buildPrompt(prompt),
          apiKey: openaiApiKey
        },
        window.location.origin
      );
    } catch (err) {
      setResponse(`Error: ${err.message || "Something went wrong."}`);
      setThinking(false);
    }
  };

  return (
    <div id="inboxai-root" className={isMinimized ? 'minimized' : ''}>
      <div className="inboxai-container" onClick={handleContainerClick}>
        <div className="inboxai-header">
          <div className="inboxai-title">💬 InboxAI — GPT-4o-mini</div>
          <button
            className="minimize-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimize();
            }}
            title="Minimize"
          >
            −
          </button>
        </div>

        <div className="inboxai-content">
          {/* Status messages */}
          {statusMessages.length > 0 && (
            <div className="inboxai-status">
              {statusMessages.map((msg, idx) => (
                <div key={idx} className={`status-message status-${msg.type}`}>
                  {msg.message}
                </div>
              ))}
            </div>
          )}

          <div className="inboxai-response">
            {thinking && (
              <div className="inboxai-thinking">
                <div className="inboxai-dot"></div>
                <div className="inboxai-dot"></div>
                <div className="inboxai-dot"></div>
              </div>
            )}
            {!thinking && response && <div style={{ whiteSpace: 'pre-wrap' }}>{response}</div>}
          </div>

          <div className="inboxai-input-row">
            <input
              className="inboxai-input"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about your emails or calendar..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAskAI();
              }}
            />
            <button className="inboxai-button" onClick={handleAskAI} disabled={thinking}>
              {thinking ? "Thinking..." : "Ask AI"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
