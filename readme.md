# Bridge Translate

Instant translation while typing. All processing is local in the browser using Chrome’s built-in APIs.

## Features

- Translate text directly where you type;
- Local-only processing; no external servers;
- Preferences and optional local history stored in `chrome.storage`;
- Offscreen work to keep pages responsive.

## How It Works

- A content script observes editable fields and enables on-demand translation;
- An offscreen page handles work without blocking the UI;
- No network requests are made for translation.

## Install (Developer Mode)

1. Download and extract the release;
2. Open `chrome://extensions` and enable **Developer mode**;
3. Click **Load unpacked** and select the folder containing `manifest.json`.

## Permissions

- `storage`: save preferences and optional local history;
- `offscreen`: background work without blocking the page;
- Host permissions (e.g., `<all_urls>`): detect inputs on pages. Browsing history is not collected.

## Privacy & Terms

All processing happens locally. See [`privacy.md`](./privacy.md) & [`terms.md`](./terms.md).

## License

MIT License. See [`license`](./license).
