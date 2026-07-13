# API Reference

## Construction

```js
const viewer = new PrutViewer(root, options);
```

`root` is an element or selector. Important options include:

- `manifest` or `manifestUrl` — inline data or an endpoint returning the manifest;
- `fileBaseUrl` — legacy fallback used only when a document has no view source;
- `transport` — credentials, authorization, headers, request resolver, and refresh callback;
- `dependencies` — third-party renderer assets such as PDF.js and ONLYOFFICE;
- `renderers` — instance-local renderer registrations;
- `plugins` — lifecycle plugins;
- `preloadAhead`, `pagePreloadAhead`, `threshold`, `rootMargin` — lazy-loading controls;
- `strings` — user-facing fallback labels;
- `logger` — host logging callback.

## Methods

```js
await viewer.init();
await viewer.load(manifestOrDocuments);
await viewer.loadDocument(indexOrId);
viewer.open(documentId);
viewer.scrollTo(documentId, { page: 4 });
viewer.getDocument(documentId);
viewer.getState();
await viewer.download(documentId);
viewer.setOptions(options);
await viewer.retry(documentId);
await viewer.reload(manifestUrl, fileBaseUrl);
await viewer.destroy();
```

## Manifest

```json
{
  "schema": "prut-viewer/1",
  "id": "collection-123",
  "documents": [
    {
      "id": "document-456",
      "title": "Example.pdf",
      "type": "pdf",
      "mime": "application/pdf",
      "ext": "pdf",
      "sources": {
        "view": {
          "url": "/documents/456/content",
          "request": { "auth": "session" }
        },
        "download": "/documents/456/download"
      },
      "capabilities": { "download": true },
      "metadata": {}
    }
  ]
}
```

The complete machine-readable contract is in `manifest.schema.json`.

## Transport

```js
const transport = new PrutViewerTransport({
    credentials: 'same-origin',
    authorization: async context => tokenStore.getAccessToken(),
    headers: context => ({ 'X-Viewer-Purpose': context.purpose }),
    resolveRequest: async context => null,
    refreshRequest: async context => null
});
```

`resolveRequest` can replace the URL or request options immediately before use. `refreshRequest` can return a replacement after an ordinary fetch receives an authorization failure. A request marked `auth: "signed"` retains its exact query string and does not receive the global bearer header.

## Renderer API

```js
class MarkdownRenderer {
    constructor(context) {
        this.viewer = context.viewer;
        this.slot = context.slot;
        this.document = context.document;
        this.options = context.options;
        this.transport = context.transport;
        this.signal = context.signal;
    }

    async render() {}
    async destroy() {}
}

PrutViewer.registerRenderer('markdown', MarkdownRenderer);
```

Use `viewer.registerRenderer()` for an instance-local registration. A renderer must use the supplied transport and must not implement or bypass the host's access policy.

## Plugins

```js
viewer.use({
    install(viewer) {},
    beforeInit(payload, viewer) {},
    afterManifest(payload, viewer) {},
    beforeRender(payload, viewer) {},
    afterRender(payload, viewer) {},
    onError(payload, viewer) {},
    beforeDestroy(payload, viewer) {},
    destroy(viewer) {}
});
```

Plugins must remove their listeners, observers, and third-party instances in `destroy()`.

## Child viewers and manager

```js
const child = viewer.createChild('comparison', secondaryRoot, childOptions);
await child.init();
viewer.getChild('comparison');
await viewer.destroyChild('comparison');

const manager = new PrutViewerManager();
manager.create('main', mainRoot, options);
manager.create('preview', previewRoot, previewOptions);
await manager.destroyAll();
```

## Events

Subscribe with `viewer.on(name, listener)` and remove with `viewer.off(name, listener)`. Equivalent DOM events use the `prutviewer:` prefix, including `manifest:loaded`, `document:loading`, `document:ready`, `document:error`, `page:ready`, `page:error`, `child:created`, and `child:destroyed`.
