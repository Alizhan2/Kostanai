"""Verify the built React app with Chromium. Requires Python Playwright and a running preview server."""
import argparse, json, subprocess, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
R=Path(__file__).resolve().parents[1]; checks=[]
parser=argparse.ArgumentParser(); parser.add_argument('--url',default='http://localhost:4173'); parser.add_argument('--output-dir',default=str(R/'docs')); args=parser.parse_args()
output_dir=Path(args.output_dir).resolve(); output_dir.mkdir(parents=True,exist_ok=True)
(output_dir/'verification').mkdir(exist_ok=True)
downloads=output_dir/'downloads'; downloads.mkdir(exist_ok=True)
def passed(name): checks.append(name)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
 page=context.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e))); page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(args.url); expect(page.get_by_role('heading',name='Обзор производства',exact=True)).to_be_visible()
 expect(page.get_by_text('45 мин',exact=True)).to_be_visible(); passed('Production React bundle renders, initial horizon 45 minutes')
 page.screenshot(path=str(output_dir/'react-desktop.png'),full_page=True)
 page.screenshot(path=str(output_dir/'react-preview.png'))
 page.locator('.content-grid').screenshot(path=str(output_dir/'react-process-risk.png'))
 for i in range(9): page.get_by_role('button',name='+5 мин',exact=True).click()
 expect(page.get_by_text('Остановка',exact=True)).to_be_visible()
 page.get_by_role('button',name='+5 мин',exact=True).click()
 saved=json.loads(page.evaluate("localStorage.getItem('allur-twin-v1')")); assembly=next(x for x in saved['snapshot']['lines'] if x['id']=='assembly')
 assert assembly['status']=='stopped' and assembly['downtimeMinutes']==7
 passed('Buffer depletion after 45 minutes; next step adds 5 downtime minutes')
 page.get_by_role('button',name='Пополнить буфер · +30',exact=True).click()
 expect(page.get_by_text('Поток стабилен',exact=True)).to_be_visible(); passed('Replenishment restores supply and assembly')
 page.get_by_role('button',name='Карточка участка',exact=True).click(); expect(page.locator('dialog')).to_be_visible()
 page.keyboard.press('Escape'); expect(page.locator('dialog')).not_to_be_visible(); passed('Equipment modal opens and closes with Escape')
 page.locator('#scenario').select_option('quality'); page.get_by_role('button',name='+5 мин',exact=True).click()
 page.get_by_role('button',name='Контроль качества',exact=True).click(); page.get_by_role('button',name='Устранить отклонение окраски',exact=True).click()
 expect(page.get_by_role('button',name='Устранить отклонение окраски',exact=True)).to_be_disabled(); passed('Quality scenario and corrective action work')
 page.get_by_role('button',name='Отчёты',exact=True).click()
 before=page.evaluate("localStorage.getItem('allur-twin-v1')")
 slider=page.get_by_role('slider'); slider.fill('60'); expect(page.get_by_text('Пополнение через 60 мин',exact=True)).to_be_visible()
 assert page.evaluate("localStorage.getItem('allur-twin-v1')")==before
 page.get_by_role('button',name='Линии',exact=True).click(); page.get_by_role('button',name='Отчёты',exact=True).click(); expect(page.get_by_role('slider')).to_have_value('60')
 passed('What-if slider updates comparison without mutating current shift; selection survives navigation')
 expect(page.locator('#hourly-downtime-cost')).to_have_value(''); expect(page.locator('#intervention-cost')).to_have_value('')
 page.locator('#hourly-downtime-cost').fill('100000'); page.locator('#intervention-cost').fill('20000')
 def cost_values(): return [re.sub(r'\s+','',text) for text in page.locator('.cost-metrics strong').all_text_contents()]
 expect(page.locator('.cost-metrics')).to_be_visible(); assert cost_values()==['100000₸','20000₸','80000₸']
 page.get_by_role('slider').fill('30'); assert cost_values()==['125000₸','20000₸','105000₸']
 page.locator('#hourly-downtime-cost').fill('-1'); expect(page.get_by_role('alert')).to_contain_text('Стоимость'); expect(page.locator('.cost-metrics')).not_to_be_visible()
 page.locator('#hourly-downtime-cost').fill('100000'); page.get_by_role('slider').fill('120'); assert cost_values()==['0₸','0₸','0₸']
 page.get_by_role('slider').fill('60'); page.get_by_role('button',name='Линии',exact=True).click(); page.get_by_role('button',name='Отчёты',exact=True).click(); expect(page.locator('#hourly-downtime-cost')).to_have_value('100000')
 page.locator('.cost-evaluation').screenshot(path=str(output_dir/'economics-desktop.png'))
 passed('Cost assumptions start empty; early and late actions match known balances; no fee outside horizon; negative costs rejected; values retained on navigation')
 for button,kind in [('Скачать CSV','csv'),('Отчёт TXT','txt'),('Снимок JSON','json'),('Скачать сравнение JSON','comparison')]:
  with page.expect_download() as d: page.get_by_role('button',name=button,exact=True).click()
  download=d.value; dest=downloads/('react-'+kind); download.save_as(dest); payload=dest.read_text(encoding='utf-8-sig'); assert payload.strip()
  if kind=='json': assert len(json.loads(payload)['lines'])==4
  if kind=='comparison': assert json.loads(payload)['interventionAfterMinutes']==60 and json.loads(payload)['economicEvaluation']['netEffect']==80000
 passed('CSV, TXT, snapshot JSON and comparison JSON downloads contain data')
 page.get_by_role('link',name='Открыть диагностику',exact=True).click(); expect(page.get_by_role('heading',level=1)).to_contain_text('Диагностика пневмосистемы'); expect(page.locator('#result')).to_contain_text('Оценка класса APS'); page.locator('#example').select_option('4'); expect(page.locator('#reference')).to_contain_text('неисправность другого компонента'); expect(page.locator('#result')).to_contain_text('Оценка класса APS'); page.go_back(); passed('Separate Scania diagnostic page accessible in static build')
 page.get_by_role('button',name='Настройки',exact=True).click(); previous=page.evaluate("localStorage.getItem('allur-twin-v1')")
 page.locator('#production-import').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{oops'})
 expect(page.get_by_role('alert')).to_contain_text('некорректный JSON'); assert page.evaluate("localStorage.getItem('allur-twin-v1')")==previous
 passed('Malformed import rejected without changing shift')
 sample=json.loads(subprocess.check_output(['node','-e',"const E=require('./engine'); console.log(JSON.stringify(E.exportSnapshot(E.createState())))"],cwd=R))
 for line in sample['lines']:
  if line['id'] in ['body','assembly']: line['status']='stopped'; line['throughput']=0
 page.locator('#production-import').set_input_files({'name':'stopped.json','mimeType':'application/json','buffer':json.dumps(sample).encode()})
 expect(page.get_by_text('Текущий источник:',exact=False)).to_contain_text('Импортированный')
 page.get_by_role('button',name='Обзор',exact=True).click(); page.get_by_role('button',name='+5 мин',exact=True).click(); page.get_by_role('button',name='Пополнить буфер · +30',exact=True).click()
 saved=json.loads(page.evaluate("localStorage.getItem('allur-twin-v1')"))
 for line in saved['snapshot']['lines']:
  if line['id'] in ['body','assembly']: assert line['status']=='stopped' and line['throughput']==0 and line['downtimeMinutes']==next(x for x in sample['lines'] if x['id']==line['id'])['downtimeMinutes']+5
 page.get_by_text('Обученная модель буфера',exact=False).first.click(); expect(page.get_by_text('Для импортированных данных модель нужно обучить и оценить на истории предприятия.',exact=True)).to_be_visible()
 passed('Imported equipment stops persist through stepping and replenishment; synthetic ML disabled')
 page.reload(); expect(page.get_by_role('button',name='Запустить',exact=True)).to_be_visible(); expect(page.get_by_text('Импортированный снимок',exact=True)).to_be_visible(); passed('Snapshot reload retains provenance and pauses simulation')
 page.get_by_role('button',name='Источники',exact=True).click(); expect(page.get_by_role('heading',name='Подтверждено в официальном кейсе',exact=True)).to_be_visible()
 assert page.locator('.fact-card').count()==10
 with page.expect_download() as d: page.get_by_role('button',name='Скачать каталог источников',exact=True).click()
 d.value.save_as(str(downloads/'react-sources.json')); sources=json.loads((downloads/'react-sources.json').read_text()); assert sources['businessMetrics']['annualCapacity'] is None
 passed('Source catalog separates case facts, unknown company metrics and simulation')
 page.get_by_role('button',name='Настройки',exact=True).click()
 before=page.evaluate("localStorage.getItem('allur-twin-v1')")
 page.locator('#production-import').set_input_files({'name':'bad.csv','mimeType':'text/csv','buffer':b'id;capacity\nbody;22'})
 expect(page.get_by_role('alert')).to_contain_text('CSV:'); assert page.evaluate("localStorage.getItem('allur-twin-v1')")==before
 page.locator('#production-import').set_input_files({'name':'large.csv','mimeType':'text/csv','buffer':b'x'*(1024*1024+1)})
 expect(page.get_by_role('alert')).to_contain_text('Размер файла'); assert page.evaluate("localStorage.getItem('allur-twin-v1')")==before
 with page.expect_download() as d: page.get_by_role('button',name='Экспорт снимка CSV',exact=True).click()
 d.value.save_as(str(downloads/'react-snapshot.csv')); page.locator('#production-import').set_input_files(str(downloads/'react-snapshot.csv'))
 expect(page.get_by_role('alert')).to_have_count(0)
 restored=json.loads(page.evaluate("localStorage.getItem('allur-twin-v1')")); assert restored['snapshot']==json.loads(before)['snapshot'] and restored['source']=='imported'
 with page.expect_download() as d: page.get_by_role('button',name='Скачать пример CSV',exact=True).click()
 d.value.save_as(str(downloads/'react-sample.csv')); page.locator('#production-import').set_input_files(str(downloads/'react-sample.csv'))
 expect(page.get_by_role('alert')).to_have_count(0); page.wait_for_function("JSON.parse(localStorage.getItem('allur-twin-v1')).snapshot.elapsedMinutes === 120")
 passed('Malformed and oversized CSV preserve shift; CSV snapshot round-trips equipment stops; downloadable CSV sample imports successfully')
 for viewport in [{'width':390,'height':844},{'width':768,'height':1024},{'width':1440,'height':1000}]:
  page.set_viewport_size(viewport)
  for nav in ['Обзор','Линии','Инциденты','Контроль качества','Отчёты','Источники','Настройки']:
   page.locator('nav').get_by_role('button',name=nav,exact=nav!='Инциденты').click()
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), (viewport,nav)
  if viewport['width']==390:
   page.get_by_role('button',name='Отчёты',exact=True).click(); page.locator('#hourly-downtime-cost').fill('1000000000'); page.locator('#intervention-cost').fill('1000000000'); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'); page.locator('#hourly-downtime-cost').fill('100000'); page.locator('#intervention-cost').fill('20000'); page.get_by_role('slider').fill('60'); page.locator('.cost-evaluation').screenshot(path=str(output_dir/'economics-mobile.png'))
   page.get_by_role('button',name='Настройки',exact=True).click(); page.get_by_role('button',name='Создать новую демосмену',exact=True).click(); page.get_by_role('button',name='Обзор',exact=True).click(); expect(page.locator('.toast')).not_to_be_visible(timeout=6000); page.screenshot(path=str(output_dir/'react-mobile.png'),full_page=True)
 passed('All seven pages fit 390, 768 and 1440 pixel viewports without page overflow')
 page.get_by_role('button',name='Обзор',exact=True).click()
 start=json.loads(page.evaluate("localStorage.getItem('allur-twin-v1')"))['snapshot']['elapsedMinutes']
 page.get_by_role('button',name='Запустить',exact=True).click()
 page.wait_for_function("expected => JSON.parse(localStorage.getItem('allur-twin-v1')).snapshot.elapsedMinutes > expected",arg=start)
 page.get_by_role('button',name='Пауза',exact=True).click()
 page.get_by_role('button',name='Карточка участка',exact=True).click()
 paused=page.evaluate("localStorage.getItem('allur-twin-v1')")
 # Resume is requested in the background while the modal remains open.
 page.evaluate("document.querySelector('.simulation-toolbar').querySelectorAll('button')[0].click()")
 page.wait_for_timeout(2800); assert page.evaluate("localStorage.getItem('allur-twin-v1')")==paused
 page.keyboard.press('Escape'); page.get_by_role('button',name='Настройки',exact=True).click()
 paused=page.evaluate("localStorage.getItem('allur-twin-v1')")
 page.wait_for_timeout(2800); assert page.evaluate("localStorage.getItem('allur-twin-v1')")==paused
 passed('Automatic time advances; open equipment dialog and settings pause timer')
 assert not errors,errors
 passed('No browser runtime errors')
 browser.close()
(output_dir/'verification/react-browser.json').write_text(json.dumps({'passed':True,'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'passed':True,'checks':checks},ensure_ascii=False,indent=2))
