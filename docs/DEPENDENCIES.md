# Dependencies

Media Inspector pins its FFmpeg WebAssembly core through `dependencies.json`. Runtime CDN loading is not used.

## Current dependency

```json
{
  "id": "ffmpeg-wasm-builder",
  "source": "github-release",
  "repository": "ttomohisa/htmlapps-ffmpeg-wasm-builder",
  "version": "1.2.0",
  "releaseAsset": "ffmpeg-wasm-media-inspector-v{version}.zip",
  "checksumsAsset": "SHA256SUMS.txt",
  "sourceAsset": "ffmpeg-wasm-sources-v{version}.tar.gz"
}
```

The app embeds `ffmpeg.js.gz` and `ffmpeg.wasm.gz` from that release. The build downloads `SHA256SUMS.txt`, verifies the binary archive before extraction, and records both the binary archive hash and corresponding-source hash in `dist/dependency-manifest.json`.

## Runtime behavior

The verified gzip assets are base64-encoded once in the generated HTML. At runtime they are decoded locally and expanded with `DecompressionStream('gzip')`. The selected media file is mounted through Emscripten WORKERFS, so the app does not make a whole-file JavaScript copy before inspection.

## Updating the core

1. Publish and verify a new `media-inspector` profile release in `htmlapps-ffmpeg-wasm-builder`.
2. Change the single `version` value in `dependencies.json`.
3. Run `build-standalone.bat -ForceDownload`.
4. Run `scripts/check-repository.ps1 -ForceDownload` before publishing.
5. Review `THIRD_PARTY_NOTICES.md` if licenses or bundled components changed.

Do not replace the pinned release with an arbitrary CDN URL. The standalone application is designed to make no runtime network requests.
