# Integration Guide

## Browser script

```html
<link rel="stylesheet" href="/vendor/prut-viewer/style.css">
<script src="/vendor/prut-viewer/script.js"></script>
<div data-viewer-auto data-viewer-manifest="/documents/manifest"></div>
```

Auto-init recognizes `data-viewer-auto` or `data-viewer="auto"`, plus `data-viewer-manifest`, `data-viewer-file-base`, and JSON in `data-viewer-options`.

## JavaScript configuration

```js
const viewer = new PrutViewer('#viewer', {
    manifestUrl: '/documents/manifest',
    transport: { credentials: 'same-origin' },
    preloadAhead: 2
});

await viewer.init();
```

## ESM and bundlers

```js
import PrutViewer, {
    PrutViewerManager,
    PrutViewerTransport
} from 'prut-viewer';
import 'prut-viewer/style.css';
```

Node.js can install and bundle the package. Rendering itself requires a browser DOM and canvas implementation.

## Cookie-protected endpoint

For same-origin application streaming, use `credentials: "same-origin"`. For a deliberate cross-origin cookie gateway, use `credentials: "include"` and configure exact CORS origins, `Access-Control-Allow-Credentials`, and compatible `SameSite`/`Secure` cookies on the server.

## Bearer authorization

Provide a function so the current token is resolved at request time. Do not put bearer tokens in manifests or `data-viewer-*` attributes.

## Signed object-storage URLs

Mark signed sources with `request.auth = "signed"` and normally `credentials = "omit"`. The host should create short-lived URLs only after checking the user's rights. PrutViewer will not append a bearer header or rewrite the signed query string.

If a URL can expire while a page is open, use `resolveRequest` to refresh it before a renderer starts. Ordinary fetch-based renderers can also use `refreshRequest` for one retry after a 401 or 403.

## Styling contract

The optional theme targets `data-viewer-role` and other `data-viewer-*` attributes. The JavaScript core neither requires nor creates host CSS classes. A host may replace the theme completely without changing core behavior.

## Content security

Treat manifests as trusted application output. Restrict allowed origins and protocols, never expose storage secrets, and use CSP/SRI configuration for third-party renderer scripts. Streaming endpoints should return correct content type and disposition, `X-Content-Type-Options: nosniff`, private caching rules, and Range support for large media.

## Runnable examples

See [the demonstration guide](demo.md) for a static manifest example, a framework-free PHP manifest/file gateway, the sample video, and local PDF.js hosting instructions.
