# PrutViewer

PrutViewer is a framework-independent browser document viewer with pluggable renderers, authorized transports, lifecycle management, and child viewers.

It provides a classless DOM contract based on `data-viewer-*` attributes and supports session-protected application endpoints, bearer authorization, short-lived S3-compatible signed URLs, and custom transport resolvers.

## Live demo

[Open the PrutViewer browser demo](https://htmlpreview.github.io/?https://github.com/teraxis/PrutViewer/blob/main/demo.preview.html).

<video controls muted playsinline width="100%" src="https://raw.githubusercontent.com/teraxis/PrutViewer/main/docs/images/F74i7CSqVV.mp4">
  <a href="https://github.com/teraxis/PrutViewer/blob/main/docs/images/F74i7CSqVV.mp4">Watch the PrutViewer demonstration video</a>
</video>

The demo video is 43.9 seconds, H.264 MP4, no audio.

## Dependencies by file type

| File type | Built-in renderer | Runtime dependency | Server requirements |
| --- | --- | --- | --- |
| PDF | `pdf` | A mutually compatible PDF.js `core`, `worker`, `viewer`, and `viewerCss` set. The demo uses PDF.js 3.11.174. | Correct PDF MIME type; HTTP Range support is recommended for large files. |
| Images | `image` | Browser-native image support. | A browser-supported format and a permitted same-origin, CORS, or signed URL. |
| Video | `video` | Browser-native HTML video support. | A browser-supported container/codec; HTTP Range support is strongly recommended. |
| Audio | `audio` | Browser-native HTML audio support. | A browser-supported container/codec; HTTP Range support is strongly recommended. |
| Plain text | `text` | The browser Fetch API. | Text must be fetchable under the configured credentials and CORS policy. |
| Office documents | `office` | ONLYOFFICE Document Server JavaScript API and a server-generated editor configuration. | Publicly reachable or authorized document/callback endpoints required by ONLYOFFICE. |
| Other files | `download` | None. | A view or download URL; the browser downloads or opens the file externally. |

PrutViewer itself has no Bootstrap, jQuery, React, Vue, Angular, Pentry, or site-template dependency. Rendering requires a modern browser DOM. Node.js is supported as a package and bundling environment, not as a headless rendering engine.

## Install

### Browser

```html
<link rel="stylesheet" href="/vendor/prut-viewer/style.css">
<script src="/vendor/prut-viewer/script.js"></script>

<div id="documents"></div>
<script>
const viewer = new PrutViewer('#documents', {
    manifestUrl: '/api/documents/manifest',
    transport: { credentials: 'same-origin' }
});

viewer.init();
</script>
```

### ESM or a Node.js bundler

```js
import PrutViewer, {
    PrutViewerManager,
    PrutViewerTransport
} from 'prut-viewer';
```

The package can be bundled in Node.js projects, but rendering requires a browser DOM.

## Authorized sources

PrutViewer never bypasses server authorization. A protected application endpoint can use browser session cookies:

```js
transport: { credentials: 'same-origin' }
```

A host application can supply a bearer token without embedding it in the manifest:

```js
transport: {
    authorization: () => tokenStore.getAccessToken()
}
```

For a short-lived S3-compatible signed URL, mark the request as signed. PrutViewer preserves the query string and does not add the global authorization header:

```json
{
  "sources": {
    "view": {
      "url": "https://s3.example.test/bucket/object?X-Amz-Signature=...",
      "request": { "auth": "signed", "credentials": "omit" }
    }
  }
}
```

See [the architecture guide](docs/architecture.md) and [API reference](docs/api.md) for the manifest, transport, renderer, plugin, and child-viewer contracts.

## Local demonstrations

- [`demo.html`](demo.html) can be opened directly from disk or served over HTTP. [`demo.preview.html`](demo.preview.html) is the standalone browser-preview entry for GitHub HTML preview services. Direct `file://` mode passes all sample PDFs to PDF.js through generated `blob:` URLs; HTTP mode loads the complete [`demo-manifest.json`](demo-manifest.json). Both modes use a bounded, keyboard-focusable viewport with internal scrolling.
- [`demo.php`](demo.php) discovers the files in `tests/pdf` and `docs/images`, creates the manifest endpoint, and streams authorized file responses with HTTP Range support.

For a zero-setup preview, double-click `demo.html`. To exercise the real manifest, transport, PDF.js, and streaming path, serve the repository over HTTP:

```bash
php -S 127.0.0.1:8080
```

Then open `http://127.0.0.1:8080/demo.html` or `http://127.0.0.1:8080/demo.php`. GitHub Pages can also host `demo.html` after Pages is enabled for the repository and the manual Pages workflow is run. See [the demo guide](docs/demo.md) for the `file://` limitations, browser preview, local PDF.js hosting, and PHP authorization notes.

The sample PDFs retain the rights stated by their publishers. See [`tests/pdf/manifest.csv`](tests/pdf/manifest.csv) before copying or redistributing them.

## Development

```bash
npm install
npm test
```

Source files are intentionally readable. Minified assets are release artifacts and are not committed during development.

## License

[MIT](LICENSE) © 2026 Bilyk Ihor
