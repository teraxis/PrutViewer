<?php
declare(strict_types=1);

/*
 * Framework-free PrutViewer example.
 *
 * Put this file beside script.js, style.css, demo.css, tests/pdf, and
 * docs/images. Replace authorize_demo_request() with the host application's
 * session or ACL check before using the manifest/file endpoints in production.
 */

function authorize_demo_request(): void
{
    // Example production policy:
    // session_start();
    // if (empty($_SESSION['can_view_documents'])) {
    //     http_response_code(403);
    //     exit('Forbidden');
    // }
}

function demo_catalog(): array
{
    $definitions = [
        'tests/pdf/*.pdf' => ['type' => 'pdf', 'mime' => 'application/pdf'],
        'docs/images/*.mp4' => ['type' => 'video', 'mime' => 'video/mp4'],
        'docs/images/*.webm' => ['type' => 'video', 'mime' => 'video/webm'],
        'docs/images/*.ogv' => ['type' => 'video', 'mime' => 'video/ogg'],
    ];
    $catalog = [];

    foreach ($definitions as $pattern => $definition) {
        $files = glob(__DIR__ . '/' . $pattern) ?: [];
        foreach ($files as $path) {
            $realPath = realpath($path);
            if ($realPath === false || !is_file($realPath)) {
                continue;
            }

            $relative = str_replace('\\', '/', substr($realPath, strlen(__DIR__) + 1));
            $filename = basename($realPath);
            $name = pathinfo($filename, PATHINFO_FILENAME);
            $title = ucwords(str_replace(['_', '-'], ' ', $name));
            if ($filename === 'F74i7CSqVV.mp4') {
                $title = 'PrutViewer demonstration video';
            }

            $catalog[] = [
                'id' => $definition['type'] . '-' . substr(hash('sha256', $relative), 0, 16),
                'title' => $title,
                'type' => $definition['type'],
                'mime' => $definition['mime'],
                'ext' => strtolower(pathinfo($filename, PATHINFO_EXTENSION)),
                'path' => $realPath,
                'filename' => $filename,
                'sizeBytes' => filesize($realPath),
            ];
        }
    }

    usort($catalog, static function (array $left, array $right): int {
        $byType = strcmp($left['type'], $right['type']);
        return $byType !== 0 ? $byType : strcmp($left['filename'], $right['filename']);
    });

    return $catalog;
}

function self_url(): string
{
    return isset($_SERVER['SCRIPT_NAME']) ? (string) $_SERVER['SCRIPT_NAME'] : '/demo.php';
}

function send_json(array $payload): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function send_error(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    echo $message;
    exit;
}

function manifest_response(array $catalog): void
{
    $self = self_url();
    $documents = [];

    foreach ($catalog as $item) {
        $fileUrl = $self . '?action=file&id=' . rawurlencode($item['id']);
        $documents[] = [
            'id' => $item['id'],
            'title' => $item['title'],
            'type' => $item['type'],
            'mime' => $item['mime'],
            'ext' => $item['ext'],
            'sources' => [
                'view' => [
                    'url' => $fileUrl,
                    'request' => ['auth' => 'session', 'credentials' => 'same-origin'],
                ],
                'download' => [
                    'url' => $fileUrl . '&download=1',
                    'request' => ['auth' => 'session', 'credentials' => 'same-origin'],
                ],
            ],
            'metadata' => ['sizeBytes' => $item['sizeBytes']],
        ];
    }

    send_json([
        'schema' => 'prut-viewer/1',
        'id' => 'prut-viewer-php-demo',
        'metadata' => ['generatedAt' => gmdate(DATE_ATOM)],
        'documents' => $documents,
    ]);
}

function file_response(array $catalog, string $id): void
{
    $selected = null;
    foreach ($catalog as $item) {
        if (hash_equals($item['id'], $id)) {
            $selected = $item;
            break;
        }
    }
    if ($selected === null) {
        send_error(404, 'File not found.');
    }

    $root = realpath(__DIR__);
    $path = realpath($selected['path']);
    if ($root === false || $path === false || strpos($path, $root . DIRECTORY_SEPARATOR) !== 0 || !is_file($path)) {
        send_error(403, 'Invalid file path.');
    }

    $size = filesize($path);
    if ($size === false) {
        send_error(500, 'Unable to read the file size.');
    }

    $start = 0;
    $end = $size - 1;
    $status = 200;
    $range = isset($_SERVER['HTTP_RANGE']) ? trim((string) $_SERVER['HTTP_RANGE']) : '';

    if ($range !== '') {
        if (strpos($range, ',') !== false || !preg_match('/^bytes=(\d*)-(\d*)$/', $range, $match)) {
            header('Content-Range: bytes */' . $size);
            send_error(416, 'Requested range is not satisfiable.');
        }

        if ($match[1] === '' && $match[2] === '') {
            header('Content-Range: bytes */' . $size);
            send_error(416, 'Requested range is not satisfiable.');
        }

        if ($match[1] === '') {
            $suffixLength = (int) $match[2];
            if ($suffixLength <= 0) {
                header('Content-Range: bytes */' . $size);
                send_error(416, 'Requested range is not satisfiable.');
            }
            $start = max(0, $size - $suffixLength);
        } else {
            $start = (int) $match[1];
            if ($match[2] !== '') {
                $end = min((int) $match[2], $size - 1);
            }
        }

        if ($start > $end || $start >= $size) {
            header('Content-Range: bytes */' . $size);
            send_error(416, 'Requested range is not satisfiable.');
        }
        $status = 206;
    }

    $length = $end - $start + 1;
    $download = isset($_GET['download']) && $_GET['download'] === '1';
    $disposition = $download ? 'attachment' : 'inline';
    $fallbackName = str_replace(['"', "\r", "\n"], '', $selected['filename']);

    http_response_code($status);
    header('Content-Type: ' . $selected['mime']);
    header('Content-Length: ' . $length);
    header('Accept-Ranges: bytes');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    header("Content-Disposition: {$disposition}; filename=\"{$fallbackName}\"; filename*=UTF-8''" . rawurlencode($selected['filename']));
    if ($status === 206) {
        header("Content-Range: bytes {$start}-{$end}/{$size}");
    }

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') {
        exit;
    }

    $handle = fopen($path, 'rb');
    if ($handle === false) {
        send_error(500, 'Unable to open the file.');
    }
    fseek($handle, $start);
    $remaining = $length;
    while ($remaining > 0 && !feof($handle)) {
        $chunk = fread($handle, min(1024 * 1024, $remaining));
        if ($chunk === false) {
            break;
        }
        echo $chunk;
        $remaining -= strlen($chunk);
        if (connection_aborted()) {
            break;
        }
    }
    fclose($handle);
    exit;
}

$action = isset($_GET['action']) ? (string) $_GET['action'] : '';
$catalog = demo_catalog();

if ($action === 'manifest') {
    authorize_demo_request();
    manifest_response($catalog);
}
if ($action === 'file') {
    authorize_demo_request();
    file_response($catalog, isset($_GET['id']) ? (string) $_GET['id'] : '');
}
if ($action !== '') {
    send_error(404, 'Unknown action.');
}

$manifestUrl = json_encode(self_url() . '?action=manifest', JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>PrutViewer PHP demonstration</title>
    <link rel="stylesheet" href="./style.css">
    <link rel="stylesheet" href="./demo.css">
</head>
<body>
    <main data-demo-role="page">
        <header data-demo-role="header">
            <p data-demo-role="eyebrow">Framework-free PHP gateway</p>
            <h1>PrutViewer PHP demonstration</h1>
            <p>The PHP script discovers <?= count($catalog) ?> local sample files and serves them through a whitelisted endpoint with byte-range support.</p>
            <p data-demo-role="status" role="status">Initializing viewer…</p>
        </header>
        <section aria-label="Sample documents">
            <div data-viewer-demo></div>
        </section>
    </main>
    <script src="./script.js"></script>
    <script>
        (function () {
            'use strict';
            var container = document.querySelector('[data-viewer-demo]');
            var status = document.querySelector('[data-demo-role="status"]');
            var pdfJsBase = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174';
            var viewer = new PrutViewer(container, {
                manifestUrl: <?= $manifestUrl ?>,
                transport: { credentials: 'same-origin' },
                dependencies: {
                    pdf: {
                        core: pdfJsBase + '/build/pdf.js',
                        worker: pdfJsBase + '/build/pdf.worker.js',
                        viewer: pdfJsBase + '/web/pdf_viewer.js',
                        viewerCss: pdfJsBase + '/web/pdf_viewer.css'
                    }
                }
            });
            viewer.on('state:change', function (event) {
                status.textContent = 'Viewer state: ' + event.state;
            });
            viewer.init().catch(function (error) {
                status.textContent = error && error.message ? error.message : String(error);
            });
        }());
    </script>
</body>
</html>
