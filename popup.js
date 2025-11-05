// popup.js
const apiKeyInput = document.getElementById("apiKeyInput");
const saveBtn = document.getElementById("saveBtn");
const statusMsg = document.getElementById("statusMsg");
const authBtn = document.getElementById("authBtn");

// === Load saved key ===
chrome.storage.local.get(["openaiApiKey"], (data) => {
  if (chrome.runtime.lastError) {
    console.error("Storage get error:", chrome.runtime.lastError);
    statusMsg.textContent = "⚠️ Error loading API key.";
    statusMsg.style.color = "#f85149";
    return;
  }
  if (data.openaiApiKey) {
    apiKeyInput.value = data.openaiApiKey;
    statusMsg.textContent = "✅ API key loaded.";
  }
});

// === Save API key ===
saveBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    statusMsg.textContent = "⚠️ Please enter a valid key.";
    statusMsg.style.color = "#f85149";
    return;
  }

  chrome.storage.local.set({ openaiApiKey: key }, () => {
    if (chrome.runtime.lastError) {
      console.error("Storage set error:", chrome.runtime.lastError);
      statusMsg.textContent = "⚠️ Error saving API key.";
      statusMsg.style.color = "#f85149";
    } else {
      statusMsg.textContent = "✅ API key saved successfully.";
      statusMsg.style.color = "#9be9a8";
    }
  });
});

// === Optional Google Auth trigger ===
authBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "GET_CALENDAR_EVENTS" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Runtime message error:", chrome.runtime.lastError);
      statusMsg.textContent = "⚠️ Error connecting to background script.";
      statusMsg.style.color = "#f85149";
      return;
    }
    if (response?.success) {
      statusMsg.textContent = `📅 Connected! ${response.events.length} events found.`;
      statusMsg.style.color = "#9be9a8";
    } else {
      statusMsg.textContent = "⚠️ Google Auth failed.";
      statusMsg.style.color = "#f85149";
    }
  });
});
