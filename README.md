# Media Inspector

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-media-inspector/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-media-inspector/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-media-inspector/)

[日本語版 README](README.ja.md)

A privacy-focused single-HTML media inspector for checking codecs, frame rate, bitrate, HDR, audio, subtitles, chapters, metadata, and browser playback hints without uploading the selected file.

## 🚀 Live demo

### [Open Media Inspector on GitHub Pages](https://ttomohisa.github.io/htmlapps-media-inspector/)

GitHub Pages delivers the initial HTML. After it loads, inspection runs locally with the embedded FFmpeg WebAssembly core. The selected media is not uploaded by the app.

## Features

- Inspect MP4 / MOV / MKV / WebM / AVI / MPEG-TS and common audio containers
- Show file size, duration, total bitrate, stream counts, and chapters
- Show video codec, profile, level, resolution, frame rate, pixel format, color information, bitrate, and rotation
- Detect HDR-related information such as PQ / HLG, mastering display metadata, content light level, Dolby Vision, and HDR10+
- Show audio codec, sample rate, channel count/layout, bitrate, and sample format
- List subtitle and other streams
- Show container, stream, and chapter metadata
- **Media Doctor** combines media facts with `canPlayType()` and a local native media probe to highlight likely browser-playback concerns
- Copy or save the structured inspection report as JSON
- Japanese and English UI in the same HTML
- Smartphone bottom navigation for File / Doctor / Video / Audio / Details
- WORKERFS input so the selected `File` is not copied wholesale into JavaScript memory before inspection
- No decoder, encoder, transcoding, or media upload

## Quick start

### Use the web demo

Open the demo and choose a video or audio file. No account or installation is required.

### Build the standalone file

1. Download or clone this repository.
2. Double-click `build-standalone.bat` on Windows.
3. The first build downloads the pinned FFmpeg WASM Builder v1.2.0 Media Inspector release asset and verifies its SHA-256 checksum.
4. Open `dist/index.html` directly, or use the generated `media-inspector.html`.
5. `dist/index.self-extract.html` is also generated for convenient single-file distribution.

Python, Node.js, and a local web server are not required. The build uses Windows PowerShell and built-in Windows tooling.

## Usage

1. Choose or drop a media file.
2. Wait for the local inspection to complete.
3. Check **Media Doctor** for browser-playback hints.
4. Review the Video, Audio, and subtitle/other stream cards.
5. Open **Details** for metadata, chapters, the raw JSON report, and engine information.
6. Copy or save the report JSON if needed.

## Media Doctor

Media Doctor is intentionally advisory. It combines the file facts reported by FFmpeg with `HTMLMediaElement.canPlayType()` and a local attempt to load the selected Blob URL in the browser's native `<video>` or `<audio>` element.

It can highlight HEVC, ProRes, AC-3/E-AC-3/DTS/TrueHD, HDR, high-bit-depth/chroma formats, MKV, rotation metadata, and native playback errors. Browser support still varies with the operating system, hardware decoders, GPU, and installed codecs, so Media Doctor is not a playback guarantee.

## Publish with GitHub Pages

The repository includes a workflow that builds the standalone HTML and deploys `dist/` to GitHub Pages.

1. Push the repository to GitHub as `htmlapps-media-inspector`.
2. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Push to `main`, or rerun **Deploy standalone app to GitHub Pages** from Actions.
4. After deployment, the app is available at `https://ttomohisa.github.io/htmlapps-media-inspector/`.

If Pages is not enabled yet, the workflow still validates the standalone build and reports the one-time setup steps instead of failing at `configure-pages`.

## Development and build layout

```text
.
├─ src/index.template.html       # Application template
├─ app.config.json               # App identity and build settings
├─ dependencies.json             # Pinned FFmpeg WASM Builder release
├─ build-standalone.bat          # Windows build entry point
├─ build-standalone.ps1          # Release verification + embedding
├─ components/                   # Reusable dialog/mobile navigation references
├─ scripts/                      # Repository and generated-file verification
└─ .github/workflows/            # Build validation and Pages deployment
```

The build downloads `SHA256SUMS.txt` from the same Builder release, verifies `ffmpeg-wasm-media-inspector-v1.2.0.zip`, embeds `ffmpeg.js.gz` and `ffmpeg.wasm.gz`, and records the binary and corresponding-source hashes in `dist/dependency-manifest.json`.

The gzip bytes are base64-encoded only once in the standalone HTML. At runtime they are expanded locally using `DecompressionStream('gzip')`.

## Privacy and runtime network protection

The generated app uses a Content Security Policy with `connect-src 'none'`. The selected media is mounted into FFmpeg through Emscripten WORKERFS and remains local to the browser session.

GitHub Pages requires the initial HTML request, but the app itself does not upload the selected media or inspection report. For completely disconnected use, open the built `dist/index.html` locally.

## Limitations

- The compact Media Inspector core does not decode video or audio frames. It reads container and stream information, so some codec details may be unavailable when they are not exposed by the file headers.
- Media Doctor is a compatibility hint, not a guarantee.
- Damaged or unusual files may fail to probe.
- Some metadata can be missing, vendor-specific, or stored in a form not surfaced by the compact profile.
- Large files avoid a whole-file JavaScript copy through WORKERFS, but inspection still consumes browser and WASM memory.
- `DecompressionStream('gzip')` is required to expand the embedded compact core at runtime.

## Dependency

| Component | Version | License | Purpose |
| --- | ---: | --- | --- |
| FFmpeg WASM Builder / Media Inspector core | 1.2.0 | Generated core: LGPL-2.1-or-later | Local container and stream inspection |

The application source is MIT licensed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for FFmpeg notices, release assets, checksums, and corresponding-source information.

## Contributing

Bug reports and feature proposals are welcome through GitHub Issues. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance.

## License

Copyright © 2026 ttomohisa

Application source is licensed under the [MIT License](LICENSE). The generated FFmpeg core has its own LGPL-2.1-or-later terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
