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

The suite checks JavaScript syntax, package and schema metadata, forbidden host-specific coupling, signed-URL and bearer-header behavior, the classless DOM contract, renderer/plugin cleanup, and child-viewer lifecycle.

Build release assets separately:

```bash
npm run build
```

The generated `dist/` directory is disposable and ignored by Git.
