"""Assemble the local hackathon submission without publishing or sending it."""
from pathlib import Path
import hashlib
import json
import shutil
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
team = json.loads((ROOT / "docs/submission/team.json").read_text(encoding="utf-8"))
required = ["teamName", "institution", "city", "captain", "member", "recipientEmail"]
for key in required + ["repositoryUrl", "presentationUrl", "demoUrl"]:
    if not isinstance(team.get(key, ""), str):
        raise ValueError(f"{key} must be a string.")
    if "\n" in team.get(key, "") or "\r" in team.get(key, ""):
        raise ValueError(f"{key} must be a single line.")
if not isinstance(team.get("repositoryPublished"), bool):
    raise ValueError("repositoryPublished must be true or false.")
missing = [key for key in required if not team.get(key, "").strip()]
if not team.get("repositoryUrl", "").strip() or not team["repositoryPublished"]:
    missing.append("publishedRepository")
presentation = ROOT / "docs/presentation.pdf"
if not presentation.is_file():
    raise ValueError("docs/presentation.pdf is required for the bundle.")
source = (ROOT / "docs/presentation.html").read_text(encoding="utf-8")
if "Перед сдачей добавить" in source:
    missing.append("presentationAuthors")

verification_file = ROOT / "docs/verification/latest.json"
verification = json.loads(verification_file.read_text()) if verification_file.exists() else {}
version = json.loads((ROOT / "package.json").read_text())["version"]
fingerprints = verification.get("sourceSha256", {})
verification_matches = bool(fingerprints) and verification.get("version") == version and all(
    (ROOT / name).is_file() and hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
    for name, digest in fingerprints.items()
)

def field(key, fallback):
    return team.get(key, "").strip() or fallback

email = f"""# Черновик письма — Qostanai AI Industry Hackathon 2026

Кому: {field('recipientEmail', '[адрес организатора]')}
Тема: Qostanai AI Industry Hackathon 2026 — кейс №2 — {field('teamName', '[название команды]')}

Здравствуйте!

Направляем решение кейса №2 «Цифровой двойник автомобильного завода», Allur — проект Allur Plant Twin.

Учебное заведение: {field('institution', '[учебное заведение]')}
Город: {field('city', '[город]')}
Название команды: {field('teamName', '[название команды]')}
Капитан: {field('captain', '[ФИО капитана]')}
Участник: {field('member', '[ФИО второго участника]')}
Репозиторий: {field('repositoryUrl', '[ссылка на опубликованный код]')}
Презентация: {field('presentationUrl', 'PDF во вложении — Allur-Plant-Twin-presentation.pdf')}
"""
if team.get("demoUrl", "").strip():
    email += f"Демонстрация: {team['demoUrl'].strip()}\n"
email += "\nПроект демонстрирует производственные потоки, предупреждение остановки сборки и действия оператора. Заводская симуляция и модель буфера используют синтетические данные. Отдельная диагностическая модель обучена на открытых эксплуатационных данных Scania APS; её результаты не относятся к оборудованию Allur.\n\nС уважением,\n" + field("captain", "[ФИО капитана]") + "\n"
email += "\n---\nСтатус: черновик, письмо не отправлено. Перед отправкой заполните авторов и проверьте ссылки на код и PDF.\n"
(ROOT / "docs/submission/submission-email.md").write_text(email, encoding="utf-8")
dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
shutil.copyfile(presentation, dist / "Allur-Plant-Twin-presentation.pdf")
shutil.copyfile(ROOT / "docs/submission/submission-email.md", dist / "submission-email.md")
excluded = {".git", ".venv", "node_modules", "__pycache__", "dist", ".web-static"}
files = []
archive = dist / "Allur-Plant-Twin.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
    for path in sorted(ROOT.rglob("*")):
        relative = path.relative_to(ROOT)
        if not path.is_file() or excluded.intersection(relative.parts):
            continue
        if relative.parts[:2] == ("ml", "local") or path.suffix == ".log" or path.name.startswith(".env"):
            continue
        payload = path.read_bytes()
        entry = ZipInfo("Allur-Plant-Twin/" + relative.as_posix(), date_time=(2026, 10, 2, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        bundle.writestr(entry, payload)
        files.append({"path": relative.as_posix(), "bytes": len(payload),
                      "sha256": hashlib.sha256(payload).hexdigest()})
status = {"project": "Allur Plant Twin", "case": 2,
          "version": version,
          "readyToSubmit": not missing, "missing": missing,
          "repositoryPublishedByTeam": team["repositoryPublished"],
          "repositoryAvailabilityChecked": False,
          "verificationMatchesCurrentSources": verification_matches,
          "softwareTestsRunForThisUpdate": verification_matches and verification.get("engineTests", {}).get("passed", False),
          "browserScenariosVerifiedForThisUpdate": verification_matches and verification.get("browser", {}).get("passed", False),
          "factoryTelemetryTrainingRun": False,
          "publicObservedBenchmarkTrainingRun": (ROOT / "ml/results/aps/report.json").exists(),
          "modelEvaluationSources": {"buffer": "synthetic", "APS_diagnosis": "public_observed_scania_aps"},
          "archiveSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
          "presentationSha256": hashlib.sha256(presentation.read_bytes()).hexdigest(),
          "files": files}
(dist / "submission-status.json").write_text(json.dumps(status, indent=2, ensure_ascii=False) + "\n",
                                             encoding="utf-8")
print(json.dumps({"archive": str(archive), "version": status["version"],
                  "readyToSubmit": status["readyToSubmit"], "missing": missing},
                 indent=2, ensure_ascii=False))
