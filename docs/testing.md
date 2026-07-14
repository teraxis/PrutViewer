# Testing

Install dependencies and Chromium once:

```bash
npm install
npx playwright install chromium
```

Run the full verification:

```bash
npm test
```

The suite checks JavaScript syntax, package and schema metadata, forbidden host-specific coupling, signed-URL and bearer-header behavior, the classless DOM contract, renderer/plugin cleanup, child-viewer lifecycle, direct `file://` demo startup, and completeness of the checked-in demonstration catalogs.

The sample PDFs can be inspected independently with `pdfinfo` and a Poppler renderer. The repository validator confirms that every file in `tests/pdf` and every demonstration video in `docs/images` is represented by `demo-manifest.json`.

The validator also confirms that every local PDF has a byte-exact Base64 representation in `demo-pdf-data.js`. Regenerate the local catalog and data after changing the manifest or any PDF fixture:

```bash
npm run build:demo-data
```

If PHP is available, lint the standalone example separately:

```bash
php -l demo.php
```

Build release assets separately:

```bash
npm run build
```

The generated `dist/` directory is disposable and ignored by Git.
