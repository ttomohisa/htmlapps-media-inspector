# Changelog

## 1.0.2 - 2026-10-09

- Prepare the maintenance build for an English catalog screenshot, preserving app behavior and the supplied icon.

## 1.0.1 - 2026-10-06

- Standardize the local-processing badge and compact EN / JA target-language control, including localized accessible names, titles, and Help.
- Keep application processing, data formats, privacy boundaries, dependencies, and layouts unchanged.
- Add source and generated-artifact header regressions. Real-browser verification is tracked separately.


## Unreleased

- Add Japanese/English UTF-8 technical-summary downloads for the current successful report, with sanitized filenames and metadata/chapter-title exclusion.
- Use detected format families for container labels instead of trusting filename extensions; preserve ambiguous and unavailable formats explicitly.
- Cover text-export contents, lifecycle, download failures, filenames and container regressions across source and all release artifacts.

- Keep JSON copy tied to the requested report and latest copy operation; obsolete fallback and feedback cannot affect a replacement report.
- Report clipboard fallback failure accurately, remove temporary controls and restore focus, with Japanese/English Save JSON guidance.
- Round displayed durations with correct second/minute/hour carries and show unknown durations as `—` without changing raw JSON.
- Add source-level report regressions to repository checks for source and all three release artifacts.

- Allow embedded WebAssembly in the self-extract wrapper CSP while keeping JavaScript eval and network access blocked; added a real-runtime WAV regression.

- Fixed inspection cancellation during embedded runtime expansion and stale Worker/native probe results after source replacement.
- Settle cancelled Worker operations and release each operation’s own Worker and Blob URL.
- Added browser regressions for cold cancellation, source replacement, obsolete callbacks, and native probe completion.

## 1.0.0 - 2026-08-19

- Added the first Media Inspector release.
- Added local FFmpeg WASM inspection for format, video, audio, subtitles, chapters, metadata, HDR and rotation information.
- Added metadata removal and cleaned-copy export for MP4 / MOV / M4V / M4A / MP3 / FLAC / WAV without media re-encoding, plus automatic re-inspection before download.
- Added an editable cleaned-output filename (default: source basename + `_metadata-cleaned`) and a clearer smartphone-first save panel.
- Added Media Doctor with browser playback hints from file facts, `canPlayType()` and a local native media probe.
- Added JSON copy/save actions and Japanese/English UI.
- Added a five-item smartphone bottom navigation, with the metadata clean/save action promoted to the rightmost primary action on mobile.
- Pinned FFmpeg WASM Builder v1.2.0 Media Inspector release with SHA-256 verification and corresponding-source metadata.
- Embedded gzip JavaScript/WASM assets and used WORKERFS for large local inputs.
