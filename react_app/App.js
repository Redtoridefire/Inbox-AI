// react_app/App.js
import React, { useState } from "react";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [thinking, setThinking] = useState(false);

  const handleAskAI = async () => {
    if (!prompt.trim()) return;

    setThinking(true);
    setResponse("");

    try {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "ASK_AI", prompt }, (res) => {
          // Check for Chrome API errors
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(res);
        });
      });

      if (result?.success) {
        setResponse(result.answer);
      } else {
        setResponse(result?.error || "Error communicating with AI.");
      }
    } catch (err) {
      setResponse(`Error: ${err.message || "Something went wrong."}`);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="inboxai-container">
      <div className="inboxai-header">InboxAI 🤖</div>

      <div className="inboxai-input-row">
        <input
          className="inboxai-input"
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask GPT-4o-mini anything..."
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAskAI();
          }}
        />
        <button className="inboxai-button" onClick={handleAskAI}>
          {thinking ? "Thinking..." : "Ask AI"}
        </button>
      </div>

      <div className="inboxai-response">
        {thinking && (
          <div className="inboxai-thinking">
            <div className="inboxai-dot"></div>
            <div className="inboxai-dot"></div>
            <div className="inboxai-dot"></div>
          </div>
        )}
        {!thinking && response && <div>{response}</div>}
      </div>
    </div>
  );
}
