"""Valida o acervo e produz o diretório estático para Pages e Tauri."""
from pathlib import Path
from urllib.parse import urlsplit
import json
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
web = root / "web"
dist = root / "dist"
readings = json.loads((web / "acervo.json").read_text(encoding="utf-8"))
ids = {reading["id"] for reading in readings}
assert len(ids) == len(readings), "Há códigos de ficha duplicados."
catalog = [reading for reading in readings if not reading.get("arquivo")]
assert {r["genero"] for r in catalog} == {r["genero"] for r in readings}, "Há gêneros sem ficha publicada."

def validate_source(source):
    url = urlsplit(source["url"])
    assert url.scheme == "https" and url.hostname, source


for reading in readings:
    assert reading["texto"] and reading["questoes"], reading["id"]
    if not reading.get("arquivo"):
        assert len(reading["questoes"]) == 10, reading["id"]
        source = reading["fonte"]
        assert source["credito"] and source["nota"], reading["id"]
        validate_source(source)
        if "complemento" in source:
            validate_source(source["complemento"])
    visual = reading.get("visual", {})
    if visual.get("tipo") == "imagem":
        assert (web / "fontes" / visual["arquivo"]).is_file() and visual["alt"], reading["id"]

    for question in reading["questoes"]:
        assert question["enunciado"] and question["resposta"], question
        assert set(question.get("leituras", [])) <= ids - {reading["id"]}, question
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
print(f"Nexo: {len(catalog)} fichas publicadas em {dist}")
