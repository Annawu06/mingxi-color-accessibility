#!/usr/bin/env python3
"""Create a Chrome/Edge upload ZIP from the unpacked extension directory."""

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "extension"
manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
required = [
    "manifest.json",
    manifest["background"]["service_worker"],
    manifest["action"]["default_popup"],
    *(script for entry in manifest["content_scripts"] for script in entry["js"]),
]
for name in required:
    if not (SOURCE / name).is_file():
        raise SystemExit(f"Missing extension file: {name}")

destination = ROOT / "releases" / f"mingxi-extension-{manifest['version']}.zip"
destination.parent.mkdir(exist_ok=True)
with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
    for path in sorted(SOURCE.rglob("*")):
        if path.is_file() and not path.name.startswith("."):
            archive.write(path, path.relative_to(SOURCE))
print(destination)
