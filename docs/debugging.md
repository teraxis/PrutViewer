# Debugging

Run `npm run dev`, open `http://127.0.0.1:4173/tests/browser-smoke.html`, and inspect the browser console, network requests, and `data-viewer-state` attributes.

For transport failures, log the resolved request context without recording tokens or complete signed URLs. Check credentials mode, CORS, cookie policy, response status, Range headers, and signed-URL expiry.

For renderer failures, subscribe to `document:error` and `page:error`, verify that all third-party dependency files use the same upstream version, and call `await viewer.destroy()` before replacing the root DOM.
