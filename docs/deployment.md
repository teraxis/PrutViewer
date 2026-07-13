# Distribution and Deployment

PrutViewer is a static browser library and does not require a server process. Serve `script.js` and the optional `style.css`, or bundle `index.mjs` in an application.

Source files remain readable during development. `npm run build` creates `dist/script.min.js` and `dist/style.min.css`; these files are generated artifacts and are not committed.

Pushing a `v*` tag runs tests, builds the distribution, creates a ZIP plus SHA-256 checksum, and publishes a GitHub release. Consumers should pin an immutable tag or release checksum instead of tracking `main`.

Host deployments remain responsible for authorization, secure cookies, CORS, object-storage policy, CSP, cache headers, and Range-capable streaming endpoints.
