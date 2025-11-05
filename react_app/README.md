# React App Implementation

This directory contains a **React-based** alternative UI for InboxAI with **full Gmail and Calendar integration**.

## ✨ Features

The React app now has **feature parity** with the vanilla JS implementation:

- ✅ **Smart Natural Language Queries**
  - "Do I have meetings tomorrow?"
  - "Show me emails from John"
  - "What's on my calendar this week?"
  - "Find emails about interviews"

- ✅ **Gmail Search Integration**
  - Automatic search term extraction
  - Supports "from:", "about:", and natural language
  - Real-time search results

- ✅ **Calendar Integration**
  - Date range parsing (tomorrow, this week, next week)
  - Event fetching and display
  - Natural language date queries

- ✅ **Smart Query Detection**
  - Automatically detects email vs calendar queries
  - Fetches relevant data before sending to OpenAI
  - Builds intelligent context prompts

- ✅ **Status Messages**
  - Real-time feedback on data fetching
  - Color-coded status (info, success, warning, error)
  - Auto-dismissing notifications

- ✅ **All Security Fixes Applied**
  - Proper error handling
  - Secure postMessage communication
  - API key management

## 📊 Feature Comparison

| Feature | Vanilla JS (inject.js) | React (App.js) |
|---------|----------------------|----------------|
| OpenAI Chat | ✅ | ✅ |
| Calendar Integration | ✅ | ✅ |
| Gmail Search | ✅ | ✅ |
| Email Context | ✅ | ✅ |
| Smart Query Detection | ✅ | ✅ |
| Status Messages | ✅ | ✅ |
| Build Required | ❌ | ✅ |
| Security Fixes | ✅ | ✅ |

## 🎯 Your Goal: Natural Language Gmail & Calendar Search

This implementation lets you use natural language to search through your inbox and calendar:

**Example Queries:**
- "Do I have any meetings tomorrow?"
- "Show me emails from Sarah about the project"
- "What's on my calendar this week?"
- "Find emails about job interviews"
- "Any events scheduled for next Monday?"

The app automatically:
1. Detects if you're asking about emails or calendar
2. Extracts search terms intelligently
3. Fetches relevant data from Gmail/Google Calendar APIs
4. Sends everything to GPT-4o-mini with context
5. Returns a natural language answer

## 🚀 How to Use the React App

### Option 1: Use Vanilla JS (Current - No Changes Needed)

The current `inject.js` implementation works out of the box with all features. **No changes needed.**

### Option 2: Switch to React (Requires Build Setup)

#### Step 1: Install Dependencies

```bash
npm install react react-dom
npm install --save-dev webpack webpack-cli babel-loader @babel/core @babel/preset-react
```

#### Step 2: Create webpack.config.js

Create a file in the root directory:

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  entry: './react_app/index.js',
  output: {
    path: path.resolve(__dirname),
    filename: 'inject-react.js'
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  }
};
```

#### Step 3: Install CSS Loaders

```bash
npm install --save-dev style-loader css-loader
```

#### Step 4: Build the React App

```bash
npx webpack --mode production
```

This creates `inject-react.js` in your root directory.

#### Step 5: Update manifest.json

Change line 42 in `web_accessible_resources`:

```json
"resources": [
  "inject-react.js",  // ← Change from "inject.js"
  "icon16.png",
  "icon32.png",
  "icon48.png",
  "icon128.png"
]
```

#### Step 6: Update content.js

Change line 5 to load the React build:

```javascript
script.src = chrome.runtime.getURL('inject-react.js');
```

#### Step 7: Reload Extension

1. Go to `chrome://extensions`
2. Click "Reload" on InboxAI
3. Open Gmail and try it out!

## 🔧 Development Workflow

### Watch Mode (Auto-rebuild on changes)

```bash
npx webpack --watch
```

### Production Build

```bash
npx webpack --mode production
```

## 📝 Architecture

```
React App Flow:
┌──────────────┐
│   App.js     │ User types query
└──────┬───────┘
       │ window.postMessage
       ▼
┌──────────────┐
│ content.js   │ Forwards to background
└──────┬───────┘
       │ chrome.runtime.sendMessage
       ▼
┌──────────────┐
│background.js │ Handles Gmail/Calendar/OpenAI
└──────┬───────┘
       │ sendResponse
       ▼
┌──────────────┐
│ content.js   │ Posts back to page
└──────┬───────┘
       │ window.postMessage
       ▼
┌──────────────┐
│   App.js     │ Displays results
└──────────────┘
```

## 🎨 UI Components

- **Status Messages**: Real-time feedback with color-coded alerts
- **Smart Input**: Detects query type and adjusts placeholder
- **Loading States**: Animated dots during API calls
- **Response Display**: Formatted text with proper line breaks

## 🔒 Security Features

- ✅ Secure postMessage with specific origin
- ✅ Proper chrome.runtime.lastError checking
- ✅ API key stored securely in chrome.storage
- ✅ Event listener cleanup to prevent memory leaks
- ✅ Timeout handling for failed requests

## 💡 Tips

1. **First time setup**: Click "Connect Google Account" in the popup to authorize
2. **API Key**: Set your OpenAI API key in the extension popup
3. **Natural language**: Just type naturally - the app detects intent automatically
4. **Date queries**: Use "tomorrow", "this week", "next week" for calendar searches
5. **Email search**: Use "from [name]" or "about [topic]" for best results

## 🐛 Troubleshooting

**React app not showing?**
- Make sure you ran `npx webpack`
- Check that `inject-react.js` exists in root directory
- Verify manifest.json points to `inject-react.js`
- Reload the extension

**"Missing API key" error?**
- Open extension popup
- Enter your OpenAI API key
- Click "Save Key"

**"Google Auth failed" error?**
- Click "Connect Google Account" in popup
- Make sure you're signed into Chrome with the account that has Gmail API enabled

## 📚 Next Steps

- Add more calendar features (edit/create events)
- Email composition assistant
- Summarization of multiple emails
- Integration with Google Tasks
- Custom search filters

---

**Both implementations (Vanilla JS and React) are production-ready with full feature parity!** Choose the one that fits your development workflow.
