# OpenHeader

A lightweight Chrome extension to modify HTTP request and response headers and filter requests by URL patterns.

## Features

- ✏️ **Modify Headers** — Add, remove, or override request and response headers
- 🔍 **URL Filtering** — Filter headers by URL patterns using regex or simple string matching
- 💾 **Persistent Storage** — Your rules are saved locally and survive browser restarts
- 🎨 **Clean Interface** — Simple, intuitive popup UI for managing headers
- ⚡ **Lightweight** — Minimal performance impact on browsing

## Installation

> **Note:** Chrome blocks `.crx` files not from the Web Store (`CRX_REQUIRED_PROOF_MISSING`), so installation requires loading the extension unpacked.

### Option 1: Download from Releases (Recommended)

1. Go to the [Releases page](../../releases) and download the latest `.zip`
2. Unzip the file
3. Open Chrome and navigate to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** and select the unzipped folder
6. The extension will appear in your toolbar immediately

### Option 2: Clone from Source

1. Clone this repository:

   ```bash
   git clone https://github.com/yourusername/openheader.git
   ```

2. Build the per-browser folders (requires [Node.js](https://nodejs.org)):

   ```bash
   npm run build          # builds both dist/chrome and dist/firefox
   # or target one browser:
   npm run build:chrome
   npm run build:firefox
   ```

3. **Chrome:** open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `dist/chrome`.
4. **Firefox:** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and select `dist/firefox/manifest.json`.

## Building for release

The extension supports both Chrome (MV3 service worker) and Firefox (MV3 background scripts) from a single source. `manifest.base.json` holds the shared config, and `build.js` injects the correct `background` block per browser:

```bash
npm run build          # -> dist/chrome, dist/firefox
npm run zip            # -> dist/openheader-chrome.zip, dist/openheader-firefox.zip
```

Why: Chrome only supports `background.service_worker` and warns on `background.scripts`, while Firefox only supports `background.scripts`. Generating separate manifests avoids the warning without maintaining two branches.

## Usage

### Basic Setup

1. Click the **OpenHeader** icon in your Chrome toolbar
2. Add a new header rule:
   - Enter a **URL pattern** (e.g., `api.example.com`, `.*\.github\.com.*`)
   - Enter the **header name** (e.g., `Authorization`, `X-Custom-Header`)
   - Enter the **header value**
   - Choose the type: **Request** or **Response**
3. Click **Add** to enable the rule
4. Rules are saved automatically

### URL Pattern Examples

- **Exact domain:** `example.com`
- **Any subdomain:** `.*\.example\.com`
- **All HTTPS:** `https://.*`
- **Specific path:** `api\.example\.com/v1/.*`

### Managing Rules

- **Enable/Disable** — Toggle the checkbox next to each rule
- **Delete** — Click the delete button to remove a rule
- **Edit** — Modify any rule in place

## Permissions

This extension requires:

- `storage` — To save your header rules locally
- `tabs` — To read the current tab URL
- `declarativeNetRequest` — To modify request headers
- `declarativeNetRequestWithHostAccess` — To modify response headers

**Your data is stored locally and never sent to external servers.**

## Troubleshooting

### Extension doesn't appear in toolbar

- Make sure Developer mode is enabled in `chrome://extensions`
- Try refreshing the extension (click the refresh icon)

### Headers not being modified

- Check that your URL pattern matches the target site
- Verify the rule is enabled (checkbox is checked)
- Some sites may have security policies preventing header modifications

## Support

Found a bug or have a feature request? [Open an issue](issues) on GitHub.

## License

MIT

---

**Note:** This is an unofficial clone inspired by the ModHeader extension created due to its increasing number of ads. See the original [ModHeader](https://modheader.com) for more information.
