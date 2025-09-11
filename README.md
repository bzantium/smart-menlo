# Smart Menlo

<p align="left">
  <img src="https://img.shields.io/badge/Chrome-Extension-brightgreen.svg" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Manifest-V3-blue.svg" alt="Manifest V3">
  <img src="https://img.shields.io/badge/License-MIT-lightgrey.svg" alt="License: MIT">
</p>

### The Problem

If you work in a corporate environment that uses Menlo Security, you're familiar with the routine: you try to visit a site, it gets blocked, and then you manually copy the URL to open it through Menlo. Furthermore, when you receive a Menlo link from a colleague, you can't access the original site directly without first stripping the prefix. These small hurdles disrupt your workflow and add up over time.

### The Solution: Smart Menlo 🚀

**Smart Menlo** is an intelligent assistant that automates your entire Menlo Security workflow. It eliminates the manual steps of copying, pasting, and editing URLs, allowing you to browse seamlessly. It works in the background to make your protected browsing experience faster and more efficient.

### Installation

1.  Clone this repository to your local machine:
    ```sh
    git clone https://github.com/bzantium/smart-menlo.git
    ```
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top-right corner.
4.  Click **Load unpacked** and select the cloned repository folder.

### How It Works

Smart Menlo has three core automatic behaviors designed to make your life easier.

#### 1\. Automatic Fallback on Error

This is the most fundamental feature. When you try to access a website and the connection fails with a network error, Smart Menlo instantly catches it and automatically re-opens the page through Menlo Security.

  * **Code Insight**: This is handled by the `handleError` function in `background.js`, which listens for web navigation errors like `net::ERR_CONNECTION_TIMED_OUT`.

#### 2\. Intelligent Link Handling

When you click a link that's already a Menlo URL (e.g., `https://safe.menlosecurity.com/https://github.com`), Smart Menlo performs a clever check:

1.  It first **strips the Menlo prefix** and tries to connect you directly to the original URL (`https://github.com`).
2.  If the direct connection succeeds, great\! You're on the original site.
3.  If the direct connection **fails**, Smart Menlo's "Automatic Fallback" feature kicks in and redirects you back to the secure Menlo Security version.

This ensures you always try the fastest, most direct route first without sacrificing security.

  * **Code Insight**: The prefix stripping happens in the `handleBeforeNavigate` function. This logic is skipped for URLs you've added to the Forced Redirection List.

#### 3\. The Forced Redirection List

This is the extension's most powerful feature, giving you full control. From the popup, you can add rules to ensure certain sites **always** open through Menlo Security, skipping any direct connection attempts. The matching is flexible, with two rule types:

  * **Code Insight**: The `isUrlForced` function in `background.js` checks if a URL pattern contains a `/`. This determines whether to use subdomain or path matching.

| Rule Type | Example Rule in List | Behavior |
| :--- | :--- | :--- |
| **Subdomain**<br>(No `/` in rule) | `notion.site` | Matches the domain and **any subdomain**.<br>- `https://www.notion.site` -> Redirects<br>- `https://bzantium.notion.site` -> Redirects |
| **Path**<br>(Contains `/` in rule) | `huggingface.co/papers` | Matches URLs that **start with** that exact path.<br>- `https://huggingface.co/papers/2305.12345` -> Redirects<br>- `https://huggingface.co/models` -> **Does Not** Redirect |

### Troubleshooting

If the extension doesn't seem to be working, try refreshing it from the `chrome://extensions` page or toggling it off and on again. This resolves most issues.