/**
 * PrutViewer 0.1.0
 * Headless document-viewer driver with pluggable renderers and transports.
 */
(function (root, factory) {
    'use strict';

    var api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.PrutViewer = api.PrutViewer;
    root.PrutViewerManager = api.PrutViewerManager;
    root.PrutViewerTransport = api.PrutViewerTransport;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    var VERSION = '0.1.0';
    var assetPromises = new Map();
    var objectSequence = 0;
    var autoInstances = new WeakMap();

    var DEFAULT_STRINGS = {
        loading: 'Loading documents…',
        empty: 'No documents',
        error: 'Error loading document list',
        scrollHint: 'scroll to load',
        docLabel: 'Document',
        pdfError: 'PDF load error',
        pageError: 'Page {page}: render error',
        textLoading: 'Loading…',
        textError: 'Error loading text',
        officeLoading: 'Loading document…',
        officeError: 'Office preview is unavailable',
        fallbackHint: 'Browser preview is not available for this file type',
        fallbackBtn: 'Download'
    };

    function isObject(value) {
        if (value === null || Object.prototype.toString.call(value) !== '[object Object]') return false;
        var prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    function mergeObjects() {
        var result = {};
        for (var i = 0; i < arguments.length; i++) {
            var source = arguments[i];
            if (!isObject(source)) continue;
            Object.keys(source).forEach(function (key) {
                if (isObject(source[key]) && isObject(result[key])) {
                    result[key] = mergeObjects(result[key], source[key]);
                } else if (isObject(source[key])) {
                    result[key] = mergeObjects(source[key]);
                } else if (Array.isArray(source[key])) {
                    result[key] = source[key].slice();
                } else {
                    result[key] = source[key];
                }
            });
        }
        return result;
    }

    function resolveValue(value, context) {
        try {
            return Promise.resolve(typeof value === 'function' ? value(context) : value);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    function normalizeHeaders(value) {
        if (!value) return {};
        if (typeof Headers !== 'undefined' && value instanceof Headers) {
            var result = {};
            value.forEach(function (headerValue, headerName) { result[headerName] = headerValue; });
            return result;
        }
        return isObject(value) ? mergeObjects(value) : {};
    }

    function validateUrl(url, allowedProtocols) {
        if (!url) return '';
        var resolved = new URL(String(url), document.baseURI);
        if (allowedProtocols.indexOf(resolved.protocol) === -1) {
            throw new Error('PrutViewer URL protocol is not allowed: ' + resolved.protocol);
        }
        return String(url);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function cssEscape(value) {
        if (root.CSS && typeof root.CSS.escape === 'function') {
            return root.CSS.escape(String(value));
        }
        return String(value).replace(/[^a-zA-Z0-9_-]/g, function (character) {
            return '\\' + character.codePointAt(0).toString(16) + ' ';
        });
    }

    function createElement(tag, attributes, text) {
        var element = document.createElement(tag);
        Object.keys(attributes || {}).forEach(function (name) {
            var value = attributes[name];
            if (value === null || typeof value === 'undefined') return;
            if (name === 'dataset') {
                Object.keys(value).forEach(function (key) {
                    element.dataset[key] = String(value[key]);
                });
            } else if (name in element && name !== 'style') {
                element[name] = value;
            } else {
                element.setAttribute(name, String(value));
            }
        });
        if (typeof text !== 'undefined') element.textContent = text;
        return element;
    }

    function sourceDefinition(documentItem, purpose) {
        var sources = documentItem && documentItem.sources;
        var source = sources && sources[purpose];
        if (typeof source === 'string') return { url: source };
        if (isObject(source)) return mergeObjects(source);

        var legacyFields = {
            view: ['fileUrl', 'viewUrl'],
            download: ['downloadUrl', 'fileUrl'],
            config: ['configUrl'],
            preview: ['pdfPreviewUrl', 'previewUrl']
        };
        var fields = legacyFields[purpose] || [];
        for (var i = 0; i < fields.length; i++) {
            if (documentItem && documentItem[fields[i]]) {
                return { url: documentItem[fields[i]] };
            }
        }
        return { url: '' };
    }

    function normalizeDocument(documentItem, index, options) {
        var documentCopy = mergeObjects(documentItem || {});
        documentCopy.id = String(documentCopy.id == null ? index : documentCopy.id);
        documentCopy.index = index;
        documentCopy.title = documentCopy.title || documentCopy.name || documentCopy.id;
        documentCopy.type = String(documentCopy.type || 'download').toLowerCase();
        documentCopy.ext = documentCopy.ext || documentCopy.extension || '';
        documentCopy.mime = documentCopy.mime || documentCopy.mimeType || '';

        if (!sourceDefinition(documentCopy, 'view').url && options.fileBaseUrl) {
            var separator = options.fileBaseUrl.indexOf('?') >= 0 ? '&' : '?';
            documentCopy.fileUrl = options.fileBaseUrl + separator + 'doc_id=' + encodeURIComponent(documentCopy.id);
        }

        return documentCopy;
    }

    function assetElement(type, url) {
        var collection = type === 'script' ? document.scripts : document.styleSheets;
        for (var i = 0; i < collection.length; i++) {
            var node = type === 'script' ? collection[i] : collection[i].ownerNode;
            if (node && node.dataset && node.dataset.viewerAsset === url) return node;
        }
        return null;
    }

    function loadAsset(type, url, attributes) {
        if (!url) return Promise.reject(new Error('PrutViewer dependency URL is empty'));
        var key = type + ':' + url;
        if (assetPromises.has(key)) return assetPromises.get(key);

        var promise = new Promise(function (resolve, reject) {
            var existing = assetElement(type, url);
            if (existing && existing.dataset.viewerAssetLoaded === 'true') {
                resolve(existing);
                return;
            }

            var element = existing || document.createElement(type === 'script' ? 'script' : 'link');
            if (type === 'script') {
                element.src = url;
                element.async = true;
            } else {
                element.rel = 'stylesheet';
                element.href = url;
            }
            element.dataset.viewerAsset = url;

            Object.keys(attributes || {}).forEach(function (name) {
                if (attributes[name] != null && attributes[name] !== '') {
                    element.setAttribute(name, attributes[name]);
                }
            });

            element.addEventListener('load', function () {
                element.dataset.viewerAssetLoaded = 'true';
                resolve(element);
            }, { once: true });
            element.addEventListener('error', function () {
                assetPromises.delete(key);
                reject(new Error('PrutViewer failed to load dependency: ' + url));
            }, { once: true });

            if (!existing) document.head.appendChild(element);
        });

        assetPromises.set(key, promise);
        return promise;
    }

    /**
     * Resolves and performs authorized requests without modifying signed URLs.
     */
    function PrutViewerTransport(options) {
        this.options = mergeObjects({
            credentials: 'same-origin',
            headers: {},
            cache: 'default',
            mode: 'cors',
            redirect: 'follow',
            allowedProtocols: ['http:', 'https:', 'blob:'],
            authorization: null,
            resolveRequest: null,
            refreshRequest: null
        }, options || {});
    }

    PrutViewerTransport.prototype._sourceOptions = function (context) {
        var definition = sourceDefinition(context.document || {}, context.purpose || 'view');
        return mergeObjects(definition.request || {}, context.request || {});
    };

    PrutViewerTransport.prototype.resolve = async function (url, context) {
        context = mergeObjects(context || {}, { url: url });
        var sourceOptions = this._sourceOptions(context);
        var signed = sourceOptions.auth === 'signed' || sourceOptions.signed === true;
        var globalHeaders = signed ? {} : normalizeHeaders(await resolveValue(this.options.headers, context));
        var sourceHeaders = normalizeHeaders(await resolveValue(sourceOptions.headers, context));
        var headers = mergeObjects(globalHeaders, sourceHeaders);

        if (!signed && this.options.authorization) {
            var authorization = await resolveValue(this.options.authorization, context);
            if (authorization && !headers.Authorization && !headers.authorization) {
                headers.Authorization = /^\S+\s/.test(String(authorization))
                    ? String(authorization)
                    : 'Bearer ' + String(authorization);
            }
        }

        var resolved = {
            url: validateUrl(url, this.options.allowedProtocols),
            init: {
                method: context.method || 'GET',
                credentials: sourceOptions.credentials || this.options.credentials,
                headers: headers,
                cache: sourceOptions.cache || this.options.cache,
                mode: sourceOptions.mode || this.options.mode,
                redirect: sourceOptions.redirect || this.options.redirect,
                signal: context.signal
            },
            signed: signed
        };

        if (typeof this.options.resolveRequest === 'function') {
            var override = await this.options.resolveRequest(mergeObjects(context, resolved));
            if (typeof override === 'string') {
                resolved.url = validateUrl(override, this.options.allowedProtocols);
            } else if (isObject(override)) {
                resolved.url = validateUrl(override.url || resolved.url, this.options.allowedProtocols);
                resolved.init = mergeObjects(resolved.init, override.init || override.request || {});
            }
        }

        return resolved;
    };

    PrutViewerTransport.prototype.fetch = async function (url, context) {
        context = context || {};
        var resolved = await this.resolve(url, context);
        var response = await fetch(resolved.url, resolved.init);

        if ((response.status === 401 || response.status === 403)
            && typeof this.options.refreshRequest === 'function'
            && !context.refreshed) {
            var refreshed = await this.options.refreshRequest(mergeObjects(context, {
                url: resolved.url,
                response: response
            }));
            if (refreshed) {
                var retryUrl = typeof refreshed === 'string' ? refreshed : (refreshed.url || url);
                var retryContext = mergeObjects(context, {
                    refreshed: true,
                    request: isObject(refreshed) ? (refreshed.request || refreshed.init || {}) : {}
                });
                return this.fetch(retryUrl, retryContext);
            }
        }

        return response;
    };

    PrutViewerTransport.prototype.json = async function (url, context) {
        var response = await this.fetch(url, context);
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
        return response.json();
    };

    PrutViewerTransport.prototype.text = async function (url, context) {
        var response = await this.fetch(url, context);
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
        return response.text();
    };

    PrutViewerTransport.prototype.blob = async function (url, context) {
        var response = await this.fetch(url, context);
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
        return response.blob();
    };

    PrutViewerTransport.prototype.pdfSource = async function (documentItem, context) {
        var definition = sourceDefinition(documentItem, 'view');
        var resolved = await this.resolve(definition.url, mergeObjects(context || {}, {
            document: documentItem,
            purpose: 'view'
        }));
        return {
            url: resolved.url,
            httpHeaders: resolved.init.headers || {},
            withCredentials: resolved.init.credentials === 'include'
        };
    };

    PrutViewerTransport.prototype.directSource = async function (documentItem, purpose, context) {
        var definition = sourceDefinition(documentItem, purpose);
        return this.resolve(definition.url, mergeObjects(context || {}, {
            document: documentItem,
            purpose: purpose
        }));
    };

    function BaseRenderer(context) {
        this.context = context;
        this.viewer = context.viewer;
        this.slot = context.slot;
        this.document = context.document;
        this.options = context.options;
        this.transport = context.transport;
        this.signal = context.signal;
        this.wrapper = null;
        this.objectUrls = [];
    }

    BaseRenderer.prototype.string = function (key) {
        return this.viewer.string(key);
    };

    BaseRenderer.prototype.createWrapper = function () {
        var wrapper = createElement('section', {
            dataset: {
                viewerRole: 'document',
                viewerDocumentId: this.document.id,
                viewerRenderer: this.document.type,
                viewerState: 'ready'
            }
        });
        var header = createElement('header', {
            dataset: { viewerRole: 'document-header' }
        });
        header.appendChild(createElement('span', {
            dataset: { viewerRole: 'document-index' }
        }, this.string('docLabel') + ' ' + (this.document.index + 1)));
        header.appendChild(createElement('span', {
            dataset: {
                viewerRole: 'document-title',
                viewerUnread: this.document.is_unread ? 'true' : 'false'
            }
        }, this.document.title));

        if (this.document.document_number) {
            header.appendChild(createElement('span', {
                dataset: { viewerRole: 'metadata-separator' }
            }, '|'));
            header.appendChild(createElement('span', {
                dataset: { viewerRole: 'metadata-item', viewerField: 'document-number' }
            }, this.document.document_number));
        }
        if (this.document.document_date) {
            header.appendChild(createElement('span', {
                dataset: { viewerRole: 'metadata-separator' }
            }, '|'));
            header.appendChild(createElement('span', {
                dataset: { viewerRole: 'metadata-item', viewerField: 'document-date' }
            }, this.document.document_date));
        }

        wrapper.appendChild(header);
        this.slot.appendChild(wrapper);
        this.wrapper = wrapper;
        return wrapper;
    };

    BaseRenderer.prototype.showError = function (message) {
        if (!this.wrapper) this.createWrapper();
        this.wrapper.dataset.viewerState = 'error';
        var error = createElement('div', {
            dataset: { viewerRole: 'renderer-error' },
            role: 'alert'
        }, message);
        this.wrapper.appendChild(error);
    };

    BaseRenderer.prototype.render = function () {
        return Promise.resolve();
    };

    BaseRenderer.prototype.destroy = function () {
        this.objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
        this.objectUrls = [];
    };

    function PdfRenderer(context) {
        BaseRenderer.call(this, context);
        this.pdfDocument = null;
        this.loadingTask = null;
        this.eventBus = null;
        this.pageViews = new Map();
        this.resizeObservers = new Set();
        this.pageElements = new Set();
    }
    PdfRenderer.prototype = Object.create(BaseRenderer.prototype);
    PdfRenderer.prototype.constructor = PdfRenderer;

    PdfRenderer.prototype.dependencies = function () {
        var pdf = mergeObjects(this.options.dependencies && this.options.dependencies.pdf || {});
        pdf.core = pdf.core || this.options.pdfJsSrc || '';
        pdf.worker = pdf.worker || this.options.pdfJsWorker || '';
        pdf.viewer = pdf.viewer || pdf.core.replace(/pdf(?:\.min)?\.js(?:\?.*)?$/, 'pdf_viewer.js');
        pdf.viewerCss = pdf.viewerCss || pdf.core.replace(/pdf(?:\.min)?\.js(?:\?.*)?$/, 'pdf_viewer.css');
        return pdf;
    };

    PdfRenderer.prototype.render = async function () {
        var dependencies = this.dependencies();
        var wrapper = this.createWrapper();
        var pages = createElement('div', {
            dataset: { viewerRole: 'pdf-pages' }
        });
        var placeholder = createElement('div', {
            dataset: { viewerRole: 'pdf-page', viewerState: 'placeholder' }
        });
        pages.appendChild(placeholder);
        wrapper.appendChild(pages);

        try {
            await loadAsset('script', dependencies.core, dependencies.coreAttributes);
            if (!root.pdfjsLib) throw new Error('pdfjsLib is unavailable');
            root.pdfjsLib.GlobalWorkerOptions.workerSrc = dependencies.worker;
            await Promise.all([
                loadAsset('script', dependencies.viewer, dependencies.viewerAttributes),
                loadAsset('style', dependencies.viewerCss, dependencies.viewerCssAttributes)
            ]);
            if (!root.pdfjsViewer) throw new Error('pdfjsViewer is unavailable');

            var source = await this.transport.pdfSource(this.document, { signal: this.signal });
            this.eventBus = new root.pdfjsViewer.EventBus();
            this.loadingTask = root.pdfjsLib.getDocument(source);
            this.pdfDocument = await this.loadingTask.promise;
            placeholder.remove();

            for (var pageNumber = 1; pageNumber <= this.pdfDocument.numPages; pageNumber++) {
                var pageElement = createElement('div', {
                    dataset: {
                        viewerRole: 'pdf-page',
                        viewerPageNumber: pageNumber,
                        viewerDocumentId: this.document.id,
                        viewerState: 'idle'
                    }
                });
                pages.appendChild(pageElement);
                this.pageElements.add(pageElement);
                this.viewer.observePage(pageElement, this);
            }
        } catch (error) {
            placeholder.remove();
            this.showError(this.string('pdfError'));
            throw error;
        }
    };

    PdfRenderer.prototype.renderPage = async function (pageElement) {
        if (!this.pdfDocument || pageElement.dataset.viewerState !== 'idle') return;
        pageElement.dataset.viewerState = 'loading';
        var pageNumber = parseInt(pageElement.dataset.viewerPageNumber, 10);

        try {
            var page = await this.pdfDocument.getPage(pageNumber);
            var units = root.pdfjsLib.PixelsPerInch.PDF_TO_CSS_UNITS;
            var baseViewport = page.getViewport({ scale: 1 });
            var zoom = (pageElement.clientWidth || baseViewport.width * units) / (baseViewport.width * units);
            var viewport = page.getViewport({ scale: zoom * units });
            var pageView = new root.pdfjsViewer.PDFPageView({
                container: pageElement,
                id: pageNumber,
                scale: zoom,
                defaultViewport: viewport,
                eventBus: this.eventBus,
                annotationMode: root.pdfjsLib.AnnotationMode.DISABLE,
                layerProperties: function () { return {}; }
            });
            pageView.setPdfPage(page);
            pageElement.style.setProperty('--viewer-page-height', viewport.height + 'px');
            pageElement.style.height = 'var(--viewer-page-height)';
            this.pageViews.set(pageElement, pageView);

            if (root.ResizeObserver) {
                var observer = new root.ResizeObserver(function () {
                    var nextZoom = (pageElement.clientWidth || viewport.width) / (baseViewport.width * units);
                    if (Math.abs(nextZoom - pageView.scale) < 0.005) return;
                    pageView.update({ scale: nextZoom });
                    pageElement.style.setProperty('--viewer-page-height', pageView.viewport.height + 'px');
                });
                observer.observe(pageElement);
                this.resizeObservers.add(observer);
            }

            await pageView.draw();
            pageElement.dataset.viewerState = 'ready';
            this.viewer.emit('page:ready', { document: this.document, page: pageNumber, element: pageElement });
        } catch (error) {
            pageElement.dataset.viewerState = 'error';
            pageElement.textContent = this.string('pageError').replace('{page}', pageNumber);
            this.viewer.emit('page:error', { document: this.document, page: pageNumber, error: error });
        }
    };

    PdfRenderer.prototype.destroy = function () {
        BaseRenderer.prototype.destroy.call(this);
        this.pageElements.forEach(function (element) {
            this.viewer.unobservePage(element);
        }, this);
        this.resizeObservers.forEach(function (observer) { observer.disconnect(); });
        this.pageViews.forEach(function (pageView) {
            if (typeof pageView.cancelRendering === 'function') pageView.cancelRendering();
            if (typeof pageView.destroy === 'function') pageView.destroy();
        });
        this.pageElements.clear();
        this.resizeObservers.clear();
        this.pageViews.clear();
        if (this.loadingTask && typeof this.loadingTask.destroy === 'function') this.loadingTask.destroy();
        if (this.pdfDocument && typeof this.pdfDocument.destroy === 'function') this.pdfDocument.destroy();
        this.loadingTask = null;
        this.pdfDocument = null;
    };

    function ImageRenderer(context) { BaseRenderer.call(this, context); }
    ImageRenderer.prototype = Object.create(BaseRenderer.prototype);
    ImageRenderer.prototype.constructor = ImageRenderer;
    ImageRenderer.prototype.render = async function () {
        var wrapper = this.createWrapper();
        var resolved = await this.transport.directSource(this.document, 'view', { signal: this.signal });
        var sourceUrl = resolved.url;
        if (Object.keys(resolved.init.headers || {}).length) {
            var blob = await this.transport.blob(sourceUrl, {
                document: this.document,
                purpose: 'view',
                signal: this.signal
            });
            sourceUrl = URL.createObjectURL(blob);
            this.objectUrls.push(sourceUrl);
        }
        var image = createElement('img', {
            dataset: { viewerRole: 'image' },
            alt: this.document.title,
            loading: 'lazy',
            src: sourceUrl
        });
        if (resolved.init.credentials === 'include' && !resolved.signed) image.crossOrigin = 'use-credentials';
        wrapper.appendChild(image);
    };

    function MediaRenderer(context) { BaseRenderer.call(this, context); }
    MediaRenderer.prototype = Object.create(BaseRenderer.prototype);
    MediaRenderer.prototype.constructor = MediaRenderer;
    MediaRenderer.prototype.render = async function () {
        var wrapper = this.createWrapper();
        var resolved = await this.transport.directSource(this.document, 'view', { signal: this.signal });
        var sourceUrl = resolved.url;
        if (Object.keys(resolved.init.headers || {}).length) {
            var blob = await this.transport.blob(sourceUrl, {
                document: this.document,
                purpose: 'view',
                signal: this.signal
            });
            sourceUrl = URL.createObjectURL(blob);
            this.objectUrls.push(sourceUrl);
        }
        var card = createElement('div', { dataset: { viewerRole: 'media-container' } });
        var tag = this.document.type === 'video' ? 'video' : 'audio';
        var media = createElement(tag, {
            dataset: { viewerRole: 'media-player' },
            controls: true,
            preload: 'metadata'
        });
        if (resolved.init.credentials === 'include' && !resolved.signed) media.crossOrigin = 'use-credentials';
        if (tag === 'video') media.setAttribute('playsinline', '');
        media.appendChild(createElement('source', { src: sourceUrl, type: this.document.mime }));
        card.appendChild(media);
        wrapper.appendChild(card);
    };

    function TextRenderer(context) { BaseRenderer.call(this, context); }
    TextRenderer.prototype = Object.create(BaseRenderer.prototype);
    TextRenderer.prototype.constructor = TextRenderer;
    TextRenderer.prototype.render = async function () {
        var wrapper = this.createWrapper();
        var content = createElement('pre', {
            dataset: { viewerRole: 'text-content' }
        }, this.string('textLoading'));
        wrapper.appendChild(content);
        try {
            var definition = sourceDefinition(this.document, 'view');
            content.textContent = await this.transport.text(definition.url, {
                document: this.document,
                purpose: 'view',
                signal: this.signal
            });
        } catch (error) {
            content.textContent = this.string('textError');
            throw error;
        }
    };

    function OfficeRenderer(context) {
        BaseRenderer.call(this, context);
        this.editor = null;
    }
    OfficeRenderer.prototype = Object.create(BaseRenderer.prototype);
    OfficeRenderer.prototype.constructor = OfficeRenderer;
    OfficeRenderer.prototype.render = async function () {
        var wrapper = this.createWrapper();
        var placeholderId = 'viewer-office-' + (++objectSequence);
        var placeholder = createElement('div', {
            id: placeholderId,
            dataset: { viewerRole: 'office-frame' }
        }, this.string('officeLoading'));
        wrapper.appendChild(placeholder);

        var configSource = sourceDefinition(this.document, 'config');
        var onlyoffice = this.options.dependencies && this.options.dependencies.onlyoffice || {};
        var apiUrl = onlyoffice.api || this.options.onlyofficeApiJs || '';
        if (!apiUrl || !configSource.url) {
            placeholder.textContent = this.string('officeError');
            wrapper.dataset.viewerState = 'error';
            throw new Error('PrutViewer office dependency or config URL is missing');
        }

        try {
            var results = await Promise.all([
                loadAsset('script', apiUrl, onlyoffice.attributes),
                this.transport.json(configSource.url, {
                    document: this.document,
                    purpose: 'config',
                    signal: this.signal
                })
            ]);
            if (!root.DocsAPI || typeof root.DocsAPI.DocEditor !== 'function') {
                throw new Error('ONLYOFFICE DocsAPI is unavailable');
            }
            var config = results[1];
            var configuredEvents = config.events || {};
            config.events = mergeObjects(configuredEvents, {
                onError: function (event) {
                    if (typeof configuredEvents.onError === 'function') configuredEvents.onError(event);
                }
            });
            placeholder.textContent = '';
            this.editor = new root.DocsAPI.DocEditor(placeholderId, config);
        } catch (error) {
            placeholder.textContent = this.string('officeError');
            wrapper.dataset.viewerState = 'error';
            throw error;
        }
    };

    OfficeRenderer.prototype.destroy = function () {
        BaseRenderer.prototype.destroy.call(this);
        if (this.editor && typeof this.editor.destroyEditor === 'function') {
            this.editor.destroyEditor();
        }
        this.editor = null;
    };

    function FallbackRenderer(context) { BaseRenderer.call(this, context); }
    FallbackRenderer.prototype = Object.create(BaseRenderer.prototype);
    FallbackRenderer.prototype.constructor = FallbackRenderer;
    FallbackRenderer.prototype.render = async function () {
        var wrapper = this.createWrapper();
        var body = createElement('div', {
            dataset: { viewerRole: 'fallback' }
        });
        body.appendChild(createElement('div', {
            dataset: { viewerRole: 'fallback-hint' }
        }, this.string('fallbackHint')));
        var definition = sourceDefinition(this.document, 'download');
        var resolved = await this.transport.resolve(definition.url, {
            document: this.document,
            purpose: 'download',
            signal: this.signal
        });
        var link = createElement('a', {
            dataset: { viewerRole: 'download' },
            href: resolved.url,
            download: ''
        }, this.string('fallbackBtn') + (this.document.ext ? ' ' + this.document.ext.toUpperCase() : ''));
        if (Object.keys(resolved.init.headers || {}).length) {
            var renderer = this;
            link.addEventListener('click', async function (event) {
                event.preventDefault();
                var blob = await renderer.transport.blob(definition.url, {
                    document: renderer.document,
                    purpose: 'download',
                    signal: renderer.signal
                });
                var objectUrl = URL.createObjectURL(blob);
                renderer.objectUrls.push(objectUrl);
                var temporaryLink = createElement('a', {
                    href: objectUrl,
                    download: renderer.document.title || renderer.document.id
                });
                temporaryLink.click();
            });
        }
        body.appendChild(link);
        wrapper.appendChild(body);
    };

    function PrutViewer(container, options) {
        if (!(this instanceof PrutViewer)) return new PrutViewer(container, options);
        if (typeof document === 'undefined') throw new Error('PrutViewer requires a browser DOM');
        if (typeof container === 'string') container = document.querySelector(container);
        if (!container || container.nodeType !== 1) throw new Error('PrutViewer container is required');

        this.container = container;
        this.options = mergeObjects({
            manifestUrl: '',
            manifest: null,
            fileBaseUrl: '',
            preloadAhead: 3,
            lazyRootMargin: '600px 0px',
            pageRootMargin: '300px 0px',
            strings: {},
            transport: {},
            dependencies: {},
            renderers: {},
            plugins: [],
            onDocRendered: null,
            autoLoad: false
        }, options || {});
        this.transport = this.options.transport instanceof PrutViewerTransport
            ? this.options.transport
            : new PrutViewerTransport(this.options.transport);
        this.documents = [];
        this.renderers = new Map();
        this.slots = new Map();
        this.plugins = [];
        this.children = new Map();
        this.events = new Map();
        this.documentObserver = null;
        this.pageObserver = null;
        this.pageRenderers = new WeakMap();
        this.controller = null;
        this.status = 'idle';
        this.manifest = null;
        this.registry = new Map(PrutViewer.renderers);

        var viewer = this;
        Object.keys(this.options.renderers || {}).forEach(function (type) {
            viewer.registerRenderer(type, viewer.options.renderers[type]);
        });
        (this.options.plugins || []).forEach(function (plugin) { viewer.use(plugin); });

        this.container.dataset.viewerRole = this.container.dataset.viewerRole || 'root';
        this.container.dataset.viewerVersion = VERSION;
    }

    PrutViewer.version = VERSION;
    PrutViewer.renderers = new Map([
        ['pdf', PdfRenderer],
        ['image', ImageRenderer],
        ['video', MediaRenderer],
        ['audio', MediaRenderer],
        ['text', TextRenderer],
        ['office', OfficeRenderer],
        ['download', FallbackRenderer]
    ]);

    PrutViewer.registerRenderer = function (type, renderer) {
        if (!type || typeof renderer !== 'function') throw new Error('PrutViewer renderer must be a constructor');
        PrutViewer.renderers.set(String(type).toLowerCase(), renderer);
        return PrutViewer;
    };

    PrutViewer.unregisterRenderer = function (type) {
        PrutViewer.renderers.delete(String(type).toLowerCase());
        return PrutViewer;
    };

    PrutViewer.prototype.registerRenderer = function (type, renderer) {
        if (!type || typeof renderer !== 'function') throw new Error('PrutViewer renderer must be a constructor');
        this.registry.set(String(type).toLowerCase(), renderer);
        return this;
    };

    PrutViewer.prototype.unregisterRenderer = function (type) {
        this.registry.delete(String(type).toLowerCase());
        return this;
    };

    PrutViewer.prototype.use = function (plugin, pluginOptions) {
        if (typeof plugin === 'function') plugin = plugin(pluginOptions || {});
        if (!plugin || (typeof plugin !== 'object' && typeof plugin !== 'function')) {
            throw new Error('PrutViewer plugin is invalid');
        }
        this.plugins.push(plugin);
        if (typeof plugin.install === 'function') plugin.install(this, pluginOptions || {});
        return this;
    };

    PrutViewer.prototype.hook = async function (name, payload) {
        for (var i = 0; i < this.plugins.length; i++) {
            if (typeof this.plugins[i][name] === 'function') {
                await this.plugins[i][name](payload, this);
            }
        }
    };

    PrutViewer.prototype.on = function (type, listener) {
        if (!this.events.has(type)) this.events.set(type, new Set());
        this.events.get(type).add(listener);
        return this;
    };

    PrutViewer.prototype.off = function (type, listener) {
        if (this.events.has(type)) this.events.get(type).delete(listener);
        return this;
    };

    PrutViewer.prototype.emit = function (type, detail) {
        if (this.events.has(type)) {
            this.events.get(type).forEach(function (listener) {
                try { listener(detail, this); } catch (error) { this.log('error', error); }
            }, this);
        }
        if (typeof root.CustomEvent === 'function') {
            this.container.dispatchEvent(new root.CustomEvent('prutviewer:' + type, {
                bubbles: true,
                detail: detail
            }));
        }
        return this;
    };

    PrutViewer.prototype.log = function (level) {
        var logger = this.options.logger;
        if (!logger) return;
        var args = Array.prototype.slice.call(arguments, 1);
        if (typeof logger === 'function') logger.apply(null, [level].concat(args));
        else if (logger[level]) logger[level].apply(logger, args);
    };

    PrutViewer.prototype.string = function (key) {
        return Object.prototype.hasOwnProperty.call(this.options.strings || {}, key)
            ? this.options.strings[key]
            : DEFAULT_STRINGS[key] || key;
    };

    PrutViewer.prototype.setState = function (state) {
        this.status = state;
        this.container.dataset.viewerState = state;
        this.emit('state:change', { state: state });
    };

    PrutViewer.prototype.renderState = function (state, message) {
        this.container.replaceChildren(createElement('div', {
            dataset: { viewerRole: 'status', viewerState: state },
            role: state === 'error' ? 'alert' : 'status'
        }, message));
    };

    PrutViewer.prototype.init = async function () {
        if (this.status === 'ready') return this;
        if (this.status === 'destroyed') throw new Error('PrutViewer instance is destroyed');
        if (this.status === 'loading' && this.initializing) return this.initializing;

        var viewer = this;
        this.initializing = (async function () {
            viewer.setState('loading');
            viewer.renderState('loading', viewer.string('loading'));
            viewer.controller = new AbortController();
            await viewer.hook('beforeInit', { options: viewer.options });

            try {
                var manifest = viewer.options.manifest;
                if (!manifest) {
                    if (!viewer.options.manifestUrl) throw new Error('PrutViewer manifestUrl or manifest is required');
                    manifest = await viewer.transport.json(viewer.options.manifestUrl, {
                        purpose: 'manifest',
                        signal: viewer.controller.signal
                    });
                }
                await viewer.load(manifest);
                await viewer.hook('afterInit', { manifest: viewer.manifest });
                return viewer;
            } catch (error) {
                if (error.name === 'AbortError') return viewer;
                viewer.setState('error');
                viewer.renderState('error', viewer.string('error'));
                viewer.emit('manifest:error', { error: error });
                viewer.log('error', error);
                throw error;
            } finally {
                viewer.initializing = null;
            }
        }());

        return this.initializing;
    };

    PrutViewer.prototype.load = async function (manifest) {
        await this.reset(false);
        this.controller = new AbortController();
        this.manifest = Array.isArray(manifest) ? { documents: manifest } : mergeObjects(manifest || {});
        var rows = Array.isArray(this.manifest.documents) ? this.manifest.documents : [];
        this.documents = rows.map(function (row, index) {
            return normalizeDocument(row, index, this.options);
        }, this);
        await this.hook('afterManifest', { manifest: this.manifest, documents: this.documents });
        this.emit('manifest:loaded', { manifest: this.manifest, documents: this.documents });

        if (!this.documents.length) {
            this.setState('empty');
            this.renderState('empty', this.string('empty'));
            return this;
        }

        this.container.replaceChildren();
        this.setupPageObserver();
        this.buildSlots();
        this.setupDocumentObserver();
        this.setState('ready');
        return this;
    };

    PrutViewer.prototype.buildSlots = function () {
        var fragment = document.createDocumentFragment();
        this.documents.forEach(function (documentItem, index) {
            var slot = createElement('div', {
                dataset: {
                    viewerRole: 'slot',
                    viewerIndex: index,
                    viewerDocumentId: documentItem.id,
                    viewerState: 'idle'
                }
            });
            var placeholder = createElement('div', {
                dataset: { viewerRole: 'placeholder' }
            });
            placeholder.appendChild(createElement('div', {
                dataset: { viewerRole: 'placeholder-title' }
            }, documentItem.title));
            placeholder.appendChild(createElement('div', {
                dataset: { viewerRole: 'placeholder-hint' }
            }, this.string('scrollHint')));
            slot.appendChild(placeholder);
            this.slots.set(documentItem.id, slot);
            fragment.appendChild(slot);
        }, this);
        this.container.appendChild(fragment);
    };

    PrutViewer.prototype.setupDocumentObserver = function () {
        var viewer = this;
        if (!root.IntersectionObserver) {
            this.documents.forEach(function (_, index) { viewer.loadDocument(index); });
            return;
        }
        this.documentObserver = new root.IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var index = parseInt(entry.target.dataset.viewerIndex, 10);
                for (var current = index; current <= index + viewer.options.preloadAhead; current++) {
                    if (current < viewer.documents.length) viewer.loadDocument(current);
                }
            });
        }, { root: null, rootMargin: this.options.lazyRootMargin, threshold: 0 });
        this.slots.forEach(function (slot) { viewer.documentObserver.observe(slot); });
    };

    PrutViewer.prototype.setupPageObserver = function () {
        if (this.pageObserver || !root.IntersectionObserver) return;
        var viewer = this;
        this.pageObserver = new root.IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var renderer = viewer.pageRenderers.get(entry.target);
                if (renderer) renderer.renderPage(entry.target);
            });
        }, { root: null, rootMargin: this.options.pageRootMargin, threshold: 0 });
    };

    PrutViewer.prototype.observePage = function (element, renderer) {
        this.pageRenderers.set(element, renderer);
        if (this.pageObserver) this.pageObserver.observe(element);
        else renderer.renderPage(element);
    };

    PrutViewer.prototype.unobservePage = function (element) {
        if (this.pageObserver) this.pageObserver.unobserve(element);
        this.pageRenderers.delete(element);
    };

    PrutViewer.prototype.loadDocument = async function (index) {
        if (this.renderers.has(index) || !this.documents[index]) return this.renderers.get(index);
        var documentItem = this.documents[index];
        var slot = this.slots.get(documentItem.id);
        if (!slot) return null;
        slot.dataset.viewerState = 'loading';
        var placeholder = slot.querySelector('[data-viewer-role="placeholder"]');
        if (placeholder) placeholder.remove();

        var Renderer = this.registry.get(documentItem.type) || FallbackRenderer;
        slot.dataset.viewerRenderer = documentItem.type;
        var renderer = new Renderer({
            viewer: this,
            slot: slot,
            document: documentItem,
            options: this.options,
            transport: this.transport,
            signal: this.controller.signal
        });
        this.renderers.set(index, renderer);
        await this.hook('beforeRender', { renderer: renderer, document: documentItem, slot: slot });
        this.emit('document:loading', { document: documentItem, slot: slot });

        try {
            await renderer.render();
            slot.dataset.viewerState = 'ready';
            await this.hook('afterRender', { renderer: renderer, document: documentItem, slot: slot });
            if (typeof this.options.onDocRendered === 'function') {
                await this.options.onDocRendered(slot, documentItem, renderer, this);
            }
            this.emit('document:ready', { document: documentItem, slot: slot, renderer: renderer });
            return renderer;
        } catch (error) {
            slot.dataset.viewerState = 'error';
            await this.hook('onError', { error: error, document: documentItem, slot: slot, renderer: renderer });
            this.emit('document:error', { error: error, document: documentItem, slot: slot, renderer: renderer });
            this.log('error', error);
            return renderer;
        }
    };

    PrutViewer.prototype.open = function (documentId, options) {
        return this.scrollTo(documentId, options);
    };

    PrutViewer.prototype.scrollTo = function (documentId, options) {
        options = options || {};
        var slot = this.slots.get(String(documentId));
        if (!slot) return false;
        var target = slot;
        if (options.page) {
            var page = slot.querySelector('[data-viewer-page-number="' + cssEscape(options.page) + '"]');
            if (page) target = page;
        }
        target.scrollIntoView({
            behavior: options.behavior || 'smooth',
            block: options.block || 'start'
        });
        return true;
    };

    PrutViewer.prototype.getDocument = function (documentId) {
        return this.documents.find(function (item) { return item.id === String(documentId); }) || null;
    };

    PrutViewer.prototype.getState = function () {
        return {
            status: this.status,
            manifest: this.manifest,
            documents: this.documents.slice(),
            rendered: Array.from(this.renderers.keys())
        };
    };

    PrutViewer.prototype.download = async function (documentId) {
        var documentItem = this.getDocument(documentId);
        if (!documentItem) throw new Error('PrutViewer document was not found: ' + documentId);
        var definition = sourceDefinition(documentItem, 'download');
        var resolved = await this.transport.resolve(definition.url, {
            document: documentItem,
            purpose: 'download',
            signal: this.controller && this.controller.signal
        });
        var url = resolved.url;

        if (Object.keys(resolved.init.headers || {}).length) {
            var blob = await this.transport.blob(definition.url, {
                document: documentItem,
                purpose: 'download',
                signal: this.controller && this.controller.signal
            });
            url = URL.createObjectURL(blob);
            window.setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        }

        var link = createElement('a', {
            href: url,
            download: documentItem.title || documentItem.id
        });
        link.click();
        return true;
    };

    PrutViewer.prototype.setOptions = function (options) {
        this.options = mergeObjects(this.options, options || {});
        if (options && options.transport) {
            this.transport = options.transport instanceof PrutViewerTransport
                ? options.transport
                : new PrutViewerTransport(this.options.transport);
        }
        return this;
    };

    PrutViewer.prototype.retry = async function (documentId) {
        var documentItem = this.getDocument(documentId);
        if (!documentItem) return null;
        var index = documentItem.index;
        var renderer = this.renderers.get(index);
        if (renderer && typeof renderer.destroy === 'function') await renderer.destroy();
        this.renderers.delete(index);
        var slot = this.slots.get(documentItem.id);
        if (slot) {
            slot.replaceChildren();
            slot.dataset.viewerState = 'idle';
        }
        return this.loadDocument(index);
    };

    PrutViewer.prototype.reload = async function (manifestUrl, fileBaseUrl) {
        if (typeof manifestUrl !== 'undefined') this.options.manifestUrl = manifestUrl;
        if (typeof fileBaseUrl !== 'undefined') this.options.fileBaseUrl = fileBaseUrl;
        this.options.manifest = null;
        this.status = 'idle';
        return this.init();
    };

    PrutViewer.prototype.createChild = function (name, container, options) {
        if (!name || this.children.has(name)) throw new Error('PrutViewer child name must be unique');
        var childOptions = mergeObjects(this.options, options || {});
        delete childOptions.plugins;
        var child = new PrutViewer(container, childOptions);
        this.children.set(name, child);
        this.emit('child:created', { name: name, viewer: child });
        return child;
    };

    PrutViewer.prototype.getChild = function (name) {
        return this.children.get(name) || null;
    };

    PrutViewer.prototype.destroyChild = async function (name) {
        var child = this.children.get(name);
        if (!child) return false;
        await child.destroy();
        this.children.delete(name);
        this.emit('child:destroyed', { name: name });
        return true;
    };

    PrutViewer.prototype.reset = async function (clearContainer) {
        if (this.controller) this.controller.abort();
        if (this.documentObserver) this.documentObserver.disconnect();
        if (this.pageObserver) this.pageObserver.disconnect();
        this.documentObserver = null;
        this.pageObserver = null;
        this.pageRenderers = new WeakMap();

        var tasks = [];
        this.renderers.forEach(function (renderer) {
            if (renderer && typeof renderer.destroy === 'function') {
                try { tasks.push(Promise.resolve(renderer.destroy())); } catch (error) { tasks.push(Promise.reject(error)); }
            }
        });
        await Promise.allSettled(tasks);
        this.renderers.clear();
        this.slots.clear();
        this.documents = [];
        if (clearContainer !== false) this.container.replaceChildren();
    };

    PrutViewer.prototype.destroy = async function () {
        if (this.status === 'destroyed') return;
        await this.hook('beforeDestroy', {});
        var childNames = Array.from(this.children.keys());
        for (var i = 0; i < childNames.length; i++) await this.destroyChild(childNames[i]);
        await this.reset(true);
        for (var pluginIndex = 0; pluginIndex < this.plugins.length; pluginIndex++) {
            if (typeof this.plugins[pluginIndex].destroy === 'function') {
                await this.plugins[pluginIndex].destroy(this);
            }
        }
        this.events.clear();
        this.plugins = [];
        this.setState('destroyed');
    };

    function PrutViewerManager() {
        this.instances = new Map();
    }

    PrutViewerManager.prototype.create = function (name, container, options) {
        if (!name || this.instances.has(name)) throw new Error('PrutViewer instance name must be unique');
        var viewer = new PrutViewer(container, options);
        this.instances.set(name, viewer);
        return viewer;
    };

    PrutViewerManager.prototype.get = function (name) {
        return this.instances.get(name) || null;
    };

    PrutViewerManager.prototype.destroy = async function (name) {
        var viewer = this.instances.get(name);
        if (!viewer) return false;
        await viewer.destroy();
        this.instances.delete(name);
        return true;
    };

    PrutViewerManager.prototype.destroyAll = async function () {
        var names = Array.from(this.instances.keys());
        for (var i = 0; i < names.length; i++) await this.destroy(names[i]);
    };

    PrutViewer.manager = new PrutViewerManager();
    PrutViewer.Transport = PrutViewerTransport;
    PrutViewer.Manager = PrutViewerManager;
    PrutViewer.loadScript = function (url, attributes) { return loadAsset('script', url, attributes); };
    PrutViewer.loadStylesheet = function (url, attributes) { return loadAsset('style', url, attributes); };
    PrutViewer.escapeHtml = escapeHtml;
    PrutViewer.escHtml = escapeHtml;

    PrutViewer.autoInit = function (scope) {
        if (typeof document === 'undefined') return [];
        scope = scope || document;
        var instances = [];
        scope.querySelectorAll('[data-viewer-auto], [data-viewer="auto"]').forEach(function (element) {
            if (autoInstances.has(element)) return;
            var options = {};
            if (element.dataset.viewerOptions) {
                try { options = JSON.parse(element.dataset.viewerOptions); } catch (error) { options = {}; }
            }
            options.manifestUrl = options.manifestUrl || element.dataset.viewerManifest || '';
            options.fileBaseUrl = options.fileBaseUrl || element.dataset.viewerFileBase || '';
            var viewer = new PrutViewer(element, options);
            autoInstances.set(element, viewer);
            instances.push(viewer);
            viewer.init().catch(function () {});
        });
        return instances;
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { PrutViewer.autoInit(document); }, { once: true });
        } else {
            PrutViewer.autoInit(document);
        }
    }

    return {
        PrutViewer: PrutViewer,
        PrutViewerManager: PrutViewerManager,
        PrutViewerTransport: PrutViewerTransport,
        BaseRenderer: BaseRenderer,
        renderers: {
            pdf: PdfRenderer,
            image: ImageRenderer,
            video: MediaRenderer,
            audio: MediaRenderer,
            text: TextRenderer,
            office: OfficeRenderer,
            download: FallbackRenderer
        }
    };
}));
