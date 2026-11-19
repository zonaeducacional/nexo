"""Valida o acervo e produz o diretório estático para Pages e Tauri."""
from pathlib import Path
import json
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
web = root / "web"
dist = root / "dist"
readings = json.loads((web / "acervo.json").read_text(encoding="utf-8"))
ids = set()
for reading in readings:
    assert reading["id"] not in ids and reading["texto"] and reading["questoes"], reading
    ids.add(reading["id"])
    for question in reading["questoes"]:
        assert question["enunciado"] and question["resposta"], question
        if "trecho" in question:
            assert any(question["trecho"] in p for p in reading["texto"]), question
subprocess.run([
    "cargo", "build", "--locked", "--release", "--target", "wasm32-unknown-unknown",
    "--manifest-path", str(root / "engine/Cargo.toml"),
    "--target-dir", str(root / "engine/target"),
], check=True)
shutil.copytree(web, dist, dirs_exist_ok=True)
shutil.copyfile(root / "engine/target/wasm32-unknown-unknown/release/nexo_engine.wasm", dist / "nexo_engine.wasm")
(dist / ".nojekyll").touch()
print(f"Nexo: {len(readings)} fichas em {dist}")
