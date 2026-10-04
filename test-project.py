#!/usr/bin/env python3
"""One-command local check: python3 test-project.py [--build] [--browser].

Uses existing Node tests. Reports go to .test-results/, not tracked project files.
Browser mode additionally requires Python Playwright and /usr/bin/chromium.
"""
import argparse
from datetime import datetime, timezone
from functools import partial
import hashlib
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from threading import Thread
import time
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / '.test-results'
CHECKS = []

class Skipped(Exception):
    pass

def skip(reason):
    raise Skipped(reason)

class Document(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.links = []
        self.images = []
        self.text = []
        self.lang = None
        self.slides = 0
        self.feed(path.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'html':
            self.lang = attrs.get('lang')
        if 'slide' in attrs.get('class', '').split():
            self.slides += 1
        if tag == 'img':
            self.images.append(attrs.get('src', ''))
        if tag == 'script' and attrs.get('src'):
            self.links.append(attrs['src'])
        if tag == 'link' and attrs.get('href'):
            self.links.append(attrs['href'])

    def handle_data(self, data):
        self.text.append(data)

def require(condition, message):
    if not condition:
        raise AssertionError(message)

def check(name, action):
    print(f'Проверка: {name}…', flush=True)
    start = time.monotonic()
    try:
        details = action()
        result = {'name': name, 'status': 'passed', 'details': details}
    except Skipped as error:
        result = {'name': name, 'status': 'skipped', 'reason': str(error)}
    except Exception as error:
        result = {'name': name, 'status': 'failed', 'reason': str(error)}
    result['seconds'] = round(time.monotonic() - start, 2)
    CHECKS.append(result)
    print(f"  {result['status'].upper()}: {result.get('reason', result.get('details'))}", flush=True)

def command(args, log_name, timeout=180):
    log = OUTPUT / log_name
    try:
        result = subprocess.run(args, cwd=ROOT, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True, encoding='utf-8',
                                errors='replace', timeout=timeout, check=False)
    except subprocess.TimeoutExpired as error:
        payload = error.stdout or b''
        log.write_text(payload.decode('utf-8', errors='replace') if isinstance(payload, bytes) else payload, encoding='utf-8')
        raise RuntimeError(f'Время проверки истекло ({timeout} с). Лог: {log}') from error
    log.write_text(result.stdout, encoding='utf-8')
    require(result.returncode == 0, f'Код завершения {result.returncode}. Лог: {log}')
    return result.stdout

def prerequisites():
    require(shutil.which('node') and shutil.which('npm'), 'Установите Node.js и npm.')
    require((ROOT / 'node_modules/react/package.json').is_file() and
            (ROOT / 'node_modules/papaparse/package.json').is_file(), 'Сначала выполните npm ci в каталоге проекта.')
    return 'Node.js, npm и зависимости доступны'

def node_checks(script):
    text = command(['npm', 'run', script], f'{script}.log')
    if script == 'test':
        text = re.sub(r'\x1b\[[0-9;]*m', '', text)
        passed = re.search(r'^(?:#|ℹ)\s+pass\s+(\d+)\s*$', text, re.MULTILINE)
        total = re.search(r'^(?:#|ℹ)\s+tests\s+(\d+)\s*$', text, re.MULTILINE)
        require(passed and total and int(total[1]) > 0 and passed[1] == total[1], 'Не все тесты выполнены успешно.')
        return {'passed': int(passed[1]), 'total': int(total[1])}
    return {'command': f'npm run {script}', 'exitCode': 0}

def models():
    output = OUTPUT / 'model-export.json'
    command(['node', 'scripts/verify-model-export.js', '--output', str(output)], 'models.log')
    data = json.loads(output.read_text(encoding='utf-8'))
    require(all(row['alertDecisionsMatch'] for row in data['results']), 'Решения моделей не совпали.')
    return {'rows': sum(row['rows'] for row in data['results']), 'scope': 'JS против сохранённых Python-предсказаний; без обучения'}

def local_asset(base, reference, boundary):
    parsed = urlsplit(reference)
    require(not parsed.scheme and not parsed.netloc, f'Внешний ресурс готовой сборки: {reference}')
    resolved = ((boundary if parsed.path.startswith('/') else base) / unquote(parsed.path).lstrip('/')).resolve()
    require(resolved.is_relative_to(boundary.resolve()) and resolved.is_file(), f'Ресурс отсутствует или выходит за каталог: {reference}')
    return resolved

def build_files():
    site = ROOT / 'site'
    document = Document(site / 'index.html')
    require(document.links, 'В index.html нет ресурсов приложения.')
    resources = [local_asset(site, ref, site) for ref in document.links]
    fonts = 0
    for resource in resources:
        if resource.suffix == '.css':
            for reference in re.findall(r'url\([\s\"\']*([^\)\"\']+)', resource.read_text(encoding='utf-8')):
                if reference.startswith('data:'):
                    continue
                local_asset(resource.parent, reference.strip(), site)
                fonts += 1
    for name in ['presentation.pdf', 'technical-description.md']:
        require((site / 'docs' / name).read_bytes() == (ROOT / 'docs' / name).read_bytes(), f'Копия {name} устарела: выполните npm run build.')
    require((site / 'docs/aps-demo.html').is_file(), 'Отсутствует отдельная диагностика Scania.')
    return {'entryAssets': len(resources), 'cssAssets': fonts, 'documentCopiesMatch': True,
            'scope': 'Файлы и ссылки сборки; для интерфейса используйте --browser'}

def presentation():
    team = json.loads((ROOT / 'docs/submission/team.json').read_text(encoding='utf-8'))
    names = [team['captain'], *team['members']]
    require(2 <= len(names) <= 5 and len(set(names)) == len(names) and all(names), 'Проверьте состав команды: 2–5 разных участников.')
    doc = Document(ROOT / 'docs/presentation.html')
    require(doc.lang == 'kk' and doc.slides > 0, 'Презентация должна быть на казахском и содержать слайды.')
    html_text = ' '.join(doc.text)
    for value in [team['teamName'], team['institution'], team['city'], *names]:
        require(value and value in html_text, f'Нет данных на слайдах: {value}')
    for source in doc.images:
        local_asset(ROOT / 'docs', source, ROOT / 'docs')
    require(len(doc.images) >= 1, 'На слайдах нет скриншотов.')
    with ZipFile(ROOT / 'docs/presentation-kk.pptx') as deck:
        require(deck.testzip() is None, 'Архив PowerPoint повреждён.')
        slides = [name for name in deck.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', name)]
        require(len(slides) == doc.slides, 'Число слайдов HTML и PowerPoint отличается.')
        ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
        text = '\n'.join(''.join(p.itertext()) for name in slides for p in ElementTree.fromstring(deck.read(name)).findall('.//a:t', ns))
        for value in [team['teamName'], team['institution'], team['city'], *names]:
            require(value in text, f'Нет текста в PowerPoint: {value}')
    pdf = (ROOT / 'docs/presentation.pdf').read_bytes()
    require(pdf.startswith(b'%PDF-') and pdf.rstrip().endswith(b'%%EOF'), 'PDF отсутствует или повреждён.')
    return {'language': doc.lang, 'slides': doc.slides, 'screenshots': len(doc.images), 'teamSize': len(names), 'editablePptxTextChecked': True}

def pdf_text():
    if importlib.util.find_spec('pypdf') is None:
        raise Skipped('Для проверки текста PDF установите pypdf: python3 -m pip install pypdf. Заголовок PDF уже проверен отдельно.')
    from pypdf import PdfReader
    pdf = PdfReader(ROOT / 'docs/presentation.pdf')
    team = json.loads((ROOT / 'docs/submission/team.json').read_text(encoding='utf-8'))
    text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
    require(len(pdf.pages) == Document(ROOT / 'docs/presentation.html').slides, 'Количество страниц PDF не совпало.')
    for value in [team['teamName'], team['institution'], team['city'], team['captain'], *team['members']]:
        require(value in text, f'В PDF нет текста: {value}')
    require('\ufffd' not in text and 'Перед сдачей добавить' not in text, 'В PDF есть повреждённый текст или заглушка.')
    return {'pages': len(pdf.pages), 'kazakhNamesChecked': True}

def browser():
    require(importlib.util.find_spec('playwright') is not None, 'Для --browser нужен Python Playwright: python3 -m pip install playwright.')
    require(Path('/usr/bin/chromium').is_file(), 'Для --browser нужен Chromium по пути /usr/bin/chromium.')
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    folder = OUTPUT / 'browser'
    folder.mkdir(exist_ok=True)
    # A fresh report prevents a failed run from being mistaken for a prior success.
    report = folder / 'verification/react-browser.json'
    report.unlink(missing_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'site')))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        command([sys.executable, 'scripts/verify-react.py', '--url', f'http://127.0.0.1:{server.server_port}', '--output-dir', str(folder)], 'browser.log', timeout=240)
        data = json.loads(report.read_text(encoding='utf-8'))
        require(data['passed'] and not data['errors'], 'Браузерная проверка не прошла.')
        return {'groups': len(data['checks']), 'errors': data['errors'], 'viewports': [390, 768, 1440]}
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

def main():
    parser = argparse.ArgumentParser(description='Отдельная локальная проверка Allur Plant Twin с JSON-отчётом.')
    parser.add_argument('--build', action='store_true', help='Сначала пересобрать приложение через npm run build')
    parser.add_argument('--browser', action='store_true', help='Автоматически запустить локальный сервер и проверить интерфейс в Chromium')
    args = parser.parse_args()
    OUTPUT.mkdir(exist_ok=True)
    print('Allur Plant Twin — проверка проекта', flush=True)
    check('Среда', prerequisites)
    available = CHECKS[0]['status'] == 'passed'
    if available:
        check('Расчёты, CSV и экономика', lambda: node_checks('test'))
        check('Синтаксис JavaScript', lambda: node_checks('check'))
        if args.build:
            check('Пересборка React', lambda: node_checks('build'))
        check('Перенос моделей', models)
    else:
        check('Проверки Node', lambda: skip('Зависимости недоступны; исправьте проверку среды.'))
    check('Файлы готовой сборки', build_files)
    check('Команда, скриншоты и PowerPoint', presentation)
    check('Текст и страницы PDF', pdf_text)
    if args.browser:
        check('Интерфейс Chromium', browser)
    else:
        check('Интерфейс Chromium', lambda: skip('Не запрошено: добавьте --browser.'))
    try:
        team = json.loads((ROOT / 'docs/submission/team.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        team = {}
    if not isinstance(team, dict):
        team = {}
    try:
        version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    except (OSError, ValueError, KeyError, TypeError):
        version = None
    warnings = ['Регистрация, право участия и отправка материалов этим файлом не проверяются.',
                'Заводская симуляция синтетическая; промышленная применимость и экономия Allur не проверяются.']
    if not team.get('recipientEmail'):
        warnings.append('Адрес получателя заявки ещё не заполнен.')
    failed = sum(row['status'] == 'failed' for row in CHECKS)
    report = {'passed': failed == 0, 'checkedAtUTC': datetime.now(timezone.utc).isoformat(),
              'version': version,
              'checks': CHECKS, 'warnings': warnings, 'factoryTelemetryTrainingRun': False,
              'sourceSha256': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in
                              ['test-project.py', 'package.json', 'engine.js', 'decision-analysis.js', 'src/lib/production-csv.mjs', 'docs/presentation.pdf'] if (ROOT / name).is_file()}}
    (OUTPUT / 'latest.json').write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    counts = {status: sum(row['status'] == status for row in CHECKS) for status in ['passed', 'failed', 'skipped']}
    print(f"\nИтог: {'PASSED' if report['passed'] else 'FAILED'} — {counts}")
    print(f"Отчёт: {OUTPUT / 'latest.json'}")
    for warning in warnings:
        print('Примечание: ' + warning)
    return 1 if failed else 0

if __name__ == '__main__':
    raise SystemExit(main())
