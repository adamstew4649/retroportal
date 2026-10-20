# RetroPortal browser extension

The extension replaces the browser's new-tab page with RetroPortal. It uses the same React build as the website and runs the interface locally from files inside the extension.

## Build

From the project root:

```bash
npm ci
npm run build:extension
```

The ready-to-load extension is written to `extension/dist/`. The packaging script copies the production `dist/` build, adds `manifest.json` and the options page, verifies required assets and the Manifest V3 configuration, and writes `INSTALL.txt`.

`extension/dist/` is generated output and is ignored by Git. The source manifest and options page live in `extension/`.

## Install in Chrome or another Chromium browser

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Choose **Load unpacked**.
4. Select the generated `extension/dist/` folder — the folder that contains `manifest.json`.
5. Open a new tab.

Equivalent extension pages:

- Microsoft Edge: `edge://extensions`
- Brave: `brave://extensions`
- Vivaldi: `vivaldi://extensions`
- Opera: `opera://extensions` (enable developer mode first)

Open the extension's **Details → Extension options** page to configure it. You can also right-click the toolbar icon and choose **Options**.

## Modes

### Bundled local mode (default)

- Loads `index.html` and all assets from inside the extension.
- No GitHub Pages request is needed to render the interface.
- Local widgets, notes, tasks, bookmarks and settings work offline.
- Weather and refreshed news still require an internet connection.
- Interface updates arrive when you install a new build of the extension.
- Preferences live in the extension's own browser storage origin.

### Hosted mode

- The new-tab page redirects to a configured GitHub Pages URL.
- Interface and news updates appear as soon as the site deploys.
- Requires an internet connection and is not available offline.
- Preferences live in the website's origin storage, separate from bundled mode.
- The URL must use HTTPS, except for `http://localhost` / `127.0.0.1` during development.

Both modes are stored with `chrome.storage.local`. The extension does not inject scripts into the hosted site, does not read browsing history, and requests only the `storage` permission.

## Updating

After changing the app:

```bash
npm run build:extension
```

Then return to `chrome://extensions` and click **Reload** on the RetroPortal card. Close and reopen any existing new-tab pages.

Chrome does not auto-update unpacked extensions. To distribute an update, provide a new build and repeat the load/reload step, or publish through the Chrome Web Store with its normal update mechanism.

## Removing

1. Open `chrome://extensions`.
2. Click **Remove** on RetroPortal.
3. Confirm.

Removing the extension deletes its bundled-mode storage. Export a backup first from **Settings → Backup & data** if you want to keep your data. Hosted-mode data remains in the website's browser storage until you clear site data.

## Security and permissions

- Manifest V3 with a new-tab override (`chrome_url_overrides.newtab`).
- Only the `storage` permission.
- No content scripts, host permissions or browsing-history access.
- External JavaScript is not allowed by the extension CSP; `options.js` is a separate file, not inline code.
- URLs entered in the options page are parsed with `new URL` and restricted to HTTPS (or localhost HTTP).
- Feed/article HTML is rendered as plain text, and imported data is validated.

See `extension/manifest.json` for the complete manifest and CSP.

## Firefox

Firefox is not the primary target for this build. Mozilla's Manifest V3 support and new-tab override behaviour differ from Chromium, and this project is packaged and tested for Chromium browsers. The shared React app is browser-agnostic, but shipping a Firefox build would require separate manifest validation and testing. It is not claimed as supported here.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| “Manifest file is missing or unreadable” | Select the folder containing `manifest.json` (`extension/dist`), not `extension/` or the project root. |
| New tab unchanged | Disable other new-tab extensions and confirm RetroPortal is enabled. Reopen the tab. |
| Blank page | Rebuild with `npm run build:extension`; confirm `extension/dist/index.html` and `extension/dist/assets/` exist. |
| News or weather unavailable | These need a connection. Local widgets still work. |
| Hosted mode does not redirect | Check the URL in Options, save again, and reopen a new tab. Only HTTPS and localhost HTTP are accepted. |
| Data disappeared after switching modes | Modes use different storage origins. Export a backup from the old mode and import it in the new one. |
| Extension blocked by policy | Managed browsers may forbid unpacked extensions. Use a development profile or the Chrome Web Store distribution path. |
