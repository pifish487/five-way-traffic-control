/* 五岔路口：C 仅出、E 仅进，故共有 3+3+3+4=13 条路线。 */
const points = { A:[330,510], B:[55,300], C:[270,35], D:[600,190], E:[570,430] };
const incoming = ['A','B','D','E'];
const exits = { A:['B','C','D'], B:['A','C','D'], D:['A','B','C'], E:['A','B','C','D'] };
const routes = Object.entries(exits).flatMap(([from,tos]) => tos.map(to => ({
  id: from + '→' + to, from, to, queue: 0, waited: 0, active: false
})));
const canvas = document.querySelector('#junction'), ctx = canvas.getContext('2d');
let state = 'green', remain = 6, active = [], elapsed = 0, autoTimer = 0;

// 用二次贝塞尔曲线近似车道轨迹。轨迹距离过小、共用进口或出口时即判为冲突。
function path(route) {
  const [x1,y1] = points[route.from], [x2,y2] = points[route.to];
  const midX = (x1+x2)/2, midY = (y1+y2)/2;
  // 转弯轨迹向路口中心微调；让不同车流呈现可读的交叉关系。
  const cx = midX + (330-midX)*0.45, cy = midY + (280-midY)*0.45;
  return Array.from({length:31}, (_,i) => {
    const t=i/30, q=1-t;
    return [q*q*x1+2*q*t*cx+t*t*x2, q*q*y1+2*q*t*cy+t*t*y2];
  });
}
routes.forEach(r => r.path=path(r));
function distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function conflicts(a,b) {
  if (a.id === b.id) return false;
  if (a.from === b.from || a.to === b.to) return true; // 同进口/同出口的交织与汇合
  // 入口或出口附近的点不计入，避免共用道路端点导致误判
  for(let i=3;i<28;i++) for(let j=3;j<28;j++) if(distance(a.path[i],b.path[j]) < 20) return true;
  return false;
}
const conflictMap = new Map(routes.map(r => [r.id, new Set(routes.filter(x=>conflicts(r,x)).map(x=>x.id))]));

function choosePhase() {
  const candidates = routes.filter(r => r.queue > 0).sort((a,b) =>
    (b.queue*10+b.waited) - (a.queue*10+a.waited));
  const chosen=[];
  for (const r of candidates) if (chosen.every(c => !conflictMap.get(r.id).has(c.id))) chosen.push(r);
  // 无车辆时，循环展示一条路线，避免界面空白。
  return chosen.length ? chosen : [routes[Math.floor(Math.random()*routes.length)]];
}
function writeLog(text) {
  const item=document.createElement('li'); item.textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false})+'　'+text;
  document.querySelector('#log').prepend(item);
  while(document.querySelector('#log').children.length>8) document.querySelector('#log').lastChild.remove();
}
function switchPhase() {
  active=choosePhase(); routes.forEach(r=>r.active=active.includes(r));
  state='green'; remain=6;
  writeLog('绿灯放行：'+active.map(r=>r.id).join('、'));
}
function tick() {
  elapsed++;
  if (document.querySelector('#autoTraffic').checked) {
    autoTimer++; if(autoTimer>=2){autoTimer=0; const r=routes[Math.floor(Math.random()*routes.length)]; r.queue=Math.min(12,r.queue+1);}
  }
  if(state==='green') {
    active.forEach(r=>{if(r.queue>0) r.queue--;});
    routes.forEach(r=>{r.waited=r.active?0:Math.min(60,r.waited+1)});
  }
  remain--;
  if(remain<=0) {
    if(state==='green'){state='yellow';remain=2;writeLog('黄灯：准备切换相位');}
    else if(state==='yellow'){state='allred';remain=1;writeLog('全红：清空路口');}
    else switchPhase();
  }
  render();
}
function drawRoad(a,b) {
  ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.strokeStyle='#6d7f91';ctx.lineWidth=45;ctx.stroke();ctx.strokeStyle='#e7edf2';ctx.lineWidth=2;ctx.setLineDash([8,8]);ctx.stroke();ctx.setLineDash([]);
}
function draw() {
  ctx.clearRect(0,0,660,540); ctx.fillStyle='#cfeafd';ctx.fillRect(0,0,660,540);
  ['A','B','C','D','E'].forEach(k=>drawRoad([330,280],points[k]));
  // 静态路线以浅灰显示，绿灯路线以绿色突出
  routes.forEach(r=>{ctx.beginPath();r.path.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=r.active&&state==='green'?'#16a36a':'#b8c4d0';ctx.lineWidth=r.active&&state==='green'?5:1.5;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);});
  Object.entries(points).forEach(([name,[x,y]])=>{ctx.fillStyle='#172033';ctx.font='bold 25px Microsoft YaHei';ctx.fillText(name,x-8,y+(name==='C'?-12:8));});
  // 为有队列路线画车辆点
  routes.forEach(r=>{if(!r.queue)return; const p=r.path[2];ctx.fillStyle=r.active&&state==='green'?'#16a36a':'#e8793e';ctx.beginPath();ctx.arc(p[0],p[1],7+Math.min(r.queue,5),0,Math.PI*2);ctx.fill();});
}
function render() {
  draw();
  const labels={green:'绿灯放行',yellow:'黄灯转换',allred:'全红清空'};
  const colors={green:'#16a36a',yellow:'#e5a900',allred:'#e74b4b'};
  document.querySelector('#stage').textContent=labels[state];document.querySelector('#countdown').textContent=remain+' s';document.querySelector('#lightDot').style.background=colors[state];
  document.querySelector('#activeRoutes').textContent=state==='green'?active.map(r=>r.id).join('、'):'等待下一安全相位';
  document.querySelector('#routeTable').innerHTML=routes.map(r=>`<div class="route-row ${r.active&&state==='green'?'active':''}"><b>${r.id}</b><span class="bar"><i style="width:${Math.min(100,r.queue*12)}%"></i></span><span>${r.queue} 辆</span></div>`).join('');
}
function setup() {
  document.querySelector('#routeButtons').innerHTML=routes.map(r=>`<button data-id="${r.id}">${r.id}　+1</button>`).join('');
  document.querySelector('#routeButtons').onclick=e=>{const id=e.target.dataset.id;if(id){const r=routes.find(x=>x.id===id);r.queue=Math.min(12,r.queue+1);render();}};
  document.querySelector('#reset').onclick=()=>{routes.forEach(r=>{r.queue=0;r.waited=0});writeLog('仿真已重置');switchPhase();};
  // 作业示例的兼容/冲突关系由自动冲突检测得到并用于相位选择。
  active=[routes.find(r=>r.id==='A→B'),routes.find(r=>r.id==='E→C')];routes.forEach(r=>r.active=active.includes(r));
  writeLog('系统启动：A→B 与 E→C 可同时放行');render();setInterval(tick,1000);
}
setup();
