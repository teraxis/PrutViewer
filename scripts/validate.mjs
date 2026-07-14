import { access, readdir, readFile, stat } from 'node:fs/promises';

const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const schema = JSON.parse(await readFile(new URL('../manifest.schema.json', import.meta.url), 'utf8'));
const demoManifest = JSON.parse(await readFile(new URL('../demo-manifest.json', import.meta.url), 'utf8'));
const demoFilesScript = await readFile(new URL('../demo-files.js', import.meta.url), 'utf8');
const demoPdfDataScript = await readFile(new URL('../demo-pdf-data.js', import.meta.url), 'utf8');
const root = new URL('../', import.meta.url);
const demoFilesMatch = demoFilesScript.match(/^globalThis\.prutViewerDemoFiles\s*=\s*([\s\S]+);\s*$/);
const demoFiles = demoFilesMatch ? JSON.parse(demoFilesMatch[1]) : [];
const demoPdfDataMatch = demoPdfDataScript.match(/^globalThis\.prutViewerDemoPdfData\s*=\s*([\s\S]+);\s*$/);
const demoPdfData = demoPdfDataMatch ? JSON.parse(demoPdfDataMatch[1]) : {};

const assertions = [
    [packageJson.name === 'prut-viewer', 'Unexpected package name'],
    [packageJson.license === 'MIT', 'Package must use the MIT license'],
    [schema.$id === 'urn:prut-viewer:manifest:1', 'Unexpected manifest schema id'],
    [demoManifest.schema === 'prut-viewer/1', 'Unexpected demo manifest schema'],
    [Array.isArray(demoManifest.documents) && demoManifest.documents.length > 0, 'Demo manifest is empty'],
    [Boolean(demoFilesMatch) && demoFiles.length > 0, 'Local demo catalog is invalid or empty'],
    [Boolean(demoPdfDataMatch), 'Embedded PDF fixture data is invalid'],
    [script.includes('root.PrutViewer = api.PrutViewer'), 'PrutViewer browser global is missing'],
    [script.includes('root.PrutViewerManager = api.PrutViewerManager'), 'Manager browser global is missing'],
    [script.includes('root.PrutViewerTransport = api.PrutViewerTransport'), 'Transport browser global is missing']
];

const forbidden = [
    ['className', 'Core must not set CSS class names'],
    ['classList', 'Core must not mutate CSS classes'],
    ['docv-', 'Application-specific docv selectors are forbidden'],
    ['PentryViewer', 'Application-specific public globals are forbidden'],
    ['TeraxisViewer', 'Vendor-specific public globals are forbidden'],
    ['templates/', 'Application runtime paths are forbidden in the library core'],
    ['/cabinet/', 'Application endpoints are forbidden in the library core']
];

for (const [token, message] of forbidden) {
    assertions.push([!script.includes(token), message]);
}

const documentIds = demoManifest.documents.map((document) => String(document.id));
const localDocumentIds = demoFiles.map((document) => String(document.id));
assertions.push([
    new Set(documentIds).size === documentIds.length,
    'Demo manifest document ids must be unique'
]);
assertions.push([
    documentIds.length === localDocumentIds.length
        && documentIds.every((id, index) => id === localDocumentIds[index]),
    'Local demo catalog must match the full manifest document ids and order'
]);
assertions.push([
    demoFiles.some((document) => document.type === 'pdf')
        && demoFiles.some((document) => document.type === 'video'),
    'Local demo catalog must contain PDF and video entries'
]);

const sourcePaths = new Set();
for (const document of demoManifest.documents) {
    const source = document.sources && document.sources.view;
    const sourceUrl = typeof source === 'string' ? source : source && source.url;
    assertions.push([Boolean(sourceUrl), `Demo document ${document.id} has no view source`]);
    if (!sourceUrl || /^[a-z][a-z\d+.-]*:/i.test(sourceUrl)) continue;

    const relativePath = sourceUrl.replace(/^\.\//, '');
    sourcePaths.add(relativePath);
    try {
        const fileUrl = new URL(relativePath, root);
        await access(fileUrl);
        const file = await stat(fileUrl);
        if (Number.isInteger(document.metadata && document.metadata.sizeBytes)) {
            assertions.push([
                document.metadata.sizeBytes === file.size,
                `Demo size metadata is stale: ${relativePath}`
            ]);
        }
    } catch {
        assertions.push([false, `Demo source does not exist: ${relativePath}`]);
    }
}

const pdfSamples = (await readdir(new URL('../tests/pdf/', import.meta.url)))
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .map((name) => `tests/pdf/${name}`);
const videoSamples = (await readdir(new URL('../docs/images/', import.meta.url)))
    .filter((name) => /\.(mp4|webm|ogv)$/i.test(name))
    .map((name) => `docs/images/${name}`);

for (const sample of [...pdfSamples, ...videoSamples]) {
    assertions.push([sourcePaths.has(sample), `Demo manifest does not include ${sample}`]);
}

const localSourcePaths = new Set(demoFiles.map((document) => {
    const source = document.sources && document.sources.view;
    const sourceUrl = typeof source === 'string' ? source : source && source.url;
    return sourceUrl ? sourceUrl.replace(/^\.\//, '') : '';
}));
for (const sourcePath of localSourcePaths) {
    assertions.push([sourcePaths.has(sourcePath), `Local demo source is absent from the full manifest: ${sourcePath}`]);
}

for (const document of demoFiles.filter((item) => item.type === 'pdf')) {
    const source = document.sources && document.sources.view;
    const sourceUrl = typeof source === 'string' ? source : source && source.url;
    const sourcePath = sourceUrl && sourceUrl.replace(/^\.\//, '');
    const encoded = demoPdfData[document.id];
    assertions.push([Boolean(encoded), `Embedded PDF fixture is missing: ${document.id}`]);
    if (!encoded || !sourcePath) continue;
    const sourceBytes = await readFile(new URL(sourcePath, root));
    const embeddedBytes = Buffer.from(encoded, 'base64');
    assertions.push([
        sourceBytes.equals(embeddedBytes),
        `Embedded PDF fixture is stale: ${document.id}`
    ]);
}

const failed = assertions.filter(([condition]) => !condition).map(([, message]) => message);
if (failed.length) throw new Error(failed.join('\n'));

process.stdout.write('PrutViewer validation passed.\n');
