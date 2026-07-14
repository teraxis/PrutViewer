# Demonstrations

The repository contains two demonstrations built from the same sample collection:

- `demo.html` supports both direct `file://` opening and HTTP mode;
- `demo.php` scans `tests/pdf` and `docs/images`, exposes its own manifest endpoint, and streams the selected file.

The [demonstration video](images/F74i7CSqVV.mp4) is a 43.9-second H.264 MP4 recording at 2560 × 1346. It has no audio track and uses the browser-native `video` renderer.

## Static HTML demonstration

### Direct opening without a server

Double-click `demo.html`, or open it from the browser's file picker. The page detects `file://` automatically and displays all sample PDFs plus the demonstration video. PDF fixtures are embedded in `demo-pdf-data.js`, converted to `blob:` URLs, and passed to the normal PDF.js renderer. This avoids browser PDF download dialogs and does not navigate iframes to local PDF files.

This mode intentionally does not add `file:` to PrutViewer's transport allowlist. Browsers do not permit normal `fetch()` access to adjacent local files, and allowing `file:` in the production transport would weaken its URL boundary. PDF.js is loaded from the configured CDN, so an internet connection is required unless those dependency files are hosted locally and their URLs are changed in `demo.js`.

Direct mode is useful for a zero-setup preview, but it does not demonstrate:

- JSON manifest fetching;
- cookies, bearer headers, CORS, signed URLs, or refresh callbacks;
- HTTP Range streaming and backend authorization.

The generated Base64 fixture duplicates the PDF bytes and is intentionally limited to demonstration use. When the manifest or a sample PDF changes, regenerate both the local catalog and embedded data with `npm run build:demo-data`.

## Scrollable viewport

The demo root uses `data-viewer-demo`, `tabindex="0"`, and a bounded height. Its own vertical scrollbar contains the complete document sequence, so the surrounding product page does not grow to the combined height of every PDF page. Document headers stay visible while their document is being scrolled. Hosts can choose another height or remove the demo-specific viewport styles without changing PrutViewer's core DOM contract.

## GitHub Pages

The GitHub repository file URL (`https://github.com/teraxis/PrutViewer/blob/main/demo.html`) displays the source file inside GitHub. It does not execute the demo as an HTML application.

Use the GitHub Pages URL for a browser-run demo:

```text
https://teraxis.github.io/PrutViewer/demo.html
```

The Pages workflow publishes the static demo files, generated local PDF catalog, generated PDF data, sample PDFs, and demonstration video from `main`.

### Full HTTP demonstration

Start any static HTTP server in the project root. For example:

```bash
php -S 127.0.0.1:8080
```

Open `http://127.0.0.1:8080/demo.html`. In this mode the page fetches `demo-manifest.json` and uses the normal PrutViewer PDF.js renderer.

The HTTP example supplies PDF.js 3.11.174 as an optional PDF renderer dependency. Its source URLs are centralized in `demo.js`; PrutViewer does not bundle or silently select a PDF.js version.

For an offline or strict-CSP deployment, download one compatible PDF.js distribution, host these four assets on the same site, and replace the URLs in the configuration:

- `build/pdf.js`;
- `build/pdf.worker.js`;
- `web/pdf_viewer.js`;
- `web/pdf_viewer.css`.

## Standalone PHP demonstration

Place `demo.php` beside `script.js`, `style.css`, `demo.css`, `tests/pdf`, and `docs/images`, then open it through a PHP-capable web server. The script needs no framework, database, Composer package, or rewrite rule.

It handles three requests:

- `demo.php` — renders the demonstration page;
- `demo.php?action=manifest` — returns a PrutViewer manifest;
- `demo.php?action=file&id=...` — streams a whitelisted file and supports a single HTTP byte range.

The example is intentionally open. In a real application, replace `authorize_demo_request()` with the session, bearer-token, ACL, or signed-link check used by the host application. Perform that check for both the manifest and file actions. Never accept a client-supplied filesystem path.

The file endpoint is compatible with cookie-protected same-origin access. PrutViewer sends `credentials: "same-origin"`, and the PHP response keeps the file behind the application endpoint instead of exposing an object-storage path.

## Sample rights

The PDF manifest records each publisher, source URL, and rights note. Public availability is not the same as public-domain status. Review the source publication terms before redistributing the sample files outside this repository.
