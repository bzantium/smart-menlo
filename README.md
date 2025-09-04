# Smart Menlo

Smart Menlo is a Chrome extension that automatically redirects failed site connections to the Menlo Security URL.

## What is Menlo Security?

Menlo Security is a cloud-based security platform that protects organizations from cyberattacks by isolating web and email traffic in a secure, remote browser. This prevents malware and other threats from reaching the end user's device. When a user tries to access a website that is blocked or deemed unsafe, Menlo Security will intercept the request and display a safe, rendered version of the page to the user.

## Who is this for?

This extension is for users who frequently encounter blocked websites due to their organization's security policies and use Menlo Security to access them. By automating the redirection process, Smart Menlo saves users time and improves their browsing experience.

## How it works

When you try to access a website and the connection fails, Smart Menlo will automatically redirect you to the Menlo Security version of the site. The extension listens for web navigation errors and, upon detecting a failure, prepends the Menlo Security prefix to the URL and reloads the page.

The extension also provides a simple toggle switch in the popup to enable or disable the automatic redirection feature.

## Installation

1.  Clone this repository:
    ```
    git clone https://github.com/bzantium/smart-menlo.git
    ```
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" in the top right corner.
4.  Click "Load unpacked" and select the cloned repository folder.
