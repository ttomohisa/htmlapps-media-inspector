# Media Inspector

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-media-inspector/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-media-inspector/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-media-inspector/)

[日本語版 README](README.ja.md)

A privacy-focused, single-HTML app for inspecting video and audio files entirely in the browser. It reports the container, codecs, bitrate, frame rate, pixel format, HDR/color information, audio layout, metadata, chapters, subtitles, rotation, and more without uploading the selected file to a server.

Media Inspector also includes **Media Doctor**, which combines the FFmpeg inspection result with signals from the browser you are currently using. It helps answer questions such as **“What is inside this file?”** and **“Why might this video fail to play in my browser?”** without turning the app into a transcoder or repair tool.

## 🚀 Live demo

### [Open Media Inspector on GitHub Pages](https://ttomohisa.github.io/htmlapps-media-inspector/)

GitHub Pages delivers the initial HTML. After it loads, the selected media file is inspected locally with the embedded FFmpeg 9 WebAssembly core. The file contents, metadata, and generated inspection report are not uploaded by the app.

## Features

- Inspect video and audio files entirely in the browser
- Show container, file size, duration, total bitrate, stream count, chapter count, and probe score
- Show every detected Video, Audio, Subtitle, Data, and Attachment stream
- Video details: codec, FourCC/tag, profile, level, bitrate, resolution, FPS, pixel format, SAR, field order, and rotation
- Color/HDR details: color range, primaries, transfer function, color space, HDR classification, mastering-display metadata, MaxCLL / MaxFALL, Dolby Vision, and HDR10+ indicators when available
- Audio details: codec, profile, bitrate, sample rate, channel count, channel layout, sample format, and duration
- File-level and stream-level metadata
- Chapter list with start/end times and titles when present
- Subtitle classification, including text-based / bitmap-based information when available
- **Media Doctor** with browser-specific playback hints
- Combine FFmpeg data with `canPlayType()` and a local native `<video>` / `<audio>` load probe
- Warn about common compatibility factors such as HEVC, AV1, unusual containers, HDR, rotation metadata, or weak browser support signals
- Copy the complete inspection report as JSON
- Save the complete inspection report as a `.json` file
- Confirm before replacing an existing report with another file
- Japanese and English UI in the same HTML
- Responsive desktop and mobile layout
- Smartphone bottom navigation for File / Doctor / Video / Audio / Details
- Embedded SVG favicon
- WORKERFS input so the selected file is not copied wholesale into WASM memory
- Gzip-compressed embedded FFmpeg JavaScript and WebAssembly
- Runtime Content Security Policy with `connect-src 'none'`
- Build both `dist/index.html` and `dist/index.self-extract.html`

## Quick start

### Use the web demo

Just [open the demo](https://ttomohisa.github.io/htmlapps-media-inspector/). No installation or account is required.

### Use it fully offline (advanced)

1. Download or clone this repository.
2. Run `build-standalone.bat` on Windows.
3. The first build downloads the exact FFmpeg WASM Builder v1.2.0 release assets pinned in `dependencies.json`.
4. The builder verifies the release archive against the published `SHA256SUMS.txt` before embedding it.
5. Copy the generated `dist/index.html` wherever you need it.
6. Open that single file later without an internet connection.

```powershell
.\build-standalone.bat
```

Python, Node.js, and a local web server are not required for the normal Windows build.

## Usage

1. Choose a video or audio file, or drop it onto the file area.
2. Media Inspector mounts the browser `File` into the FFmpeg Worker through WORKERFS and starts inspection automatically.
3. Check **Media Doctor** first if you are troubleshooting browser playback.
4. Review **Basic information** for the container, duration, bitrate, and stream counts.
5. Review the **Video** and **Audio** cards for codec-specific details.
6. Open **Subtitles & other** when the file contains additional streams.
7. Open **Details** to review metadata, chapters, the complete raw JSON report, and engine information.
8. Use **Copy JSON** or **Save JSON** when you need the structured result outside the app.

### What Media Inspector reports

| Section | Typical information |
| --- | --- |
| **Basic information** | Container, file size, duration, total bitrate, start time, stream count, chapter count, probe score |
| **Video** | Codec, FourCC, profile, level, bitrate, dimensions, FPS, pixel format, SAR, field order, rotation, color/HDR information |
| **Audio** | Codec, profile, bitrate, sample rate, channels, channel layout, sample format, duration |
| **Subtitles & other** | Subtitle, data, attachment, and other stream types plus stream metadata |
| **Details** | File metadata, chapters, raw inspection JSON, FFmpeg / runner / dependency information |

Not every file contains every field. Missing information is shown as unavailable rather than guessed, except for the explicitly marked two-channel layout fallback described under Limitations.

## Media Doctor

Media Doctor is deliberately more than an `ffprobe`-style information screen. It turns the inspection result into browser-specific troubleshooting hints.

It uses three kinds of evidence:

1. **FFmpeg inspection data** — container, codec, profile, HDR information, rotation, and related technical properties.
2. **`canPlayType()`** — the current browser's support signal for an estimated MIME type and codec combination.
3. **A local native media-element probe** — the selected `File` is loaded into a local `<video>` or `<audio>` element through a Blob URL to see whether the current browser can at least read metadata or reach a playable state.

The result is a hint, not a universal compatibility guarantee. Playback can still depend on the exact browser build, operating-system codecs, hardware acceleration, device capabilities, and the encoded bitstream itself.

Typical guidance includes cases such as:

- HEVC / H.265 may not be available in every browser or OS combination
- AV1 support can vary by browser version and hardware
- HDR playback depends on the browser, OS, GPU, display, and transfer-function support
- Rotation metadata can make coded dimensions differ from presentation orientation
- A container may be recognized by FFmpeg even when the browser cannot natively play it

Media Doctor does **not** upload the file and does **not** attempt to transcode or repair it.

## How inspection works

Media Inspector does not bundle the full FFmpeg command-line application. It uses a purpose-built `media-inspector` core from [FFmpeg WASM Builder](https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder) v1.2.0.

1. The browser `File` is mounted into the Worker with Emscripten WORKERFS.
2. The lightweight FFmpeg runner opens the media container and reads stream information.
3. Public `libavformat`, `libavcodec`, and `libavutil` APIs extract format, codec, timing, metadata, chapter, color, HDR, rotation, and channel-layout information.
4. No frame decoder, encoder, filter, swscale, or swresample pipeline is included in the inspection core.
5. The runner writes only a small structured JSON report to MEMFS.
6. The browser UI renders that report into readable cards.
7. Media Doctor adds current-browser compatibility signals without changing the original report.

Because the input stays mounted as a browser `File`, the app avoids calling `File.arrayBuffer()` on the entire selected media file just to place it in WASM memory.

## Publish with GitHub Pages

The repository includes a workflow that builds the fully embedded HTML and deploys it to GitHub Pages automatically.

1. Push the repository to GitHub as `htmlapps-media-inspector`.
2. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Push to `main`, or manually run the deployment workflow from the Actions tab.
4. After a successful deployment, the app is available at `https://ttomohisa.github.io/htmlapps-media-inspector/`.

If Pages is not enabled yet, the workflow still builds and verifies the standalone artifacts and skips only the deployment step. Enable GitHub Actions as the Pages source, then re-run the workflow.

Each push to `main` rebuilds the standalone HTML from the pinned FFmpeg release assets, runs the repository checks, uploads the build artifacts, and publishes `dist/` only after those checks pass.

## Development and build layout

```text
.
├─ src/index.template.html            # Application template
├─ app.config.json                    # App metadata, version, and output settings
├─ dependencies.json                  # Pinned FFmpeg WASM Builder release
├─ build-standalone.bat               # Windows build entry point
├─ build-standalone.ps1               # Single-HTML builder
├─ components/
│  ├─ confirm-dialog.html             # Reusable confirmation dialog reference
│  └─ mobile-bottom-bar.html          # Reusable smartphone bottom-bar reference
├─ scripts/
│  ├─ check-repository.ps1            # Repository-wide build validation
│  ├─ verify-standalone.ps1           # Standard HTML verification
│  ├─ build-self-extract.ps1          # Gzip self-extracting HTML builder
│  └─ verify-self-extract.ps1         # Self-extract verification
├─ dist/
│  ├─ index.html                      # Generated standalone application
│  ├─ index.self-extract.html         # Generated gzip self-extracting variant
│  └─ dependency-manifest.json        # Verified dependency information
├─ media-inspector.html               # Generated root copy of dist/index.html
└─ .github/workflows/
   ├─ build-standalone.yml            # Pull-request build validation
   └─ deploy-pages.yml                # Automatic Pages deployment from main
```

Do not edit generated HTML directly. Edit `src/index.template.html` and rebuild.

### Update the FFmpeg dependency

The app currently pins FFmpeg WASM Builder v1.2.0 and its `media-inspector` release asset in `dependencies.json`.

After changing the pinned version, rebuild the app. To discard the local package cache and download the release again:

```powershell
.\build-standalone.bat -ForceDownload
```

The build process automatically:

- Downloads `SHA256SUMS.txt` from the pinned Builder release
- Downloads `ffmpeg-wasm-media-inspector-v1.2.0.zip`
- Verifies the binary release archive SHA-256 before using it
- Confirms the matching corresponding-source archive is listed in the release checksum file
- Embeds `ffmpeg.js.gz` and `ffmpeg.wasm.gz` into the single HTML
- Records resolved release, archive hash, corresponding-source hash, and source URL in `dist/dependency-manifest.json`
- Rejects unexpected runtime external script, stylesheet, frame, CSS URL, or module references
- Verifies `connect-src 'none'`
- Generates `media-inspector.html` as the repository-root distribution copy
- Generates `dist/index.self-extract.html`
- Verifies that the self-extracting payload restores the standard HTML byte-for-byte

## Privacy and runtime network protection

The generated HTML is designed so inspection does not depend on a runtime server.

- Content Security Policy contains `connect-src 'none'`
- FFmpeg JavaScript and WebAssembly are embedded in the HTML
- Embedded gzip assets are expanded locally with `DecompressionStream`
- The selected media file is mounted locally with WORKERFS
- Media Doctor uses local browser APIs and local Blob URLs
- The generated JSON report stays in the browser unless you explicitly copy or save it
- No analytics, telemetry, login, cloud storage, or remote fonts are used by the app

The GitHub Pages version requires an initial HTML request, but the media file you select and the inspection result are not transmitted by the app.

For use with the network completely disconnected, open the generated `dist/index.html` locally.

## Limitations

- Inspection support is limited to the demuxers and parsers enabled in the FFmpeg WASM Builder `media-inspector` profile.
- Corrupt, encrypted, or unsupported containers may fail to open.
- Some fields are unavailable when the container or stream does not store them.
- The inspection core does not decode frames, so information that requires full decoding is intentionally outside the scope of this app.
- If a file reports only a two-channel count without an explicit channel layout, the UI can show FFmpeg's canonical default `stereo`; the JSON marks that fallback with `channelLayoutInferred: true` and keeps the originally reported layout separately.
- Media Doctor is specific to the browser/device running the app and is not a cross-platform playback guarantee.
- Native playback support may change with browser, OS, or hardware updates even when the file itself does not change.
- The app does not repair, convert, transcode, normalize, or edit media files.
- The standard HTML uses `DecompressionStream('gzip')`; a current Chrome, Edge, Firefox, or Safari release is recommended.

## Dependencies

| Component | Version | License | Purpose |
| --- | ---: | --- | --- |
| FFmpeg WASM Builder `media-inspector` core | 1.2.0 | Generated core: LGPL-2.1-or-later | Local container and stream inspection |

The application source is separate from the generated FFmpeg core. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for redistribution details, the corresponding-source archive, and dependency licensing information.

## Contributing

Bug reports and feature proposals are welcome through GitHub Issues. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance.

## License

Copyright © 2026 ttomohisa

Application source is licensed under the [MIT License](LICENSE). The embedded generated FFmpeg core is distributed under its separate LGPL terms described in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
