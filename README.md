# PrutViewer

PrutViewer is a framework-independent browser document viewer with pluggable renderers, authorized transports, lifecycle management, and child viewers.

It provides a classless DOM contract based on `data-viewer-*` attributes and supports session-protected application endpoints, bearer authorization, short-lived S3-compatible signed URLs, and custom transport resolvers.

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

## Development

```bash
npm install
npm test
```

Source files are intentionally readable. Minified assets are release artifacts and are not committed during development.

## License

[MIT](LICENSE) © 2026 teraxis
