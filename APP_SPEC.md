# Media Inspector — App Specification

## Goal

Inspect common video/audio files locally and present technical media facts in a way that is useful to non-experts. For supported containers, create a new copy with personal metadata removed while keeping the original file unchanged.

## Primary flow

1. User chooses or drops one media file.
2. The app automatically starts the compact FFmpeg WASM Media Inspector runner.
3. The browser `File` is mounted through WORKERFS; the app does not call `File.arrayBuffer()` for the whole inspection input.
4. The runner writes `/report.json` containing format, stream, HDR, metadata, subtitle, chapter and audio information.
5. The app runs browser-side playback hints (`canPlayType()` and a local native media probe).
6. The result is shown as Media Doctor, metadata cleaner, overview, Video, Audio, subtitle/other and Details sections.
7. For MP4 / MOV / M4V / M4A / MP3 / FLAC / WAV, the user can create a cleaned copy without re-encoding the audio/video payload. On smartphones, the clean/save action is exposed directly in the fixed bottom action bar; the filename editor remains in the cleaner section.
8. Before download, the cleaned copy is re-inspected with the same FFmpeg WASM inspector. If privacy-like metadata is still detected, the app warns instead of claiming complete removal.
9. User can copy or save the structured JSON report independently of metadata cleaning.

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

## Metadata cleaner

The cleaner is intentionally conservative about encoded media payloads and does not use the inspection-only FFmpeg core as a transcoder.

Supported save formats:
- MP4 / MOV / M4V / M4A: preserve box sizes and media payloads, clear movie/track/media creation/modification times, remove `meta` / user-data metadata and XMP-style metadata where recognized, and preserve playback-critical structures such as track matrices and codec configuration.
- MP3: remove leading ID3v2 plus trailing ID3v1 / APEv2 tags when present.
- FLAC: rebuild the metadata-block chain without Vorbis Comment and Picture blocks; FLAC audio frames are copied unchanged.
- WAV: rebuild RIFF/WAVE without common metadata chunks (`LIST/INFO`, BEXT, iXML, AXML, XMP, ID3, CART, DISP, EXIF); the `data` chunk is copied unchanged. RF64 cleaning is not enabled.

Cleaning rules:
- Always create a new Blob/File; never overwrite the selected source.
- Provide an editable output filename. Default to the source basename plus `_metadata-cleaned` while keeping the output extension fixed to the supported media format.
- Do not transcode or decode media frames.
- Preserve playback-critical information such as MP4 rotation matrices, HDR/color configuration and codec configuration.
- Preserve chapter content, codec bitstreams, and dedicated data/telemetry stream payloads. Those areas can contain titles, GPS or other device-specific information that this cleaner cannot safely remove without remuxing or rewriting stream payloads.
- Re-inspect the generated copy before download and warn if privacy-candidate metadata remains or verification fails.

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
- Inspection input uses WORKERFS.
- FFmpeg core runs inside a Blob Worker.
- FFmpeg release JavaScript and WASM are gzip-compressed and embedded into the standalone HTML.
- Metadata-cleaning output is assembled browser-side from slices of the selected `File`; no runtime network request is needed.

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
