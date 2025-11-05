// react_app/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "../content.css"; // bring in dark theme

// Ensure InboxAI root exists
const container = document.getElementById("inboxai-root");
if (!container) {
  const newRoot = document.createElement("div");
  newRoot.id = "inboxai-root";
  document.body.appendChild(newRoot);
}

// Mount React app
const root = createRoot(document.getElementById("inboxai-root"));
root.render(<App />);
