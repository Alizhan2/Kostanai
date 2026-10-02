
const page=await figma.getNodeByIdAsync("0:1");await figma.setCurrentPageAsync(page);
await Promise.all(["Regular","Bold"].map(style=>figma.loadFontAsync({family:"Arimo",style})));
const foundation={"createdNodeIds":["3:78","3:79","3:80","3:81","3:82","3:83"],"mutatedNodeIds":["0:1"],"wrappers":{"Overview":"3:78","Lines":"3:79","Incidents":"3:80","Quality":"3:81","Reports":"3:82","Mobile":"3:83"},"collections":{"primitives":"VariableCollectionId:3:2","color":"VariableCollectionId:3:25","layout":"VariableCollectionId:3:55"},"variables":{"color/bg":"VariableID:3:26","color/panel":"VariableID:3:27","color/ink":"VariableID:3:28","color/muted":"VariableID:3:29","color/line":"VariableID:3:30","color/nav":"VariableID:3:31","color/navActive":"VariableID:3:32","color/navText":"VariableID:3:33","color/lime":"VariableID:3:34","color/success":"VariableID:3:35","color/warning":"VariableID:3:36","color/danger":"VariableID:3:37","color/info":"VariableID:3:38","color/successSoft":"VariableID:3:39","color/warningSoft":"VariableID:3:40","color/dangerSoft":"VariableID:3:41","color/infoSoft":"VariableID:3:42","color/successInk":"VariableID:3:43","color/warningInk":"VariableID:3:44","color/dangerInk":"VariableID:3:45","color/map":"VariableID:3:46","color/risk":"VariableID:3:47","space/4":"VariableID:3:56","space/8":"VariableID:3:57","space/12":"VariableID:3:58","space/16":"VariableID:3:59","space/24":"VariableID:3:60","space/32":"VariableID:3:61","radius/0":"VariableID:3:62","radius/8":"VariableID:3:63","radius/12":"VariableID:3:64","radius/16":"VariableID:3:65","radius/999":"VariableID:3:66","border/1":"VariableID:3:67"},"allVariableIds":["VariableID:3:3","VariableID:3:4","VariableID:3:5","VariableID:3:6","VariableID:3:7","VariableID:3:8","VariableID:3:9","VariableID:3:10","VariableID:3:11","VariableID:3:12","VariableID:3:13","VariableID:3:14","VariableID:3:15","VariableID:3:16","VariableID:3:17","VariableID:3:18","VariableID:3:19","VariableID:3:20","VariableID:3:21","VariableID:3:22","VariableID:3:23","VariableID:3:24","VariableID:3:26","VariableID:3:27","VariableID:3:28","VariableID:3:29","VariableID:3:30","VariableID:3:31","VariableID:3:32","VariableID:3:33","VariableID:3:34","VariableID:3:35","VariableID:3:36","VariableID:3:37","VariableID:3:38","VariableID:3:39","VariableID:3:40","VariableID:3:41","VariableID:3:42","VariableID:3:43","VariableID:3:44","VariableID:3:45","VariableID:3:46","VariableID:3:47","VariableID:3:56","VariableID:3:57","VariableID:3:58","VariableID:3:59","VariableID:3:60","VariableID:3:61","VariableID:3:62","VariableID:3:63","VariableID:3:64","VariableID:3:65","VariableID:3:66","VariableID:3:67"],"styles":{"Heading":"S:e5b90f46af0ff5c80bd09ef5fd5a8d4c8afe7b73,","HeadingMobile":"S:7027349a38d197032bfa0fd4bbdc951682088ba4,","Section":"S:a37e59f7fea568310e51fc778a317970b92fd2d7,","Body":"S:d516b67832deb206fc4e14132fc832095ceaf213,","Strong":"S:12c897156fefeb4cd396fdb7a2daee249a579b6e,","Label":"S:621f76ed473c0c47b521ec10fdf1f43b5551dd3b,","Small":"S:a3b5720fc0c3bd6bab16d2a01a08ebfe2ea41863,","Metric":"S:bce195fa81c9473aef73d08b37fa9f14c888a0e8,","MetricMobile":"S:b9305a0e0502a9feb0fec6c06738b5ad316dc600,"},"effect":"S:92270a51452fc456b83dc1597291319d6cc1a5f4,","font":"Arimo","counts":{"wrappers":6,"variables":56,"textStyles":9},"importedSpacing":[{"requested":4,"name":"Space/100","values":{"9:7":4}},{"requested":8,"name":"Space/200","values":{"9:7":8}},{"requested":12,"name":"Space/300","values":{"9:7":12}},{"requested":16,"name":"Space/400","values":{"9:7":16}},{"requested":24,"name":"Space/600","values":{"9:7":24}},{"requested":32,"name":"Space/800","values":{"9:7":32}}]};
const varEntries=await Promise.all(Object.entries(foundation.variables).map(async([name,id])=>[name,await figma.variables.getVariableByIdAsync(id)]));
const vars=Object.fromEntries(varEntries);
const affected=[];
const track=n=>{affected.push(n.id);return n};
const fill=(node,name)=>{node.fills=[figma.variables.setBoundVariableForPaint({type:"SOLID",color:{r:0,g:0,b:0}},"color",vars["color/"+name])];return node};
const stroke=(node,name="line")=>{node.strokes=[figma.variables.setBoundVariableForPaint({type:"SOLID",color:{r:0,g:0,b:0}},"color",vars["color/"+name])];node.setBoundVariable("strokeWeight",vars["border/1"]);node.strokeAlign="INSIDE";return node};
const radius=(node,value=12)=>{for(const key of ["topLeftRadius","topRightRadius","bottomLeftRadius","bottomRightRadius"])node.setBoundVariable(key,vars["radius/"+value]);return node};
const pad=(node,value)=>{for(const key of ["paddingLeft","paddingRight","paddingTop","paddingBottom"])node.setBoundVariable(key,vars["space/"+value]);return node};
const gap=(node,value)=>{node.setBoundVariable("itemSpacing",vars["space/"+value]);return node};
async function text(parent,value,role="Body",color="ink",width=null,name="Text"){
 const n=track(figma.createText());n.name=name;n.fontName={family:"Arimo",style:["Heading","HeadingMobile","Section","Strong","Metric","MetricMobile"].includes(role)?"Bold":"Regular"};
 await n.setTextStyleIdAsync(foundation.styles[role]);n.characters=value;fill(n,color);parent.appendChild(n);
 if(width!==null){n.textAutoResize="HEIGHT";n.resize(width,n.height);n.layoutSizingHorizontal="FIXED";}else n.textAutoResize="WIDTH_AND_HEIGHT";
 return n;
}
function layout(parent,name,width,direction="VERTICAL",background=null,padding=0,spacing=0){
 const n=track(figma.createAutoLayout(direction));n.name=name;n.resize(width,1);n.layoutSizingHorizontal="FIXED";n.layoutSizingVertical="HUG";n.fills=[];
 if(background)fill(n,background);if(padding)pad(n,padding);if(spacing)gap(n,spacing);
 parent.appendChild(n);return n;
}
const textProp=(comp,node,name)=>{const key=comp.addComponentProperty(name,"TEXT",node.characters);node.componentPropertyReferences={characters:key};return key};
const propertyKey=(node,name)=>Object.keys(node.componentProperties).find(k=>k.split("#")[0]===name);

const assets={"createdNodeIds":["4:48","4:49","4:55","4:56","4:60","4:61","4:65","4:66","4:70","4:71","4:74","4:75","4:79","4:80","4:83","4:84","4:89","4:90","4:95","4:96","4:101","4:102","4:107","4:108","4:112","4:88","4:94","4:100","4:106","4:114","4:121","4:123","4:130","4:131","4:113","4:122","4:133","4:135","4:136","4:132","4:134","4:138","4:139","4:141","4:142","4:144","4:145","4:146","4:137","4:140","4:143","4:148","4:149","4:150","4:152","4:153","4:154","4:155","4:147","4:151","4:157","4:158","4:160","4:161","4:162","4:156","4:159","4:164","4:165","4:166","4:170","4:171","4:172","4:176","4:177","4:178","4:181","4:163","4:169","4:175","4:183","4:184","4:185","4:186","4:187","4:189","4:190","4:191","4:192","4:193","4:195","4:196","4:197","4:198","4:199","4:200","4:182","4:188","4:194","4:202","4:203","4:204","4:205","4:206","4:207","4:211","4:212","4:213","4:216","4:201","4:210","4:218","4:219","4:220","4:221","4:222","4:224","4:225","4:226","4:227","4:228","4:229","4:217","4:223","I4:114;4:49","I4:114;4:50","I4:114;4:51","I4:114;4:52","I4:114;4:53","I4:114;4:54","I4:123;4:49","I4:123;4:50","I4:123;4:51","I4:123;4:52","I4:123;4:53","I4:123;4:54","I4:166;4:138","I4:166;4:139","I4:172;4:141","I4:172;4:142","I4:178;4:144","I4:178;4:145","I4:207;4:138","I4:207;4:139","I4:213;4:138","I4:213;4:139","4:50","4:51","4:52","4:53","4:54","4:57","4:58","4:59","4:62","4:63","4:64","4:67","4:68","4:69","4:72","4:73","4:76","4:77","4:78","4:81","4:82","4:85","4:86","4:87"],"sets":{"Button":{"id":"4:112","variants":[{"id":"4:88","name":"Style=Primary, State=Default"},{"id":"4:94","name":"Style=Primary, State=Disabled"},{"id":"4:100","name":"Style=Secondary, State=Default"},{"id":"4:106","name":"Style=Secondary, State=Disabled"}],"properties":{"Label#4:12":{"type":"TEXT","defaultValue":"Запустить"},"Icon#4:13":{"type":"INSTANCE_SWAP","defaultValue":"4:79","preferredValues":[]},"Show icon#4:14":{"type":"BOOLEAN","defaultValue":false},"Style":{"type":"VARIANT","defaultValue":"Primary","variantOptions":["Primary","Secondary"]},"State":{"type":"VARIANT","defaultValue":"Default","variantOptions":["Default","Disabled"]}}},"NavItem":{"id":"4:131","variants":[{"id":"4:113","name":"State=Default"},{"id":"4:122","name":"State=Active"}],"properties":{"Icon#4:19":{"type":"INSTANCE_SWAP","defaultValue":"4:48","preferredValues":[]},"Label#4:20":{"type":"TEXT","defaultValue":"Обзор завода"},"State":{"type":"VARIANT","defaultValue":"Default","variantOptions":["Default","Active"]}}},"Filter":{"id":"4:136","variants":[{"id":"4:132","name":"State=Default"},{"id":"4:134","name":"State=Selected"}],"properties":{"Label#4:23":{"type":"TEXT","defaultValue":"Все участки"},"State":{"type":"VARIANT","defaultValue":"Default","variantOptions":["Default","Selected"]}}},"Badge":{"id":"4:146","variants":[{"id":"4:137","name":"Status=Running"},{"id":"4:140","name":"Status=Warning"},{"id":"4:143","name":"Status=Stopped"}],"properties":{"Label#4:27":{"type":"TEXT","defaultValue":"В норме"},"Status":{"type":"VARIANT","defaultValue":"Running","variantOptions":["Running","Warning","Stopped"]}}},"Metric":{"id":"4:155","variants":[{"id":"4:147","name":"Size=Desktop"},{"id":"4:151","name":"Size=Mobile"}],"properties":{"Label#4:34":{"type":"TEXT","defaultValue":"Выпуск за смену"},"Value#4:35":{"type":"TEXT","defaultValue":"39 авто"},"Footer#4:36":{"type":"TEXT","defaultValue":"План: 44 · 88,6%"},"Size":{"type":"VARIANT","defaultValue":"Desktop","variantOptions":["Desktop","Mobile"]}}},"SectionHeader":{"id":"4:162","variants":[{"id":"4:156","name":"Size=Desktop"},{"id":"4:159","name":"Size=Mobile"}],"properties":{"Title#4:41":{"type":"TEXT","defaultValue":"Карта производственных участков"},"Subtitle#4:42":{"type":"TEXT","defaultValue":"Нажмите на участок для подробностей"},"Size":{"type":"VARIANT","defaultValue":"Desktop","variantOptions":["Desktop","Mobile"]}}},"MapZone":{"id":"4:181","variants":[{"id":"4:163","name":"Status=Running"},{"id":"4:169","name":"Status=Warning"},{"id":"4:175","name":"Status=Stopped"}],"properties":{"Title#4:49":{"type":"TEXT","defaultValue":"Сборочная линия"},"Subtitle#4:50":{"type":"TEXT","defaultValue":"20,0 ед./ч · 6 постов"},"Status":{"type":"VARIANT","defaultValue":"Running","variantOptions":["Running","Warning","Stopped"]}}},"Incident":{"id":"4:200","variants":[{"id":"4:182","name":"Severity=Critical"},{"id":"4:188","name":"Severity=Warning"},{"id":"4:194","name":"Severity=Resolved"}],"properties":{"Title#4:60":{"type":"TEXT","defaultValue":"Задержка комплектующих"},"Detail#4:61":{"type":"TEXT","defaultValue":"Логистика · подача ниже потребности сборки"},"Time#4:62":{"type":"TEXT","defaultValue":"10:00 · Ожидает реакции"},"Severity":{"type":"VARIANT","defaultValue":"Critical","variantOptions":["Critical","Warning","Resolved"]}}},"LineRow":{"id":"4:216","variants":[{"id":"4:201","name":"Size=Full"},{"id":"4:210","name":"Size=Compact"}],"properties":{"Name#4:72":{"type":"TEXT","defaultValue":"Финальная сборка"},"Load#4:73":{"type":"TEXT","defaultValue":"91%"},"Output#4:74":{"type":"TEXT","defaultValue":"39"},"Rate#4:75":{"type":"TEXT","defaultValue":"20,0"},"Downtime#4:76":{"type":"TEXT","defaultValue":"2"},"Status#4:77":{"type":"INSTANCE_SWAP","defaultValue":"4:137","preferredValues":[]},"Size":{"type":"VARIANT","defaultValue":"Full","variantOptions":["Full","Compact"]}}},"QualityCard":{"id":"4:229","variants":[{"id":"4:217","name":"Status=Normal"},{"id":"4:223","name":"Status=Attention"}],"properties":{"Title#4:87":{"type":"TEXT","defaultValue":"Окрасочный участок"},"Value#4:88":{"type":"TEXT","defaultValue":"97,6%"},"Detail#4:89":{"type":"TEXT","defaultValue":"42 операции · 1 дефектная ед."},"Status":{"type":"VARIANT","defaultValue":"Normal","variantOptions":["Normal","Attention"]}}}},"singles":{"Icon/Overview":"4:48","Icon/Lines":"4:55","Icon/Incidents":"4:60","Icon/Quality":"4:65","Icon/Reports":"4:70","Icon/Settings":"4:74","Icon/Play":"4:79","Icon/Clock":"4:83"},"counts":{"families":10,"icons":8,"nodes":170},"validation":{"fonts":"Arimo Regular/Bold loaded","spacing":"bound to source-compatible library tokens","editable":true}};
const components=Object.fromEntries(await Promise.all(Object.entries(assets.sets).map(async([name,item])=>[name,await figma.getNodeByIdAsync(item.id)])));
const icons=Object.fromEntries(await Promise.all(Object.entries(assets.singles).map(async([name,id])=>[name,await figma.getNodeByIdAsync(id)])));
const navTargets=[];
async function instance(parent,name,variant,props={},width=null,height=null){
 const cs=components[name];const comp=cs.children.find(n=>n.name===variant)||cs.defaultVariant;
 const node=track(comp.createInstance());parent.appendChild(node);
 const values={};for(const[key,value]of Object.entries(props)){const p=propertyKey(node,key);if(p)values[p]=String(value);}
 if(Object.keys(values).length)node.setProperties(values);
 if(width!==null)node.resize(width,height===null?node.height:height);
 if(name==="LineRow"){
  const nested=node.children.find(n=>n.type==="INSTANCE");
  const status=assets.sets.Badge.variants.find(v=>v.id===props.Status)?.name.split("=")[1]||"Running";
  if(nested)nested.setProperties({[propertyKey(nested,"Label")]:{Running:"В норме",Warning:"Внимание",Stopped:"Остановлена"}[status]});
 }
 if(name==="QualityCard"){
  const bar=node.children.find(n=>n.type==="FRAME"&&n.name==="Quality progress");
  const rect=bar?.children.find(n=>n.type==="RECTANGLE");
  const percent=Number(String(props.Value||"97,6%").replace("%","").replace(",","."));
  if(rect)rect.resize(((width||532)-48)*percent/100,8);
 }
 return node;
}
async function button(parent,label,style="Secondary",width=140){
 return instance(parent,"Button","Style="+style+", State=Default",{Label:label},width,40);
}
async function badge(parent,label,status="Running",width=126){
 return instance(parent,"Badge","Status="+status,{Label:label},width,26);
}
function divider(parent,width){const line=track(figma.createRectangle());line.name="Divider";line.resize(width,1);fill(line,"line");parent.appendChild(line);return line;}
async function card(parent,name,width,padding=24){
 const n=layout(parent,name,width,"VERTICAL","panel",padding,16);stroke(n);radius(n,16);await n.setEffectStyleIdAsync(foundation.effect);return n;
}
async function sectionHeader(parent,title,subtitle,width,mobile=false){
 const n=await instance(parent,"SectionHeader","Size="+(mobile?"Mobile":"Desktop"),{Title:title,Subtitle:subtitle},width);
 n.layoutSizingVertical="HUG";return n;
}
const lines=[
 {id:"body",name:"Кузовной цех",line:"Сварка кузова",load:"92%",output:"47",rate:"23,9",down:"3",status:"Running",quality:"97,9%",detail:"47 операций · 1 дефектная ед."},
 {id:"paint",name:"Окрасочный участок",line:"Окраска · линия 1",load:"86%",output:"42",rate:"20,6",down:"4",status:"Running",quality:"97,6%",detail:"42 операции · 1 дефектная ед."},
 {id:"assembly",name:"Сборочная линия",line:"Финальная сборка",load:"91%",output:"39",rate:"20,0",down:"2",status:"Warning",quality:"97,4%",detail:"39 операций · 1 дефектная ед."},
 {id:"logistics",name:"Логистика и склад",line:"Подача комплектующих",load:"38%",output:"51",rate:"10,6",down:"3",status:"Warning",quality:"100%",detail:"51 операция · дефектов нет"}
];
async function metrics(parent,width,mobile=false){
 const values=[
 ["Выпуск за смену","39 авто","План: 44 · 88,6%"],
 ["Загрузка линий","75,2%","Темп / мощность"],
 ["Доступность","97,5%","Простой: 12 машино-мин"],
 ["Первичное качество","97,4%","Годные / обработано"]
 ];
 const grid=layout(parent,"KPI",width,"VERTICAL",null,0,16);
 const perRow=mobile?2:4, itemWidth=(width-16*(perRow-1))/perRow;
 for(let start=0;start<4;start+=perRow){
  const row=layout(grid,"KPI row",width,"HORIZONTAL",null,0,16);
  for(const [label,value,footer]of values.slice(start,start+perRow))
   await instance(row,"Metric","Size="+(mobile?"Mobile":"Desktop"),{Label:label,Value:value,Footer:mobile?footer.replace(" · 88,6%",""):footer},itemWidth,132);
 }
 return grid;
}
async function map(parent,width,mobile=false){
 const c=await card(parent,"Factory map",width,mobile?16:24),inner=width-(mobile?32:48);
 await sectionHeader(c,mobile?"Карта участков":"Карта производственных участков","Условная схема · выберите участок",inner,mobile);
 const floor=layout(c,"Editable factory floor",inner,"VERTICAL","map",mobile?8:16,mobile?12:16);stroke(floor);radius(floor,12);
 const floorWidth=inner-(mobile?16:32),spacing=mobile?12:16,zoneWidth=(floorWidth-spacing)/2;
 for(let start=0;start<4;start+=2){
  const row=layout(floor,"Production area row",floorWidth,"HORIZONTAL",null,0,spacing);
  for(const l of lines.slice(start,start+2)){
   const title=mobile?{body:"Кузовной",paint:"Окраска",assembly:"Сборка",logistics:"Логистика"}[l.id]:l.name;
   const node=await instance(row,"MapZone","Status="+l.status,{Title:title,Subtitle:l.rate+" ед./ч"},zoneWidth,124);
   const nested=node.children.find(n=>n.type==="INSTANCE");
   if(nested){const label=propertyKey(nested,"Label");nested.setProperties({[label]:l.status==="Warning"?"Внимание":"В норме"});if(mobile)nested.resize(112,26);}
  }
 }
 const legend=layout(floor,"Legend",floorWidth,"HORIZONTAL",null,0,12);
 for(const [name,color]of [["В норме","success"],["Внимание","warning"],["Остановка","danger"]]){
  const item=layout(legend,name,mobile?84:130,"HORIZONTAL",null,0,4);item.counterAxisAlignItems="CENTER";
  const dot=track(figma.createEllipse());dot.resize(6,6);fill(dot,color);item.appendChild(dot);await text(item,name,"Small","muted");
 }
 await text(c,"Сборка зависит от подачи комплектующих из логистики.","Label","muted",inner);
 return c;
}
async function risk(parent,width){
 const c=layout(parent,"Buffer forecast",width,"VERTICAL","risk",16,12);stroke(c,"line");radius(c,12);
 const w=width-32;
 const head=layout(c,"Forecast header",w,"HORIZONTAL",null,0,8);head.counterAxisAlignItems="CENTER";
 await text(head,"Риск остановки","Strong","ink",w-134);
 await badge(head,"Высокий · 75/100","Stopped",126);
 const summary=await text(c,"45 минут до исчерпания буфера","Section","ink",w);
 await text(c,"При сохранении текущего потока деталей сборка может остановиться.","Body","muted",w);
 const facts=layout(c,"Inventory evidence",w,"VERTICAL",null,0,4);
 await text(facts,"Буфер: 12 комплектов","Label","muted",w);
 await text(facts,"Расход: 20/ч · подача: 4/ч","Label","muted",w);
 await text(facts,"Дефицит: 16 комплектов/ч","Label","muted",w);
 await text(c,"Индекс по правилам, не вероятность отказа. Данные демонстрационные.","Small","muted",w);
 await button(c,"Пополнить буфер · +30","Primary",w);
 return c;
}
async function incident(parent,title,detail,time,severity="Critical",width=344){
 const node=await instance(parent,"Incident","Severity="+severity,{Title:title,Detail:detail,Time:time},width,100);
 node.layoutSizingVertical="HUG";return node;
}
async function incidentPanel(parent,width){
 const c=await card(parent,"Incidents and forecast",width),w=width-48;
 await sectionHeader(c,"Инциденты и отклонения","1 событие требует реакции",w);
 await incident(c,"Задержка комплектующих","Логистика · подача 4/ч при потребности 20/ч","10:00 · Ожидает реакции","Critical",w);
 divider(c,w);await risk(c,w);return c;
}
async function graph(parent,width,title="Производительность сборки",buffer=false){
 const c=await card(parent,buffer?"Buffer trend":"Throughput chart",width),w=width-48;
 await sectionHeader(c,title,buffer?"Комплекты · прогноз при текущем потоке":"Единиц в час · фактический темп и мощность",w);
 const area=layout(c,"Chart surface",w,"VERTICAL",null,0,8);
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="140" viewBox="0 0 600 140" preserveAspectRatio="none"><g stroke="#e9edf1" stroke-width="1"><path d="M0 20H600 M0 55H600 M0 90H600 M0 125H600"/></g><path d="M0 54L600 54" stroke="#aab4bf" stroke-dasharray="5 5" fill="none"/><path d="'+(buffer?'M0 20 L70 22 L140 20 L210 40 L280 59 L350 78 L420 96 L490 115 L600 139':'M0 82 C30 80 42 69 70 70 S125 84 150 70 S200 55 225 61 S267 68 300 60 S346 58 375 52 S421 64 450 47 S499 59 525 44 S566 47 600 40')+'" fill="none" stroke="#86ad33" stroke-width="3"/></svg>';
 const native=track(figma.createNodeFromSvg(svg));native.name="Editable vector plot";area.appendChild(native);
 const labels=layout(c,"Time axis",w,"HORIZONTAL");labels.primaryAxisAlignItems="SPACE_BETWEEN";
 await text(labels,"08:00","Small","muted");await text(labels,"09:00","Small","muted");await text(labels,"10:00","Small","muted");
 await text(c,buffer?"Линейный тренд по истории · обновляется после вмешательства":"Мощность сборки: 22 ед./ч · выпуск за смену: 39 авто","Label","muted",w);
 return c;
}
async function table(parent,width,compact=false){
 const c=await card(parent,"Production lines table",width),w=width-48;
 await sectionHeader(c,"Состояние производственных линий","Показатели текущей смены",w);
 const head=layout(c,"Column names",w,"HORIZONTAL");head.itemSpacing=0;
 const headers=compact?[["Линия",230],["Загрузка",100],["Статус",126]]:[["Линия",284],["Загрузка",120],["Выпуск, ед.",120],["Темп, ед./ч",130],["Простой, мин",130],["Статус",126]];
 for(const [label,cellWidth]of headers)await text(head,label,"Small","muted",cellWidth);
 const rows=layout(c,"Rows",w,"VERTICAL");
 for(const l of lines){
  divider(rows,w);
  await instance(rows,"LineRow","Size="+(compact?"Compact":"Full"),{Name:l.line,Load:l.load,Output:l.output,Rate:l.rate,Downtime:l.down,Status:assets.sets.Badge.variants.find(v=>v.name==="Status="+l.status).id},w,compact?44:56);
 }
 await text(c,"Выпуск завода считается по финальной сборке. Операции разных цехов не суммируются.","Small","muted",w);
 return c;
}
const pageTitles={Overview:["Цифровой двойник завода","Наблюдайте за линиями и предупреждайте остановки"],Lines:["Производственные линии","Оборудование, загрузка и выпуск по участкам"],Incidents:["Остановки и инциденты","Найдите причину отклонения и восстановите процесс"],Quality:["Качество продукции","Выход годных операций с первого прохода"],Reports:["Отчёты и аналитика","Итоги смены, экспорт и действия оператора"]};
async function sidebar(parent,current){
 const n=layout(parent,"Sidebar",240,"VERTICAL","nav",16,24);n.layoutSizingVertical="FILL";
 const brand=layout(n,"Brand",208,"HORIZONTAL",null,0,12);brand.counterAxisAlignItems="CENTER";
 const logo=layout(brand,"Brand mark",36,"HORIZONTAL","lime");logo.resize(36,36);logo.layoutSizingVertical="FIXED";logo.primaryAxisAlignItems="CENTER";logo.counterAxisAlignItems="CENTER";radius(logo,8);await text(logo,"A","Strong");
 const brandText=layout(brand,"Brand wordmark",160,"VERTICAL",null,0,4);await text(brandText,"ALLUR","Section","panel");await text(brandText,"PLANT INTELLIGENCE","Small","navText");
 await text(n,"РАБОЧЕЕ ПРОСТРАНСТВО","Small","navText",208);
 const list=layout(n,"Navigation",208,"VERTICAL",null,0,8);
 const nav=[["Overview","Обзор завода"],["Lines","Производственные линии"],["Incidents","Остановки и инциденты"],["Quality","Качество продукции"],["Reports","Отчёты и аналитика"]];
 for(const [target,label]of nav){
  const node=await instance(list,"NavItem","State="+(target===current?"Active":"Default"),{Label:label,Icon:icons["Icon/"+target].id},208,44);
  navTargets.push({id:node.id,target});
 }
 const spacer=layout(n,"Flexible sidebar space",208);spacer.layoutSizingVertical="FILL";
 const footer=layout(n,"Model status",208,"VERTICAL","navActive",16,8);radius(footer,12);
 await text(footer,"● Демонстрационный режим","Label","panel",176);await text(footer,"Четыре участка · локальная модель","Small","navText",176);
 return n;
}
async function controls(parent,width,mobile=false){
 const c=layout(parent,"Simulation controls",width,"VERTICAL","panel",12,12);stroke(c);radius(c,12);
 const row=layout(c,"Playback controls",width-24,"HORIZONTAL",null,0,8);
 await button(row,"Запустить","Primary",mobile?144:140);await button(row,"+5 минут","Secondary",mobile?122:120);
 if(!mobile){await button(row,"Темп ×1","Secondary",100);const spacer=layout(row,"Flexible gap",50);spacer.layoutSizingHorizontal="FILL";await text(row,"Сценарий","Label","muted");await button(row,"Задержка деталей","Secondary",188);await button(row,"Сбросить","Secondary",96);}
 else {const second=layout(c,"Scenario row",width-24,"HORIZONTAL",null,0,8);await button(second,"Задержка деталей","Secondary",194);await button(second,"Сбросить","Secondary",96);}
 return c;
}
async function filters(parent,width,mobile=false){
 const row=layout(parent,"Area filters",width,"HORIZONTAL",null,0,8);
 for(const [i,label]of(mobile?["Все участки","Сборка","Логистика"]:["Все участки","Кузовной цех","Окрасочный","Сборочная линия","Логистика"]).entries()){
  await instance(row,"Filter","State="+(i===0?"Selected":"Default"),{Label:label},mobile?[116,95,115][i]:[126,146,136,166,118][i],34);
 }
 return row;
}
async function desktop(key){
 const root=await figma.getNodeByIdAsync(foundation.wrappers[key]);
 if(root.children.length)throw new Error("Screen already populated: "+key);
 root.placeholder=false;root.layoutSizingVertical="HUG";root.counterAxisAlignItems="MIN";
 await sidebar(root,key);
 const main=layout(root,"Main content",1200,"VERTICAL",null,32,24),w=1136;
 const top=layout(main,"Top bar",w,"HORIZONTAL",null,0,16);top.counterAxisAlignItems="CENTER";
 await text(top,"Производство / "+(key==="Overview"?"Обзор завода":pageTitles[key][0]),"Label","muted");
 const topSpacer=layout(top,"Flexible top space",100);topSpacer.layoutSizingHorizontal="FILL";
 await button(top,"Дневная смена · 08:00–20:00","Secondary",248);await badge(top,"Модель · 10:00","Running",126);
 divider(main,w);
 const heading=layout(main,"Page heading",w,"VERTICAL",null,0,8);
 await text(heading,"КОСТАНАЙ · КЕЙС №2","Small","muted");
 await text(heading,pageTitles[key][0],"Heading","ink",w);await text(heading,pageTitles[key][1],"Body","muted",w);
 await controls(main,w);await filters(main,w);
 if(key==="Overview"){
  await metrics(main,w);
  const body=layout(main,"Map and forecast",w,"HORIZONTAL",null,0,16);await map(body,728);await incidentPanel(body,392);
  const bottom=layout(main,"Trend and inventory",w,"HORIZONTAL",null,0,16);await graph(bottom,560);await graph(bottom,560,"Динамика буфера сборки",true);
  await table(main,w);
 }
 if(key==="Lines"){
  await metrics(main,w);await table(main,w);
  const charts=layout(main,"Line charts",w,"HORIZONTAL",null,0,16);await graph(charts,560,"Сварка кузова · темп");await graph(charts,560,"Сборочная линия · темп");
 }
 if(key==="Incidents"){
  const body=layout(main,"Incident workspace",w,"HORIZONTAL",null,0,16);
  const log=await card(body,"Incident journal",728);
  await sectionHeader(log,"Журнал инцидентов","1 активное событие · 2 устранённых",680);
  await incident(log,"Задержка подачи комплектующих","Буфер S-2: 12 комплектов · подача ниже расхода","10:00 · Ожидает реакции","Critical",680);
  await button(log,"Принять в работу","Secondary",196);divider(log,680);
  await incident(log,"Маршрут AGV-3 восстановлен","Логистика · робот вернулся к штатному маршруту","09:35 · Устранено","Resolved",680);divider(log,680);
  await incident(log,"Проверка окрасочной камеры","Фильтр F-08 проверен, параметры в пределах нормы","09:10 · Устранено","Resolved",680);
  await text(log,"Принятие события в работу не устраняет его причину. После восстановления подачи инцидент закрывается.","Label","muted",680);
  const side=await card(body,"Intervention",392);await sectionHeader(side,"Действие оператора","Восстановите поток деталей",344);await risk(side,344);
  await text(side,"При пополнении на 30 комплектов подача восстанавливается до 21/ч. Изменения сохраняются в журнале.","Label","muted",344);
 }
 if(key==="Quality"){
  const grid=layout(main,"Quality cards",w,"VERTICAL",null,0,16);
  for(let i=0;i<4;i+=2){const row=layout(grid,"Quality row",w,"HORIZONTAL",null,0,16);for(const l of lines.slice(i,i+2))await instance(row,"QualityCard","Status=Normal",{Title:l.name,Value:l.quality,Detail:l.detail},560,212);}
  const note=await card(main,"Quality methodology",w);await sectionHeader(note,"Как считаем качество","Показатель каждой производственной операции",1088);
  await text(note,"Качество = годные операции / все обработанные операции. Контрольный порог — 97%. В модели количество дефектов может быть дробным: это ожидаемый объём брака.","Body","muted",1088);
  await text(note,"После корректировки параметров улучшаются новые операции; история дефектов сохраняется.","Label","muted",1088);
  await button(note,"Сценарий дефектов окраски","Primary",276);
 }
 if(key==="Reports"){
  const summary=await card(main,"Shift report",w);
  await sectionHeader(summary,"Отчёт за текущую смену","Срез на 10:00 · весь завод",1088);
  await text(summary,"39 автомобилей из 44 по плану","Heading","ink",1088);
  await text(summary,"Загрузка: 75,2% · доступность: 97,5% · первичное качество: 97,4%\nПростой оборудования: 12 машино-мин · активные инциденты: 1","Body","muted",1088);
  const exports=layout(summary,"Export actions",1088,"HORIZONTAL",null,0,12);await button(exports,"Скачать CSV","Primary",160);await button(exports,"Отчёт .txt","Secondary",160);await button(exports,"Печать / PDF","Secondary",160);
  await table(main,w);
  const journal=await card(main,"Operator actions",w);await sectionHeader(journal,"Журнал действий оператора","Текущая демонстрационная сессия",1088);
  await text(journal,"10:00   Выбран сценарий «Задержка деталей»\n10:05   Инцидент принят в работу\n10:10   Буфер пополнен: +30 комплектов; подача восстановлена","Body","muted",1088);
  await text(journal,"Пример журнала демонстрирует вмешательство. Значения верхнего отчёта относятся к начальному снимку.","Small","muted",1088);
 }
 await text(main,"Allur Plant Twin · данные синтетические · карта и оборудование условные","Small","muted",w);
 return root;
}
async function mobile(){
 const root=await figma.getNodeByIdAsync(foundation.wrappers.Mobile);
 if(root.children.length)throw new Error("Mobile screen already populated");
 root.placeholder=false;root.layoutSizingVertical="HUG";pad(root,16);gap(root,16);const w=358;
 const top=layout(root,"Mobile top bar",w,"HORIZONTAL",null,0,12);top.primaryAxisAlignItems="SPACE_BETWEEN";await text(top,"ALLUR","Section");await badge(top,"Модель · 10:00","Running",126);
 await button(root,"Обзор завода","Secondary",w);
 const heading=layout(root,"Mobile heading",w,"VERTICAL",null,0,8);await text(heading,"Цифровой двойник завода","HeadingMobile","ink",w);await text(heading,"Состояние участков и прогноз остановки","Label","muted",w);
 await controls(root,w,true);await filters(root,w,true);await metrics(root,w,true);
 await map(root,w,true);
 const panel=await card(root,"Mobile incident",w,16);await sectionHeader(panel,"Инциденты","1 событие требует реакции",w-32,true);await incident(panel,"Задержка комплектующих","Подача: 4/ч · потребность: 20/ч","10:00 · Ожидает реакции","Critical",w-32);
 await risk(root,w);
 await graph(root,w,"Темп финальной сборки");
 await text(root,"Данные демонстрационные. Условная схема завода.","Small","muted",w);
 return root;
}
