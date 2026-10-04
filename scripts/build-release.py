"""Assemble the local hackathon submission without publishing or sending it."""
from pathlib import Path
from email.message import EmailMessage
from email.policy import SMTP
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

subject = f"Qostanai AI Industry Hackathon 2026 — №2 кейс — {field('teamName', '[команда атауы]')}"
body = f"""Сәлеметсіздер ме!

Allur компаниясының №2 «Автомобиль зауытының цифрлық егізі» кейсі бойынша Allur Plant Twin жобасын ұсынамыз.

Оқу орны: {field('institution', '[оқу орны]')}
Қала: {field('city', '[қала]')}
Команда: {field('teamName', '[команда атауы]')}
Кейс нөмірі: 2 — Allur
Команда капитаны: {field('captain', '[капитанның аты-жөні]')}
Қатысушылар: {field('member', '[қатысушылардың аты-жөні]')}
Репозиторий: {field('repositoryUrl', '[код сілтемесі]')}
Презентация: Allur-Plant-Twin-presentation.pdf файлы тіркелген (PDF).
PDF сілтемесі: {field('presentationUrl', '[PDF сілтемесі]')}
"""
if team.get("demoUrl", "").strip():
    body += f"Демонстрация: {team['demoUrl'].strip()}\n"
body += "\nЖоба өндірістік ағындарды, жинақтау желісінің тоқтау қаупін және оператор әрекетін көрсетеді. Зауыт симуляциясы мен қор моделі синтетикалық деректерді пайдаланады. Бөлек диагностикалық модель Scania APS ашық деректерінде үйретілген; оның нәтижелері Allur жабдығына қатысты емес.\n\nҚұрметпен,\n" + field("captain", "[капитанның аты-жөні]") + "\n"
email = f"# Хат жобасы — Qostanai AI Industry Hackathon 2026\n\nКімге: {field('recipientEmail', '[ұйымдастырушының мекенжайы]')}\nТақырып: {subject}\nТіркеме: Allur-Plant-Twin-presentation.pdf (тек PDF)\n\n" + body
email += "\n---\nМәртебе: хат жобасы, жіберілген жоқ. Барлық материалды бір хатпен жіберіңіз. PDF тіркемесін және код сілтемесін тексеріңіз.\n"
(ROOT / "docs/submission/submission-email.md").write_text(email, encoding="utf-8")
dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
shutil.copyfile(presentation, dist / "Allur-Plant-Twin-presentation.pdf")
powerpoint = ROOT / "docs/presentation-kk.pptx"
if powerpoint.is_file():
    shutil.copyfile(powerpoint, dist / "Allur-Plant-Twin-presentation-kk.pptx")
shutil.copyfile(ROOT / "docs/submission/submission-email.md", dist / "submission-email.md")
message = EmailMessage(policy=SMTP)
if team.get("recipientEmail", "").strip():
    message["To"] = team["recipientEmail"].strip()
message["Subject"] = subject
message["X-Unsent"] = "1"
message.set_content(body, charset="utf-8")
message.add_attachment(presentation.read_bytes(), maintype="application", subtype="pdf",
                       filename="Allur-Plant-Twin-presentation.pdf")
(dist / "submission.eml").write_bytes(message.as_bytes())
(dist / "submission-body.txt").write_text(body, encoding="utf-8")
excluded = {".git", ".venv", "node_modules", "__pycache__", "dist", ".web-static", ".test-results"}
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
          "readinessScope": "Required team/contact fields and PDF present; registration, eligibility and receipt are not checked",
          "submitted": False,
          "emailDraft": "submission.eml",
          "emailAttachments": ["Allur-Plant-Twin-presentation.pdf"],
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
