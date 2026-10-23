# Changelog

## Unreleased

### Changed
- Hide the informational page footer at the existing 600px smartphone breakpoint without hiding the functional bottom controls.

## 1.0.5 - 2026-10-19

- Publish replacement results atomically after native checks; keep cancellation available until completion.
- Select metadata cleaners from detected containers and correct mismatched output extensions and MIME types.
- Keep ambiguous Matroska/WebM MIME support unknown instead of assuming WebM.
- Add cancellation and ownership checks for cleaning, file reads and cleaned-copy verification.
- Bound report expansion, cleaning time, box/chunk counts and MP4 zero-fill work; reject ambiguous malformed containers safely.
- Apply Unicode-safe bounded filenames to every export and keep inspection errors visible.
- Add focused lifecycle, malformed-input and byte-preservation regressions without new CI jobs.
- Keep the drop area plain white without decorative or hover tint; retain border feedback and a visible keyboard-focus outline.

- Clarify Japanese and English help by removing internal layout, implementation, and audit commentary while preserving usage guidance and cautions.

## 1.0.4 - 2026-10-10

- Keep help and confirmation dialogs inside short or zoomed viewports, with scrollable content and reachable close controls.
- Prevent background-page scrolling while a modal is open; restore normal scrolling on dismissal.
- Close Help when its backdrop is clicked.
- Add source-level layout and dismissal regressions to the canonical repository check.

## 1.0.3 - 2026-10-09

- Normalize the app icon background to `#16624f` with 25% corner radii, and keep the asset, header and favicon consistent without changing the artwork.

## 1.0.2 - 2026-10-09

- Add a real English catalog screenshot and use it in the English README, preserving app behavior and the supplied icon.

## 1.0.1 - 2026-10-06

- Standardize the local-processing badge and compact EN / JA target-language control, including localized accessible names, titles, and Help.
- Keep application processing, data formats, privacy boundaries, dependencies, and layouts unchanged.
- Add source and generated-artifact header regressions. Real-browser verification is tracked separately.


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

