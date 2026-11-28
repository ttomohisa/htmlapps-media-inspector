# Offline verification

1. Download and extract the distribution ZIP from the latest GitHub Release, or run `build-standalone.bat` from the source checkout while online.
2. Confirm `dist/index.html` and `dist/index.self-extract.html` were generated.
3. Disconnect networking.
4. Open `dist/index.html` directly with `file://`. Repeat the checks with `dist/index.self-extract.html`.
5. Inspect a local video or audio file.
6. Confirm Media Doctor, stream cards and JSON export work.
7. In browser developer tools, confirm the application makes no runtime network requests. The CSP should contain `connect-src 'none'`.

The initial build itself requires network access only to retrieve the pinned GitHub Release assets and checksum list. Runtime inspection does not.
