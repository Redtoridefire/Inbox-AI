// react_app/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "../content.css"; // bring in dark theme

// Ensure InboxAI root exists
let container = document.getElementById("inboxai-root");
if (!container) {
  container = document.createElement("div");
  container.id = "inboxai-root";
  document.body.appendChild(container);
}

// Mount React app
const root = createRoot(container);
root.render(<App />);
