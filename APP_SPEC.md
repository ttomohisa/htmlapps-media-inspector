# Media Inspector — App Specification

## Goal

Inspect common video/audio files locally and present technical media facts in a way that is useful to non-experts, while keeping the selected file on the device.

## Primary flow

1. User chooses or drops one media file.
2. The app automatically starts the compact FFmpeg WASM Media Inspector runner.
3. The browser `File` is mounted through WORKERFS; the app does not call `File.arrayBuffer()` for the input.
4. The runner writes `/report.json` containing format, stream, HDR, metadata, subtitle, chapter and audio information.
5. The app runs browser-side playback hints (`canPlayType()` and a local native media probe).
6. The result is shown as Media Doctor, overview, Video, Audio, subtitle/other and Details sections.
7. User can copy or save the structured JSON report.

## Required information

### Format
- container name / long name
- file size
- duration / start time
- total bitrate and whether it was reported or estimated
- stream / chapter / program / stream-group counts
- container metadata

### Video
- codec name / long name / FourCC
- profile / level / bitrate
- width / height
- frame rate
- pixel format
- sample aspect ratio
- field order
- color range / primaries / transfer / space / chroma location
- rotation
- HDR classification and available mastering/content-light/Dolby Vision/HDR10+ flags
- stream metadata / disposition

### Audio
- codec / profile / FourCC / bitrate
- sample rate
- channel count and layout
- whether a display layout was inferred from channel count
- sample format / bit depth fields / padding where available
- stream metadata / disposition

### Other
- subtitles and whether they are text or bitmap based
- other/data streams
- chapters
- raw report JSON
- runner / FFmpeg / Builder information

## Media Doctor

Media Doctor is advisory. It must not claim guaranteed compatibility. It combines FFmpeg facts with:
- `HTMLMediaElement.canPlayType()` using a best-effort MIME/codec string
- a native browser load test against a local Blob URL
- explanatory rules for HEVC, ProRes, AC-3/E-AC-3/DTS/TrueHD, HDR, high bit depth/chroma, MKV, and rotation metadata

## Privacy and runtime constraints

- Runtime CSP includes `connect-src 'none'`.
- No selected-media upload.
- No telemetry.
- No remote runtime dependencies.
- Direct `file://` usage is supported.
- Input uses WORKERFS.
- FFmpeg core runs inside a Blob Worker.
- FFmpeg release JavaScript and WASM are gzip-compressed and embedded into the standalone HTML.

## Mobile UX

At widths up to 600px, show a safe-area-aware five-item fixed bottom navigation:
- File
- Doctor
- Video
- Audio
- Details

Doctor / Video / Audio / Details start disabled and become available after successful inspection; Video/Audio remain disabled when that stream type does not exist.

## Languages

Japanese and English are included in the same HTML. Default is automatic based on browser language.

## Version

App: 1.0.0  
FFmpeg WASM Builder dependency: 1.2.0 / `media-inspector` profile
