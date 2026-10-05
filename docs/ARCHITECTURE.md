# Architecture

## Runtime model

Media Inspector is distributed as one HTML file. The page contains the application code plus gzip-compressed `ffmpeg.js` and `ffmpeg.wasm` from the pinned FFmpeg WASM Builder release. Runtime networking is blocked by CSP (`connect-src 'none'`). Both readable and self-extract packaging allow embedded WebAssembly via `wasm-unsafe-eval`; JavaScript `unsafe-eval` is not enabled. The wrapper policy also applies to the decoded app and its Blob Workers.

The selected media stays on the device. A Blob Worker initializes the compact FFmpeg core and mounts the browser `File` through Emscripten WORKERFS. The runner accepts only `--input` and `--output`, reads container/stream metadata, and writes a small JSON report to MEMFS. No decoder, encoder, filter, swscale, or swresample stage is used by the Media Inspector profile.

## Inspection ownership

Source inspection uses a monotonically increasing generation. Runtime loading has its own generation so Cancel or replacement during gzip expansion prevents Worker creation afterward. Each Worker callback closes over its own Worker and Blob URL; completion, error, or cancellation settles once and releases only that operation. Source generations are checked after inspection and native playback checks before publishing results. Metadata-cleaned copy verification uses the same Worker ownership helper.

## Technical report exports

JSON exports keep the complete report unchanged. The technical-summary formatter separately allowlists container/stream fields and produces localized UTF-8 text synchronously; it never serializes metadata or chapters. A summary-generation marker is published only after the existing inspection/browser-check flow completes. Reset clears the marker, and inspection-generation changes invalidate it, so an old report cannot be exported after replacement, cancellation or page exit. The download filename is sanitized and byte-bounded independently of the existing JSON filename behavior. The shared container-label helper uses detected names, preserving ambiguous format families instead of guessing from extensions.

## Build placeholders

`src/index.template.html` contains exactly three build-time placeholders:

- `__APP_CONFIG_JSON__`
- `__BUILD_MANIFEST_JSON__`
- `__EMBEDDED_ASSET_BUNDLE_JSON__`

`build-standalone.ps1` replaces each placeholder once and verifies the generated HTML. The embedded asset bundle stores gzip bytes as base64 only once; runtime JavaScript decodes and decompresses them locally.

## Dependency trust

`dependencies.json` pins FFmpeg WASM Builder v1.2.0 and the Media Inspector release asset. The build downloads the release checksum list, verifies the binary ZIP with SHA-256, and records the corresponding-source URL and hash in `dist/dependency-manifest.json`.

## Metadata cleaning

The pinned FFmpeg WASM `media-inspector` runner remains inspection-only and is not used to rewrite media. Supported metadata cleaning is implemented in browser JavaScript using `File.slice()` / `Blob` composition:

- ISO BMFF (MP4 / MOV / M4V / M4A): fixed-size metadata edits leave media payload offsets and `mdat` bytes unchanged.
- MP3: tag regions are excluded while audio-frame bytes are preserved.
- FLAC: the metadata-block chain is rebuilt without Vorbis Comment/Picture blocks, then the original audio frames are appended unchanged.
- WAV: the RIFF container is rebuilt without known metadata chunks while the original audio `data` chunk is copied unchanged.

The original file is never modified. The cleaned output filename is editable and defaults to the source basename plus `_metadata-cleaned`; its media extension is kept fixed. The result is re-inspected with the embedded FFmpeg core before download. The cleaner deliberately preserves chapter content, codec bitstreams, and dedicated data/telemetry stream payloads; the UI warns that such payloads can still contain titles, GPS, or device-specific information.

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
