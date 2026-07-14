(function () {
    'use strict';

    var container = document.querySelector('[data-viewer-demo]');
    var status = document.querySelector('[data-demo-role="status"]');
    var pdfJsBase = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174';
    var localFileMode = window.location.protocol === 'file:';
    var standalonePreviewMode = window.prutViewerDemoStandalone === true;
    var localDataMode = localFileMode || standalonePreviewMode;
    var rawPreviewBase = 'https://raw.githubusercontent.com/teraxis/PrutViewer/main/';
    var localObjectUrls = [];

    if (!container || typeof PrutViewer !== 'function') {
        if (status) status.textContent = 'PrutViewer could not be loaded.';
        return;
    }

    function sourceUrl(documentItem) {
        var source = documentItem.sources && documentItem.sources.view;
        var url = typeof source === 'string' ? source : source && source.url;
        if (standalonePreviewMode && url && !/^[a-z][a-z\d+.-]*:/i.test(url)) {
            return new URL(url.replace(/^\.\//, ''), rawPreviewBase).href;
        }
        return new URL(url, document.baseURI).href;
    }

    function createDocumentShell(context) {
        var wrapper = document.createElement('article');
        var header = document.createElement('header');
        var title = document.createElement('div');
        var body = document.createElement('div');

        wrapper.dataset.viewerRole = 'document';
        header.dataset.viewerRole = 'document-header';
        title.dataset.viewerRole = 'document-title';
        title.textContent = context.document.title;
        body.dataset.viewerRole = 'document-body';
        header.appendChild(title);
        wrapper.appendChild(header);
        wrapper.appendChild(body);
        context.slot.appendChild(wrapper);

        return { wrapper: wrapper, body: body };
    }

    function LocalMediaRenderer(context) {
        this.context = context;
        this.wrapper = null;
    }

    LocalMediaRenderer.prototype.render = function () {
        var shell = createDocumentShell(this.context);
        var mediaContainer = document.createElement('div');
        var media = document.createElement(this.context.document.type === 'audio' ? 'audio' : 'video');
        var source = document.createElement('source');

        mediaContainer.dataset.viewerRole = 'media-container';
        media.dataset.viewerRole = 'media-player';
        media.controls = true;
        media.preload = 'metadata';
        if (media.tagName === 'VIDEO') media.setAttribute('playsinline', '');
        source.src = sourceUrl(this.context.document);
        source.type = this.context.document.mime;
        media.appendChild(source);
        mediaContainer.appendChild(media);
        shell.body.appendChild(mediaContainer);
        this.wrapper = shell.wrapper;
    };

    LocalMediaRenderer.prototype.destroy = function () {
        if (this.wrapper) this.wrapper.remove();
        this.wrapper = null;
    };

    function pdfBlobUrl(base64) {
        var binary = window.atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
        }
        var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        localObjectUrls.push(url);
        return url;
    }

    function localDocuments() {
        return window.prutViewerDemoFiles.map(function (documentItem) {
            var item = JSON.parse(JSON.stringify(documentItem));
            if (item.type !== 'pdf') return item;

            var encoded = window.prutViewerDemoPdfData[item.id];
            if (!encoded) throw new Error('Embedded PDF fixture is missing: ' + item.id);
            var url = pdfBlobUrl(encoded);
            item.sources = {
                view: { url: url, request: { auth: 'none', credentials: 'omit' } },
                download: { url: url, request: { auth: 'none', credentials: 'omit' } }
            };
            return item;
        });
    }

    var options = {
        transport: {
            credentials: 'same-origin'
        },
        dependencies: {
            pdf: {
                core: pdfJsBase + '/build/pdf.js',
                worker: pdfJsBase + '/build/pdf.worker.js',
                viewer: pdfJsBase + '/web/pdf_viewer.js',
                viewerCss: pdfJsBase + '/web/pdf_viewer.css'
            }
        }
    };

    if (localDataMode) {
        if (!Array.isArray(window.prutViewerDemoFiles)
            || !window.prutViewerDemoPdfData
            || typeof window.prutViewerDemoPdfData !== 'object') {
            if (status) status.textContent = 'The local demonstration fixtures could not be loaded.';
            return;
        }
        // Direct file and standalone preview modes cannot rely on adjacent PDF fetches.
        // PDF fixtures are embedded as data and exposed as blob URLs to PDF.js.
        options.manifest = {
            schema: 'prut-viewer/1',
            id: 'prut-viewer-local-demo',
            documents: localDocuments()
        };
        options.renderers = {
            video: LocalMediaRenderer,
            audio: LocalMediaRenderer
        };
    } else {
        options.manifestUrl = './demo-manifest.json';
    }

    var viewer = new PrutViewer(container, options);

    viewer.on('state:change', function (event) {
        if (status) {
            status.textContent = 'Viewer state: ' + event.state
                + (localFileMode ? ' (local file mode)' : (standalonePreviewMode ? ' (standalone preview mode)' : ' (HTTP mode)'));
        }
    });
    viewer.on('document:error', function () {
        if (status) status.textContent = 'A document could not be rendered. Check the browser console and network policy.';
    });

    window.addEventListener('beforeunload', function () {
        localObjectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
        localObjectUrls = [];
    }, { once: true });

    window.prutViewerDemo = viewer;
    viewer.init().catch(function (error) {
        if (status) status.textContent = error && error.message ? error.message : String(error);
    });
}());
