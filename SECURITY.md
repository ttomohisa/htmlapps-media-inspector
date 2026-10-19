# Security

Media Inspector is designed for local-only processing.

- The generated HTML sets `connect-src 'none'`.
- Selected media is mounted through WORKERFS and is not uploaded by the app.
- Runtime FFmpeg JavaScript/WASM is embedded into the generated HTML.
- Release assets are pinned to a specific FFmpeg WASM Builder version and SHA-256 verified at build time.
- Media metadata is untrusted input and must be rendered as text/escaped HTML rather than injected as markup.

For a security-sensitive bug, avoid attaching private media. Provide a minimal synthetic reproducer when possible.


## Input and cancellation safety

Version 1.0.5 bounds report expansion, cleaner structure counts, zero-fill output and computation time. Cleaning uses detected container names; malformed or unsupported inputs fail without changing the original. Cancellation prevents a later save, including during reinspection. It cannot revoke an already-started browser download or stop an OS read internally; results of cancelled reads are discarded.

The complete JSON export deliberately includes original metadata. The technical-summary TXT excludes arbitrary metadata and chapter names. All export filenames remove path/control/direction characters and have byte-bounded stems. Metadata values are HTML-escaped and raw JSON is assigned as text.

## Dependency review, 2026-10-19

The embedded dependency remains Builder v1.2.0, pinned to FFmpeg n9.0.1 (bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa). The official n9.0.2 changelog includes Ogg allocation-overflow checks and MOV keys-atom count bounds, which are relevant to demuxers enabled in the inspection profile. Their exploitability in this WASM build has not been established. A separate Builder/core update should evaluate those fixes, rebuild the restricted profile, verify corresponding-source provenance and regression-test supported media. This patch does not claim to resolve all parser vulnerabilities.

- Current pin: https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder/blob/v1.2.0/versions.env
- Enabled profile: https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder/blob/v1.2.0/profiles/media-inspector/ffmpeg.flags
- Upstream changes: https://github.com/FFmpeg/FFmpeg/blob/n9.0.2/Changelog

The build already verifies downloaded archives against SHA256SUMS.txt. Both currently come from the same GitHub Release, so this detects corruption but is not independent protection from a compromised release publisher. A repository-pinned archive digest or verified signed provenance, plus checking cached extracted assets, is deferred to the dependency follow-up. Runtime networking remains blocked and no CDN, upload or telemetry was added.
