# Offline verification

1. Run `build-standalone.bat` while online once so the pinned FFmpeg WASM Builder release can be downloaded and verified.
2. Confirm `dist/index.html` and `dist/index.self-extract.html` were generated.
3. Disconnect networking.
4. Open `dist/index.html` directly with `file://`.
5. Inspect a local video or audio file.
6. Confirm Media Doctor, stream cards and JSON export work.
7. In browser developer tools, confirm the application makes no runtime network requests. The CSP should contain `connect-src 'none'`.

The initial build itself requires network access only to retrieve the pinned GitHub Release assets and checksum list. Runtime inspection does not.
