# Security

Media Inspector is designed for local-only processing.

- The generated HTML sets `connect-src 'none'`.
- Selected media is mounted through WORKERFS and is not uploaded by the app.
- Runtime FFmpeg JavaScript/WASM is embedded into the generated HTML.
- Release assets are pinned to a specific FFmpeg WASM Builder version and SHA-256 verified at build time.
- Media metadata is untrusted input and must be rendered as text/escaped HTML rather than injected as markup.

For a security-sensitive bug, avoid attaching private media. Provide a minimal synthetic reproducer when possible.
