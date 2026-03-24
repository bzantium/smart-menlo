<h1 align="center">
  <img src="assets/icon48.png" alt="Smart Menlo Logo" style="width: 32px; height: 32px;"> Smart Menlo
</h1>

<div align="center" style="line-height: 1.5;">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-brightgreen.svg">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-blue.svg">
  <a href="LICENSE" target="_blank"><img alt="License" src="https://img.shields.io/badge/License-MIT-lightgrey.svg"></a>
  <br>
  <a href="https://github.com/bzantium/smart-menlo" target="_blank"><img alt="GitHub Repo" src="https://img.shields.io/badge/View_Source-GitHub-181717?logo=github"></a>
</div>

<div align="center">
  <a href="https://www.readme-i18n.com/bzantium/smart-menlo?lang=en">English</a> |
  <a href="https://www.readme-i18n.com/bzantium/smart-menlo?lang=ko">한국어</a> |
  <a href="https://www.readme-i18n.com/bzantium/smart-menlo?lang=ja">日本語</a> |
  <a href="https://www.readme-i18n.com/bzantium/smart-menlo?lang=zh">中文</a>
</div>

---

### The Problem

Corporate environments using Menlo Security face different challenges depending on the VPN solution:

- **Global Protect**: VPN auto-redirects most sites through Menlo, but some URLs (e.g., `x.com`) are missed. There's no easy way to force those through Menlo, and switching between `prod`/`dev` modes requires navigating to an admin page.
- **Ivanti**: No automatic redirection — when a site is blocked, you manually copy the URL and open it through Menlo. Menlo links from colleagues require stripping the prefix to access the original site.

### The Solution: Smart Menlo 🚀

**Smart Menlo** is a Chrome extension that manages Menlo Security redirection based on your VPN setup. It supports two modes — **Global** and **Ivanti** — to handle different VPN environments automatically.

### 🚧 Development Status

This project is in active development. If you find an issue or have a suggestion, please [open an issue](https://github.com/bzantium/smart-menlo/issues)!

---

### Features

#### Global Mode (Automatic)

Designed for **Global Protect** VPN users.

- **VPN Status Detection**: Automatically detects whether the VPN is connected by checking the policy endpoint. Displays `VPN: On (prod/dev)` or `VPN: Off` in the popup.
- **prod/dev Mode Switching**: Switch between `prod` and `dev` VPN modes directly from the popup — no need to visit the admin page.
- **Session Timer**: Shows remaining VPN session time with a progress bar. If the native helper is installed, it reads the exact connection time from GlobalProtect logs; otherwise it estimates from when the extension first detects the connection.
- **Expiry Alert**: The toolbar icon dot blinks as the session nears expiry — slow blink at 1 hour, fast blink at 10 minutes.
- **Force List**: When the VPN is in `prod` mode, URLs in the force list are always routed through Menlo. This fills the gap for sites that the VPN auto-redirect misses.
- **Intelligent Link Handling**: Strips the Menlo prefix from URLs that are not in the force list, giving you direct access. When `prod` is off, all Menlo prefixes are stripped automatically.

#### Ivanti Mode (Manual)

Designed for **Ivanti** VPN users.

- **Manual On/Off Toggle**: Enable or disable Menlo redirection with a single switch.
- **Force List**: URLs in the force list are always routed through Menlo when the extension is enabled.
- **Automatic Fallback**: When a site connection fails, Smart Menlo automatically retries through Menlo Security.
- **Intelligent Link Handling**: Strips the Menlo prefix from non-forced URLs for direct access.

#### Shared Features

- **Force List Management**: Add, edit, and delete URL patterns. Toggle the force list on/off independently.
- **Open Current Page with Menlo**: One-click button to open the active tab through Menlo Security.
- **Multi-language Support**: English, 한국어, 日本語, 中文.

---

### Installation

1. Clone this repository:
    ```sh
    git clone https://github.com/bzantium/smart-menlo.git
    ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the cloned repository folder.
5. (Optional) Pin the extension to your toolbar for quick access.

#### Session Timer Setup (Optional, Global Mode only)

To get accurate VPN session remaining time, install the native helper:

```sh
cd smart-menlo
bash install.sh
```

This registers a lightweight script that reads the GlobalProtect event log to determine when the current VPN session started. It auto-detects your extension ID and installs for all detected Chromium-based browsers (Chrome, Arc, Chromium, Edge).

- **Without the helper**, the timer falls back to estimating from when the extension first detects the VPN connection.

---

### Force List Rules

| Rule Type | Example | Behavior |
| :--- | :--- | :--- |
| **Subdomain** (no `/`) | `notion.site` | Matches the domain and any subdomain.<br>`https://www.notion.site` → Redirects<br>`https://bzantium.notion.site` → Redirects |
| **Path** (contains `/`) | `huggingface.co/papers` | Matches URLs starting with that exact path.<br>`https://huggingface.co/papers/2305.12345` → Redirects<br>`https://huggingface.co/models` → Does not redirect |

---

### Architecture

```
smart-menlo/
├── manifest.json          # Chrome Extension Manifest V3 config
├── background.js          # Service worker entry point (dispatcher)
├── bg-shared.js           # Shared constants, state, URL matching, icon rendering
├── bg-global.js           # Global mode: VPN policy check, native host query
├── bg-ivanti.js           # Ivanti mode: navigation handler
├── popup.html             # Extension popup UI
├── popup.js               # Shared popup logic (i18n, force list, mode switching)
├── popup-global.js        # Global mode UI (VPN status, session timer)
├── popup-ivanti.js        # Ivanti mode UI (enable toggle)
├── style.css              # Popup styles
├── install.sh             # Native helper installer (session timer)
├── native/                # Native messaging host source
│   ├── com.smartmenlo.sessiond.py    # Python script (reads GP logs)
│   └── com.smartmenlo.sessiond.json  # Chrome native messaging manifest
├── _locales/              # Translations (en, ko, ja, zh)
└── assets/                # Extension icons
```

---

### Troubleshooting

- **Extension not working?** Refresh it from `chrome://extensions` or toggle the VPN APP mode.
- **VPN status stuck on "Switching"?** Refresh the extension — the switching state will reset automatically.
- **Force list not working in Global mode?** Ensure the VPN is in `prod` mode and the force list toggle is enabled.

---

### License

[MIT](LICENSE) © Minho Ryu
