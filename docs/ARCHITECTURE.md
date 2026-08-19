# Architecture

## Runtime model

Media Inspector is distributed as one HTML file. The page contains the application code plus gzip-compressed `ffmpeg.js` and `ffmpeg.wasm` from the pinned FFmpeg WASM Builder release. Runtime networking is blocked by CSP (`connect-src 'none'`).

The selected media stays on the device. A Blob Worker initializes the compact FFmpeg core and mounts the browser `File` through Emscripten WORKERFS. The runner accepts only `--input` and `--output`, reads container/stream metadata, and writes a small JSON report to MEMFS. No decoder, encoder, filter, swscale, or swresample stage is used by the Media Inspector profile.

## Build placeholders

`src/index.template.html` contains exactly three build-time placeholders:

- `__APP_CONFIG_JSON__`
- `__BUILD_MANIFEST_JSON__`
- `__EMBEDDED_ASSET_BUNDLE_JSON__`

`build-standalone.ps1` replaces each placeholder once and verifies the generated HTML. The embedded asset bundle stores gzip bytes as base64 only once; runtime JavaScript decodes and decompresses them locally.

## Dependency trust

`dependencies.json` pins FFmpeg WASM Builder v1.2.0 and the Media Inspector release asset. The build downloads the release checksum list, verifies the binary ZIP with SHA-256, and records the corresponding-source URL and hash in `dist/dependency-manifest.json`.

## Media Doctor

The FFmpeg runner reports media facts. Browser compatibility guidance is intentionally computed in the app rather than hard-coded into WASM. Media Doctor combines codec/container facts with `HTMLMediaElement.canPlayType()` and a local native media probe. Its result is advisory rather than a guarantee because browser, operating-system, and hardware codec support can differ.

## Reusable UI

`components/confirm-dialog.html` documents the confirmation-dialog pattern used before replacing an existing report. `components/mobile-bottom-bar.html` documents the safe-area-aware mobile navigation pattern used by the five-item File / Doctor / Video / Audio / Details bar.

## Outputs

A normal build creates:

- `dist/index.html`
- `dist/index.self-extract.html`
- `dist/dependency-manifest.json`
- `dist/self-extract-manifest.json`
- `media-inspector.html` (same bytes as `dist/index.html`)
