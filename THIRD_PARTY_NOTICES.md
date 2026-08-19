# Third-Party Notices

Media Inspector application source is licensed under the repository MIT License.

## FFmpeg WASM Builder / Media Inspector profile

- Builder repository: `ttomohisa/htmlapps-ffmpeg-wasm-builder`
- Builder release: `v1.2.0`
- Binary release asset: `ffmpeg-wasm-media-inspector-v1.2.0.zip`
- Embedded assets: `ffmpeg.js.gz`, `ffmpeg.wasm.gz`
- Corresponding-source asset: `ffmpeg-wasm-sources-v1.2.0.tar.gz`
- Generated Media Inspector core license: LGPL-2.1-or-later
- FFmpeg version used by the Builder release: n9.0.1
- Emscripten version used by the Builder release: 6.0.6

The standalone build downloads `SHA256SUMS.txt` from the same GitHub Release, verifies the Media Inspector binary archive before embedding it, and records both the binary archive SHA-256 and the corresponding-source SHA-256/URL in `dist/dependency-manifest.json`.

The compact Media Inspector profile links public FFmpeg libraries required for probing container and stream metadata. It does not link x264 and does not include a decoder, encoder, filter, swscale, or swresample stage.

The release's corresponding-source archive and its own notices should be retained when redistributing the generated FFmpeg core outside this repository.
