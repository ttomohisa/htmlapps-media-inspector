"""Stage the four GitHub Release downloads from a verified standalone build."""

import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]


def package(output):
    version = json.loads((ROOT / "app.config.json").read_text(encoding="utf-8"))["version"]
    if not re.fullmatch(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)", version):
        raise ValueError("Expected a stable release version")
    manifest = json.loads((ROOT / "dist/dependency-manifest.json").read_text(encoding="utf-8-sig"))
    if manifest["app"]["version"] != version:
        raise ValueError("Rebuild the standalone HTML for the release version")
    output.mkdir(parents=True, exist_ok=True)
    stem = "htmlapps-media-inspector-v" + version
    downloads = []
    for suffix in (".html", ".self-extract.html"):
        destination = output / (stem + suffix)
        shutil.copyfile(ROOT / "dist" / ("index" + suffix), destination)
        downloads.append(destination)

    entries = [
        "APP_SPEC.md", "CHANGELOG.md", "CONTRIBUTING.md", "LICENSE", "README-FIRST.txt",
        "README.ja.md", "README.md", "THIRD_PARTY_NOTICES.md", "VERIFY_OFFLINE.md",
        "app.config.json", "dependencies.json", "assets/file-open-ja.png",
        "assets/screenshot-en.png", "assets/screenshot.png", "dist/dependency-manifest.json",
        "dist/index.html", "dist/index.self-extract.html", "dist/self-extract-manifest.json",
    ]
    archive = output / (stem + ".zip")
    with ZipFile(archive, "w") as bundle:
        for name in entries:
            # ZIP source mtimes must not change download hashes on CI retries.
            info = ZipInfo(name)
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            bundle.writestr(info, (ROOT / name).read_bytes(), compress_type=ZIP_DEFLATED)
    downloads.append(archive)
    checksums = "".join(hashlib.sha256(file.read_bytes()).hexdigest() + "  " + file.name + "\n"
                        for file in downloads)
    sums = checksums.encode("ascii")
    (output / "SHA256SUMS.txt").write_bytes(sums)
    return hashlib.sha256(sums).hexdigest()


if __name__ == "__main__":
    digest = package(Path(sys.argv[1]))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
            stream.write("checksums=" + digest + "\n")
