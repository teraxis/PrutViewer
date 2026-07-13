import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const schema = JSON.parse(await readFile(new URL('../manifest.schema.json', import.meta.url), 'utf8'));

const assertions = [
    [packageJson.name === 'prut-viewer', 'Unexpected package name'],
    [packageJson.license === 'MIT', 'Package must use the MIT license'],
    [schema.$id === 'urn:prut-viewer:manifest:1', 'Unexpected manifest schema id'],
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

const failed = assertions.filter(([condition]) => !condition).map(([, message]) => message);
if (failed.length) throw new Error(failed.join('\n'));

process.stdout.write('PrutViewer validation passed.\n');
