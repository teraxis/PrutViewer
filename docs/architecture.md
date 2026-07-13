# Architecture

PrutViewer is an orchestration layer, not a storage client and not an authorization service. It turns a trusted manifest into viewer instances, selects a renderer for each document, and routes every network request through a configurable transport.

## Pipeline

1. The host creates `PrutViewer` with a DOM root and options.
2. `init()` loads an inline manifest or calls `manifestUrl` through `PrutViewerTransport`.
3. The manifest is normalized. Legacy `fileUrl`, `downloadUrl`, `configUrl`, and `pdfPreviewUrl` values become named sources.
4. The core builds a classless DOM tree. Stable behavior is exposed only through `data-viewer-*` attributes.
5. The renderer registry selects a built-in or host-supplied renderer.
6. The renderer resolves its source through the transport and performs lazy loading.
7. Lifecycle events are emitted through the JavaScript API and `prutviewer:*` DOM events.
8. `destroy()` aborts requests, disconnects observers, disposes renderers and plugins, revokes Blob URLs, and destroys child viewers.

## Responsibility boundary

The host application owns authentication, authorization, tenant scoping, object lookup, signed-URL generation, CORS policy, and streaming response headers. PrutViewer consumes the resulting URLs without weakening those controls.

For private object storage, prefer an authorized application streaming endpoint or a short-lived signed URL created after the server verifies access. Permanent S3 credentials must never enter the manifest or browser configuration.

## PDF.js

PDF.js is an optional child renderer dependency, not part of PrutViewer. The host supplies a mutually compatible `core`, `worker`, `viewer`, and `viewerCss` set through `dependencies.pdf`. The PDF.js viewer layer may create its own internal classes; those classes are not part of PrutViewer's public DOM contract.

## Extensibility

- Renderers own one document type and implement `render()` and `destroy()`.
- Plugins observe lifecycle hooks and may add host behavior.
- Child viewers are managed instances for comparison, preview, or split-screen use.
- `PrutViewerManager` coordinates multiple independent root viewers.
