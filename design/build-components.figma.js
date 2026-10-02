
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
/**
 * createComponentWithVariants
 *
 * Creates a component set by generating all combinations of `variantAxes`,
 * building one Figma component per combination, then calling
 * `figma.combineAsVariants` to produce the component set. After combining,
 * the variants are repositioned into a grid so they don't all stack at (0, 0).
 *
 * @param {{
 *   name: string,
 *   description?: string,
 *   variantAxes: Record<string, string[]>,
 *   baseProps: {
 *     width: number,
 *     height: number,
 *     fills?: Paint[],
 *     padding?: {top?: number, bottom?: number, left?: number, right?: number},
 *     radius?: number,
 *     layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE',
 *     itemSpacing?: number
 *   },
 *   page: PageNode
 * }} config
 *   - `name`: Component set name (e.g. "Button").
 *   - `description`: Optional human-readable purpose and usage guidance.
 *   - `variantAxes`: Each key is a variant property name; each value is an array of
 *     allowed values. All combinations are generated (Cartesian product).
 *     Example: { Size: ['Small', 'Medium', 'Large'], Style: ['Primary', 'Ghost'] }
 *     produces 6 variants.
 *   - `baseProps`: Visual properties applied to every variant.
 *   - `page`: The PageNode to create components on (must be set as current page by caller).
 * @returns {Promise<{
 *   componentSet: ComponentSetNode,
 *   variants: ComponentNode[]
 * }>}
 */
async function createComponentWithVariants(config) {
  const { name, variantAxes, baseProps, page } = config

  // Ensure we are on the correct page
  // page context already selected once by the caller

  // Compute Cartesian product of variant axes
  const axisNames = Object.keys(variantAxes)
  const axisValues = axisNames.map((k) => variantAxes[k])
  const combinations = cartesianProduct(axisValues)

  // Build one component per combination
  const components = []
  for (const combo of combinations) {
    const comp = figma.createComponent()

    // Name: "Property=Value, Property=Value, ..."
    comp.name = axisNames.map((ax, i) => `${ax}=${combo[i]}`).join(', ')

    // Base geometry
    comp.resize(baseProps.width, baseProps.height)

    // Fills
    if (baseProps.fills !== undefined) {
      comp.fills = baseProps.fills
    } else {
      comp.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }]
    }

    // Corner radius
    if (baseProps.radius !== undefined) {
      comp.cornerRadius = baseProps.radius
    }

    // Auto-layout
    if (baseProps.layoutMode && baseProps.layoutMode !== 'NONE') {
      comp.layoutMode = baseProps.layoutMode
      comp.primaryAxisAlignItems = 'CENTER'
      comp.counterAxisAlignItems = 'CENTER'
      if (baseProps.itemSpacing !== undefined) {
        comp.itemSpacing = baseProps.itemSpacing
      }
    }

    // Padding
    if (baseProps.padding) {
      comp.paddingTop = baseProps.padding.top ?? 0
      comp.paddingBottom = baseProps.padding.bottom ?? 0
      comp.paddingLeft = baseProps.padding.left ?? 0
      comp.paddingRight = baseProps.padding.right ?? 0
    }

    page.appendChild(comp)
    if (config.populate) await config.populate(comp, Object.fromEntries(axisNames.map((ax,i)=>[ax,combo[i]])))
    components.push(comp)
  }

  // Combine into a component set
  const componentSet = figma.combineAsVariants(components, page)
  componentSet.name = name
  if (config.description) {
    componentSet.description = config.description
  }

  // Grid layout — variants stack at (0, 0) after combineAsVariants; reposition them.
  const GRID_GAP = 16
  const cols = Math.max(1, axisValues[axisValues.length - 1]?.length ?? 1)
  const variantWidth = baseProps.width
  const variantHeight = baseProps.height

  componentSet.children.forEach((variant, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    variant.x = col * (variantWidth + GRID_GAP)
    variant.y = row * (variantHeight + GRID_GAP)
  })

  // Resize component set to wrap its children with padding
  const totalCols = Math.min(cols, combinations.length)
  const totalRows = Math.ceil(combinations.length / cols)
  const PADDING = 40
  componentSet.resize(
    totalCols * variantWidth + (totalCols - 1) * GRID_GAP + PADDING * 2,
    totalRows * variantHeight + (totalRows - 1) * GRID_GAP + PADDING * 2,
  )

  // Position component set at a safe canvas location
  componentSet.x = 480
  componentSet.y = 80

  return { componentSet, variants: componentSet.children }
}

/**
 * Computes the Cartesian product of multiple arrays.
 * cartesianProduct([[A, B], [1, 2]]) → [[A,1], [A,2], [B,1], [B,2]]
 *
 * @param {Array<string[]>} arrays
 * @returns {string[][]}
 */
function cartesianProduct(arrays) {
  return arrays.reduce(
    (acc, curr) => acc.flatMap((combo) => curr.map((val) => [...combo, val])),
    [[]],
  )
}

const sets={}, singles={};
let componentY=100;
async function family(name,axes,width,height,build){
 if(page.children.some(n=>n.name==="Allur / "+name))throw new Error("Component already exists: "+name);
 const out=await createComponentWithVariants({name:"Allur / "+name,description:"Source-aligned "+name+" for Allur Plant Twin",variantAxes:axes,baseProps:{width,height,fills:[],layoutMode:"VERTICAL"},page,populate:async(comp,v)=>{comp.primaryAxisAlignItems="MIN";comp.counterAxisAlignItems="MIN";await build(comp,v)}});
 const cs=out.componentSet;track(cs);cs.x=10200;cs.y=componentY;
 for(const comp of out.variants)track(comp);
 componentY+=cs.height+50;sets[name]={id:cs.id,variants:cs.children.map(n=>({id:n.id,name:n.name})),properties:cs.componentPropertyDefinitions};
 return out;
}
const iconPaths={
 Overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 Lines:'<path d="M3 21V9l6 3V7l6 3V4h6v17H3Z"/><path d="M7 16h2m4 0h2m2 0h2"/>',
 Incidents:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v1"/>',
 Quality:'<path d="M12 3 3 7v6c0 4 9 8 9 8s9-4 9-8V7l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
 Reports:'<path d="M4 3v18h17M8 17v-5m5 5V7m5 10V4"/>',
 Settings:'<path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z"/><circle cx="12" cy="12" r="3"/>',
 Play:'<path d="m8 5 12 7-12 7V5Z"/>', Clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>'
};
for(const [name,paths]of Object.entries(iconPaths)){
 const comp=track(figma.createComponent());comp.name="Allur / Icon / "+name;comp.resize(20,20);comp.fills=[];comp.x=11200;comp.y=100+Object.keys(singles).length*60;
 const svg=track(figma.createNodeFromSvg('<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#667483" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths+'</g></svg>'));
 comp.appendChild(svg);singles["Icon/"+name]=comp.id;
}
const icons=Object.fromEntries(await Promise.all(Object.entries(singles).map(async([key,id])=>[key,await figma.getNodeByIdAsync(id)])));
await family("Button",{Style:["Primary","Secondary"],State:["Default","Disabled"]},160,40,async(comp,v)=>{
 comp.layoutMode="HORIZONTAL";comp.primaryAxisAlignItems="CENTER";comp.counterAxisAlignItems="CENTER";pad(comp,12);gap(comp,8);radius(comp,8);
 fill(comp,v.Style==="Primary"?"lime":"panel");if(v.Style==="Secondary")stroke(comp);
 const label=await text(comp,"Запустить","Strong",v.State==="Disabled"?"muted":"ink",null,"Label");textProp(comp,label,"Label");
 const icon=track(icons["Icon/Play"].createInstance());comp.insertChild(0,icon);
 const k=comp.addComponentProperty("Icon","INSTANCE_SWAP",icons["Icon/Play"].id),show=comp.addComponentProperty("Show icon","BOOLEAN",false);
 icon.componentPropertyReferences={mainComponent:k,visible:show};icon.visible=false;
 if(v.State==="Disabled")comp.opacity=.45;
});
await family("NavItem",{State:["Default","Active"]},208,44,async(comp,v)=>{
 comp.layoutMode="HORIZONTAL";comp.counterAxisAlignItems="CENTER";pad(comp,12);gap(comp,12);radius(comp,8);
 fill(comp,v.State==="Active"?"navActive":"nav");
 const icon=track(icons["Icon/Overview"].createInstance());comp.appendChild(icon);
 const key=comp.addComponentProperty("Icon","INSTANCE_SWAP",icons["Icon/Overview"].id);icon.componentPropertyReferences={mainComponent:key};
 const label=await text(comp,"Обзор завода","Body",v.State==="Active"?"panel":"navText",164,"Label");textProp(comp,label,"Label");
});
await family("Filter",{State:["Default","Selected"]},130,34,async(comp,v)=>{
 comp.layoutMode="HORIZONTAL";comp.primaryAxisAlignItems="CENTER";comp.counterAxisAlignItems="CENTER";pad(comp,8);radius(comp,8);
 fill(comp,v.State==="Selected"?"ink":"panel");if(v.State==="Default")stroke(comp);
 const label=await text(comp,"Все участки","Label",v.State==="Selected"?"panel":"muted",null,"Label");textProp(comp,label,"Label");
});
await family("Badge",{Status:["Running","Warning","Stopped"]},126,26,async(comp,v)=>{
 comp.layoutMode="HORIZONTAL";comp.counterAxisAlignItems="CENTER";pad(comp,4);gap(comp,4);radius(comp,8);
 const tone={Running:"success",Warning:"warning",Stopped:"danger"}[v.Status];fill(comp,tone+"Soft");
 const dot=track(figma.createEllipse());dot.name="Status dot";dot.resize(6,6);fill(dot,tone);comp.appendChild(dot);
 const label=await text(comp,{Running:"В норме",Warning:"Внимание",Stopped:"Остановлена"}[v.Status],"Label",tone+"Ink",null,"Label");textProp(comp,label,"Label");
});
await family("Metric",{Size:["Desktop","Mobile"]},264,132,async(comp,v)=>{
 fill(comp,"panel");stroke(comp);radius(comp,16);pad(comp,16);gap(comp,8);await comp.setEffectStyleIdAsync(foundation.effect);
 const label=await text(comp,"Выпуск за смену","Label","muted",232,"Label");textProp(comp,label,"Label");
 const value=await text(comp,"39 авто",v.Size==="Mobile"?"MetricMobile":"Metric","ink",null,"Value");textProp(comp,value,"Value");
 const footer=await text(comp,"План: 44 · 88,6%","Small","muted",232,"Footer");textProp(comp,footer,"Footer");
});
await family("SectionHeader",{Size:["Desktop","Mobile"]},620,50,async(comp,v)=>{
 fill(comp,"panel");gap(comp,4);
 const t=await text(comp,"Карта производственных участков","Section","ink",v.Size==="Mobile"?310:620,"Title");textProp(comp,t,"Title");
 const s=await text(comp,"Нажмите на участок для подробностей","Label","muted",v.Size==="Mobile"?310:620,"Subtitle");textProp(comp,s,"Subtitle");
});
await family("MapZone",{Status:["Running","Warning","Stopped"]},264,124,async(comp,v)=>{
 fill(comp,"panel");stroke(comp);radius(comp,12);pad(comp,16);gap(comp,8);
 const title=await text(comp,"Сборочная линия","Strong","ink",232,"Title");textProp(comp,title,"Title");
 const sub=await text(comp,"20,0 ед./ч · 6 постов","Label","muted",232,"Subtitle");textProp(comp,sub,"Subtitle");
 const variant=await figma.getNodeByIdAsync(sets.Badge.variants.find(x=>x.name==="Status="+v.Status).id);
 const badge=track(variant.createInstance());comp.appendChild(badge);
});
await family("Incident",{Severity:["Critical","Warning","Resolved"]},352,100,async(comp,v)=>{
 fill(comp,"panel");gap(comp,8);pad(comp,8);
 const line=layout(comp,"Title row",336,"HORIZONTAL",null,0,8);
 const dot=track(figma.createEllipse());dot.resize(8,8);fill(dot,{Critical:"danger",Warning:"warning",Resolved:"success"}[v.Severity]);line.appendChild(dot);
 const title=await text(line,"Задержка комплектующих","Strong","ink",306,"Title");textProp(comp,title,"Title");
 const detail=await text(comp,"Логистика · подача ниже потребности сборки","Label","muted",336,"Detail");textProp(comp,detail,"Detail");
 const time=await text(comp,"10:00 · Ожидает реакции","Small","muted",336,"Time");textProp(comp,time,"Time");
});
await family("LineRow",{Size:["Full","Compact"]},1048,56,async(comp,v)=>{
 comp.layoutMode="HORIZONTAL";comp.counterAxisAlignItems="CENTER";comp.itemSpacing=0;comp.fills=[];
 const columns=v.Size==="Full"?[["Name","Финальная сборка",284],["Load","91%",120],["Output","39",120],["Rate","20,0",130],["Downtime","2",130]]:[["Name","Финальная сборка",230],["Load","91%",100]];
 for(const [name,value,width]of columns){const cell=await text(comp,value,name==="Name"?"Body":"Label","ink",width,name);textProp(comp,cell,name);}
 const badgeComp=await figma.getNodeByIdAsync(sets.Badge.variants.find(x=>x.name==="Status=Running").id);
 const badge=track(badgeComp.createInstance());badge.name="Status";comp.appendChild(badge);
 const p=comp.addComponentProperty("Status","INSTANCE_SWAP",badgeComp.id);badge.componentPropertyReferences={mainComponent:p};
 if(v.Size==="Compact")comp.resize(468,56);
});
await family("QualityCard",{Status:["Normal","Attention"]},532,202,async(comp,v)=>{
 fill(comp,"panel");stroke(comp);radius(comp,16);pad(comp,24);gap(comp,12);
 const name=await text(comp,"Окрасочный участок","Section","ink",484,"Title");textProp(comp,name,"Title");
 const value=await text(comp,"97,6%","Metric","ink",null,"Value");textProp(comp,value,"Value");
 const bar=layout(comp,"Quality progress",484,"HORIZONTAL","map");bar.resize(484,8);bar.layoutSizingVertical="FIXED";radius(bar,8);
 const progress=track(figma.createRectangle());progress.resize(v.Status==="Normal"?470:425,8);fill(progress,v.Status==="Normal"?"success":"warning");bar.appendChild(progress);
 const sub=await text(comp,"42 операции · 1 дефектная ед.","Label","muted",484,"Detail");textProp(comp,sub,"Detail");
});
const allRoots=[...Object.values(sets).map(v=>v.id),...Object.values(singles)];
const allNodes=await Promise.all(allRoots.map(id=>figma.getNodeByIdAsync(id)));
const allIds=[...new Set(affected.concat(allNodes.flatMap(n=>n.findAll(()=>true).map(x=>x.id))))];
return {createdNodeIds:allIds,sets,singles,counts:{families:Object.keys(sets).length,icons:Object.keys(singles).length,nodes:allIds.length},validation:{fonts:"Arimo Regular/Bold loaded",spacing:"bound to source-compatible library tokens",editable:true}};

