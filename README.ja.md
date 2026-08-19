# Media Inspector

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-media-inspector/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-media-inspector/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-media-inspector/)

[English README](README.md)

動画・音声のコーデック、FPS、ビットレート、HDR、音声、字幕、チャプター、メタデータなどを、ファイルを外部へアップロードせずブラウザ内だけで確認できる単一HTMLアプリです。

## 🚀 デモ

### [GitHub PagesでMedia Inspectorを開く](https://ttomohisa.github.io/htmlapps-media-inspector/)

GitHub Pagesから最初のHTMLを読み込んだ後、解析はHTML内に埋め込まれたFFmpeg WebAssemblyで端末内処理されます。選択した動画・音声がアプリからサーバーへ送信されることはありません。

## 主な機能

- MP4 / MOV / MKV / WebM / AVI / MPEG-TSや一般的な音声コンテナを解析
- ファイルサイズ、長さ、総ビットレート、ストリーム数、チャプターを表示
- Videoのコーデック、profile / level、解像度、FPS、pixel format、色空間、bitrate、rotationを表示
- PQ / HLG、Mastering Display、MaxCLL / MaxFALL、Dolby Vision、HDR10+などのHDR情報を確認
- Audioのコーデック、サンプルレート、チャンネル数・配置、bitrate、sample formatを表示
- 字幕・その他のストリームを一覧表示
- ファイル全体、各ストリーム、チャプターのmetadataを表示
- **Media Doctor**で「この動画、なぜブラウザで再生しにくい？」のヒントを表示
- 解析結果をJSONとしてコピー・保存
- 日本語 / 英語切替
- スマホでは「ファイル / 診断 / 映像 / 音声 / 詳細」の固定ボトムナビ
- 入力はWORKERFSで参照し、解析前に選択ファイル全体をJavaScriptへコピーしない
- デコード・エンコード・再変換なし

## すぐに使う

### Webで使う

デモを開いて動画または音声を選ぶだけです。インストールやアカウント登録は不要です。

### 単一HTMLをビルドして使う

1. このリポジトリをダウンロードまたはクローンします。
2. Windowsで `build-standalone.bat` をダブルクリックします。
3. 初回だけ、固定したFFmpeg WASM Builder v1.2.0のMedia Inspector Releaseを取得し、SHA-256を検証します。
4. `dist/index.html` または同内容の `media-inspector.html` を直接開きます。
5. 配布用として `dist/index.self-extract.html` も生成されます。

Python、Node.js、ローカルWebサーバーは不要です。ビルドにはWindows PowerShellとWindows標準機能を使います。

## 使い方

1. 動画または音声を選択・ドロップします。
2. 端末内での解析完了を待ちます。
3. **Media Doctor**でブラウザ再生の注意点を確認します。
4. Video / Audio / 字幕・その他のカードで詳細を確認します。
5. **詳細**からmetadata、チャプター、解析JSON、エンジン情報を確認します。
6. 必要なら解析JSONをコピーまたは保存します。

## Media Doctor

Media Doctorは「再生できる / できない」を断定する機能ではありません。FFmpegが取得したファイル情報に加え、`HTMLMediaElement.canPlayType()` と、選択したローカルBlob URLをブラウザ標準の `<video>` / `<audio>` で読み込むテストを組み合わせます。

HEVC、ProRes、AC-3 / E-AC-3 / DTS / TrueHD、HDR、高bit depth / 4:2:2 / 4:4:4、MKV、rotation metadata、ブラウザ標準再生エラーなどを分かりやすく注意表示します。実際の対応状況はOS・ブラウザ・ハードウェアデコーダー・GPU等にも依存します。

## GitHub Pagesで公開する

このリポジトリには、単一HTMLをビルドして `dist/` をGitHub Pagesへ公開するワークフローが含まれています。

1. `htmlapps-media-inspector` としてGitHubへpushします。
2. **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。
3. `main` へpushするか、Actionsから **Deploy standalone app to GitHub Pages** を再実行します。
4. 公開後は `https://ttomohisa.github.io/htmlapps-media-inspector/` で利用できます。

Pagesがまだ有効化されていない場合でも、ワークフローはビルド検証まで実施し、設定手順を表示します。

## 開発とビルド

```text
.
├─ src/index.template.html       # アプリ本体
├─ app.config.json               # アプリ情報とビルド設定
├─ dependencies.json             # FFmpeg WASM Builder Release固定
├─ build-standalone.bat          # Windows用ビルド入口
├─ build-standalone.ps1          # Release検証・単一HTMLへの内包
├─ components/                   # 確認ダイアログ / スマホ下部バーの再利用部品
├─ scripts/                      # リポジトリ・生成物の検証
└─ .github/workflows/            # ビルド検証 / Pages公開
```

ビルド時に同じBuilder Releaseの `SHA256SUMS.txt` を取得し、`ffmpeg-wasm-media-inspector-v1.2.0.zip` を検証してから `ffmpeg.js.gz` と `ffmpeg.wasm.gz` を内包します。バイナリZIPと対応ソースのSHA-256は `dist/dependency-manifest.json` に記録します。

gzip済みデータは単一HTML内で一度だけBase64化し、実行時に `DecompressionStream('gzip')` で端末内展開します。

## プライバシーと通信防止

生成HTMLはContent Security Policyで `connect-src 'none'` を設定します。選択したファイルはEmscripten WORKERFSから参照し、ブラウザセッション内に留まります。

GitHub Pages版は最初のHTML配信だけ通信しますが、選択したメディアや解析JSONをアプリ自身が外部へ送信しません。完全オフラインで使う場合はビルド済み `dist/index.html` をローカルで開いてください。

## 制限事項

- 小型化のためVideo / Audioのデコーダーは内包していません。コンテナとストリームのヘッダー情報を中心に解析するため、ファイルによって取得できない項目があります。
- Media Doctorは参考判定であり、再生可否を保証しません。
- 壊れたファイルや特殊な形式は解析できない場合があります。
- vendor固有のmetadataなど、すべての付加情報を表示できるわけではありません。
- WORKERFSによりファイル全体のJavaScriptコピーは避けますが、解析中はブラウザとWASMのメモリを使用します。
- 内包coreの展開に `DecompressionStream('gzip')` を利用します。

## 使用コンポーネント

| コンポーネント | バージョン | ライセンス | 用途 |
| --- | ---: | --- | --- |
| FFmpeg WASM Builder / Media Inspector core | 1.2.0 | 生成core: LGPL-2.1-or-later | メディアのコンテナ・ストリーム解析 |

アプリ側のソースコードはMIT Licenseです。FFmpegの通知、Release asset、チェックサム、対応ソースについては [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を確認してください。

## コントリビューション

バグ報告や機能提案はIssueからお願いします。開発への参加方法は [CONTRIBUTING.md](CONTRIBUTING.md) を確認してください。

## ライセンス

Copyright © 2026 ttomohisa

アプリ側のソースコードは [MIT License](LICENSE) です。生成されたFFmpeg coreはLGPL-2.1-or-laterの条件が適用されるため、[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) も確認してください。
