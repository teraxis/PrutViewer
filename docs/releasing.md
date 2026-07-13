# Releasing

1. Update the version in `package.json` and the `VERSION` constant/header in `script.js`.
2. Update documentation and schema only when the public contract changes.
3. Run `npm test` and `npm run build`.
4. Commit the source changes.
5. Create an annotated tag such as `v0.2.0` and push it.
6. GitHub Actions publishes the ZIP and checksum. Verify the release before updating consumers.

Do not commit `dist/`, `script.min.js`, or `style.min.css`. Do not move host-specific adapters into this repository; publish them as separate plugins when they become generic.
