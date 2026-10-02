"""Download the original Scania APS records from a pinned public mirror."""
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parent / "public/aps"
COMMIT = "cf7d236b2c3a2196931f0acba0ab858ee9071fa2"
BASE = f"https://raw.githubusercontent.com/DeepDive-UG/Scania-failure-model/{COMMIT}/data/raw/"
FILES = {
    "aps_failure_training_set.csv": (44669194, "2eeba53f615dc49cce61cd2ec4edc85bf7334715"),
    "aps_failure_test_set.csv": (11943558, "0836571d6f0a34dab92f129fdae269dc5703f950"),
    "aps_failure_description.txt": (4874, "0d82cfc41fd96cf260516a7737f0dd8787d263bd"),
}
ROOT.mkdir(parents=True, exist_ok=True)
manifest = {"dataset": "APS Failure at Scania Trucks", "creator": "Scania CV AB",
    "donors": ["Tony Lindgren", "Jonas Biteus"], "released": "2016-09",
    "canonicalUrl": "https://archive.ics.uci.edu/dataset/421/aps+failure+at+scania+trucks",
    "mirrorRepository": "DeepDive-UG/Scania-failure-model",
    "mirrorCommit": COMMIT, "licenseDeclaredInOriginalFiles": "GPL-3.0-or-later",
    "source": "public_observed_scania_aps", "files": {},
    "scope": "Truck APS component fault classification; no factory buffer or future-horizon labels.",
    "negativeClass": "Faults in components not related to APS, not healthy trucks.",
    "limitations": ["Anonymized operational counters and histogram bins.",
        "No timestamp or truck identifier for chronological/grouped evaluation.",
        "Git blob hashes verify the pinned mirror, not direct equality to today's UCI download."]}
for name, (size, git_sha) in FILES.items():
    destination = ROOT / name
    payload = destination.read_bytes() if destination.exists() else None
    def matches(data):
        return data is not None and len(data) == size and hashlib.sha1(
            f"blob {len(data)}\0".encode() + data).hexdigest() == git_sha
    if not matches(payload):
        with urllib.request.urlopen(BASE + name, timeout=60) as response:
            payload = response.read(size + 1)
        if not matches(payload):
            raise ValueError(f"Pinned mirror content differs: {name}")
        destination.write_bytes(payload)
    manifest["files"][name] = {"url": BASE + name, "bytes": len(payload), "gitBlobSha": git_sha,
                              "sha256": hashlib.sha256(payload).hexdigest()}
    print(f"Downloaded: {name} ({len(payload):,} bytes)", flush=True)
license_url = "https://raw.githubusercontent.com/gcc-mirror/gcc/master/COPYING3"
license_path = ROOT / "GPL-3.0.txt"
if not license_path.exists():
    with urllib.request.urlopen(license_url, timeout=30) as response:
        license_path.write_bytes(response.read())
manifest["licenseCopy"] = {"url": license_url, "sha256": hashlib.sha256(license_path.read_bytes()).hexdigest()}
(ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(ROOT / "manifest.json")
