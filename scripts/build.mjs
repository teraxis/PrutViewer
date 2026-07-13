import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outputDirectory = new URL('../dist/', import.meta.url);
const files = [
    'script.js',
    'style.css',
    'index.mjs',
    'manifest.schema.json',
    'package.json',
    'README.md',
    'LICENSE'
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of files) {
    await cp(new URL(`../${file}`, import.meta.url), new URL(file, outputDirectory));
}

await build({
    entryPoints: [fileURLToPath(new URL('../script.js', import.meta.url))],
    outfile: fileURLToPath(new URL('script.min.js', outputDirectory)),
    bundle: false,
    minify: true,
    legalComments: 'external'
});

await build({
    entryPoints: [fileURLToPath(new URL('../style.css', import.meta.url))],
    outfile: fileURLToPath(new URL('style.min.css', outputDirectory)),
    bundle: false,
    minify: true,
    legalComments: 'external'
});
