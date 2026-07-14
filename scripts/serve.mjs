import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf'
};

createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
        const relative = normalize(pathname).replace(/^([/\\])+/, '') || 'README.md';
        const filename = join(root, relative);

        if (!filename.startsWith(root)) {
            response.writeHead(403).end('Forbidden');
            return;
        }

        const info = await stat(filename);
        if (!info.isFile()) throw new Error('Not a file');

        response.writeHead(200, {
            'Content-Type': types[extname(filename)] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        createReadStream(filename).pipe(response);
    } catch {
        response.writeHead(404).end('Not found');
    }
}).listen(port, '127.0.0.1', () => {
    process.stdout.write(`PrutViewer test server: http://127.0.0.1:${port}\n`);
});
