import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../demo-manifest.json', import.meta.url), 'utf8'));
const documents = manifest.documents.map((document) => ({
    id: document.id,
    title: document.title,
    type: document.type,
    mime: document.mime,
    ext: document.ext,
    sources: document.sources
}));
const encoded = {};

for (const document of documents.filter((item) => item.type === 'pdf')) {
    const source = document.sources && document.sources.view;
    const sourceUrl = typeof source === 'string' ? source : source && source.url;
    if (!sourceUrl || /^[a-z][a-z\d+.-]*:/i.test(sourceUrl)) {
        throw new Error(`Local PDF fixture must use a relative source: ${document.id}`);
    }
    encoded[document.id] = (await readFile(new URL('../' + sourceUrl.replace(/^\.\//, ''), import.meta.url)))
        .toString('base64');
}

const catalogTarget = new URL('../demo-files.js', import.meta.url);
const dataTarget = new URL('../demo-pdf-data.js', import.meta.url);
await writeFile(
    catalogTarget,
    `globalThis.prutViewerDemoFiles = ${JSON.stringify(documents, null, 2)};\n`,
    'utf8'
);
await writeFile(
    dataTarget,
    `globalThis.prutViewerDemoPdfData = ${JSON.stringify(encoded, null, 2)};\n`,
    'utf8'
);
process.stdout.write(`Generated ${catalogTarget.pathname} and ${dataTarget.pathname}\n`);
