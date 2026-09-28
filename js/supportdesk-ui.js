/* IEPM operations UI */
function initials(n){return String(n||'?').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}
function todayStr(){try{return new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' - Local time'}catch(e){return''}}
function last7(){const a=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);a.push(d)}return a}
function donutSVG(met,risk,bre){const tot=Math.max(1,met+risk+bre);const C=2*Math.PI*54;let off=0;function seg(v,col){const len=v/tot*C;const s='<circle cx="70" cy="70" r="54" fill="none" stroke="'+col+'" stroke-width="16" stroke-dasharray="'+len.toFixed(1)+' '+(C-len).toFixed(1)+'" stroke-dashoffset="'+(-off).toFixed(1)+'" transform="rotate(-90 70 70)" stroke-linecap="round"/>';off+=len;return s}return '<svg width="140" height="140" viewBox="0 0 140 140">'+seg(met,'#14532D')+seg(risk,'#E8930C')+seg(bre,'#E5484D')+'</svg>'}
function areaSVG(vals){const W=560,H=170,P=12;const mx=Math.max(8,...vals);const pts=vals.map((v,i)=>[P+i*(W-2*P)/(vals.length-1),H-20-(v/mx)*(H-56)]);const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(0)+' '+p[1].toFixed(0)).join(' ');return '<svg class="chart" viewBox="0 0 '+W+' '+H+'"><defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14532D" stop-opacity=".28"/><stop offset="1" stop-color="#14532D" stop-opacity=".03"/></linearGradient></defs><path d="'+line+' L'+(W-P)+' '+(H-20)+' L'+P+' '+(H-20)+' Z" fill="url(#gA)"/><path d="'+line+'" fill="none" stroke="#14532D" stroke-width="2.5" stroke-linecap="round"/></svg>'}
/* IEPM internal operations layout — base nav (auth-fix.js adds buildNav wrapper with guards) */
function navIcon(name){
const S='width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const P={
dashboard:'<svg '+S+'><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>',
tickets:'<svg '+S+'><path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"/><path d="M13 4v3M13 11v2M13 17v3"/></svg>',
mytickets:'<svg '+S+'><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>',
unassigned:'<svg '+S+'><path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"/><path d="M13 4v3M13 11v2M13 17v3"/></svg>',
new:'<svg '+S+'><path d="M12 5v14M5 12h14"/></svg>',
kb:'<svg '+S+'><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></svg>',
assets:'<svg '+S+'><rect x="4" y="4" width="16" height="11" rx="2"/><path d="M9 19h6M12 15v4"/></svg>',
ai:'<svg '+S+'><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2 2M16.7 16.7l2 2M18.7 5.3l-2 2M7.3 16.7l-2 2"/></svg>',
reports:'<svg '+S+'><path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/></svg>',
users:'<svg '+S+'><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.9.3 5 2.3 5 5"/></svg>',
techs:'<svg '+S+'><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/></svg>',
depts:'<svg '+S+'><path d="M4 21V5l8-2v18"/><path d="M12 21V9l8 2v10"/><path d="M2 21h20"/></svg>',
cats:'<svg '+S+'><path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="9" cy="9" r="1.6"/></svg>',
sla:'<svg '+S+'><circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2.5 2M9 2.5h6"/></svg>',
audit:'<svg '+S+'><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h3M9 17h5"/></svg>',
settings:'<svg '+S+'><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.15-1.4l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.4-1.4L13.7 2h-3.4l-.45 2.6a7 7 0 0 0-2.4 1.4l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.8l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.4 1.4l.45 2.6h3.4l.45-2.6a7 7 0 0 0 2.4-1.4l2.3 1 2-3.4-2-1.5c.1-.45.15-.92.15-1.4Z"/></svg>',
logout:'<svg '+S+'><path d="M14 4H6v16h8"/><path d="M10 12h11M18 8l3 4-3 4"/></svg>'};
return P[name]||P.dashboard;}
function buildNavBase(){const u=me();if(!u)return;
const open=DB.tickets.filter(t=>!['Resolved','Closed'].includes(t.status)).length;
const mine=DB.tickets.filter(t=>t.requester===u.id||t.assignee===u.id).length;
const un=DB.tickets.filter(t=>!t.assignee&&!['Resolved','Closed'].includes(t.status)).length;
function item(pg,label,c,sec){const isNew=(pg==='new');return '<a href="#" data-pg="'+pg+'" class="'+(ROUTE.page===pg?'active':'')+(isNew?' nav-new':'')+'">'+navIcon(pg)+'<span>'+label+'</span>'+(c===''||c==null?'':'<span class="count">'+c+'</span>')+'</a>'}
let h=item('dashboard','Dashboard','');
const staffView=(u.role!=='employee');
h+='<div class="nav-section">TICKETS</div>'+item('tickets','All Tickets',DB.tickets.length)+item('mytickets','My Tickets',mine)+(staffView?item('unassigned','Unassigned',un):'')+item('new','New Ticket','');
h+='<div class="nav-section">SUPPORT</div>'+item('kb','Knowledge Base',DB.kb.length)+item('assets','Asset Registry',DB.assets.length)+item('ai','AI Assistant','');
h+='<div class="nav-section">MANAGE</div>';
if(['admin','qms'].includes(u.role)){h+=item('reports','Reports','')+item('users','Users','')+item('techs','Technicians','')+item('depts','Departments','')+item('cats','Categories','')+item('sla','SLA','')+item('audit','Audit Logs','')+item('settings','Settings','')}
else if(u.role==='engineer'){h+=item('reports','Reports','')}
else{h+=item('settings','Settings','')}
document.getElementById('mainNav').innerHTML=h;
document.querySelectorAll('#mainNav a').forEach(a=>a.onclick=e=>{e.preventDefault();go(a.dataset.pg);document.getElementById('sidebar').classList.remove('open')});
document.querySelectorAll('#bottomNav .bn-item').forEach(b=>{b.classList.toggle('on',b.dataset.pg===ROUTE.page);b.onclick=()=>go(b.dataset.pg)});
const tt=document.querySelector('.topbar-title');if(tt){const t={dashboard:['Dashboard','Operations overview'],tickets:['Tickets','All service requests'],mytickets:['My Tickets','Assigned to / raised by you'],unassigned:['Unassigned','Needs an owner'],new:['New Ticket','Raise a service request'],kb:['Knowledge Base','Reference material'],assets:['Assets','Equipment registry'],ai:['AI Assistant','Classify + suggest'],reports:['Reports','Performance insights'],users:['Users','People + access'],techs:['Technicians','Team workload'],depts:['Departments','Org units'],cats:['Categories','Routing rules'],sla:['SLA','Targets + breaches'],audit:['Audit Logs','Every event'],settings:['Settings','Profile + system'],detail:['Ticket Detail','Full thread']}[ROUTE.page]||['Dashboard','Operations overview'];tt.innerHTML='<b>'+t[0]+'</b><span>'+t[1]+'</span>'}
};
/* Dashboard: KPIs + volume + SLA donut + customers + techs (single canonical definition; replaces base vDashboard in app.js) */
function vDashboard(c){const u=me();const T=DB.tickets;
const open=T.filter(t=>!['Resolved','Closed'].includes(t.status));
const resToday=T.filter(t=>['Resolved','Closed'].includes(t.status)&&new Date(t.updated).toDateString()===new Date().toDateString());
const over=T.filter(t=>!['Resolved','Closed'].includes(t.status)&&slaRemain(t)<0);
function resMins(t){return (new Date(t.updated)-new Date(t.created))/60000}
function isBreached(t){const lim=(SLA_H[t.priority]||SLA_H.Medium).res;return resMins(t)>lim}
const done=T.filter(t=>['Resolved','Closed'].includes(t.status));
const met=done.filter(t=>!isBreached(t)).length;
const comp=done.length?Math.round(met/done.length*1000)/10:0;
const atRisk=open.filter(t=>slaRemain(t)>=0&&slaRemain(t)<60).length;
const days=last7();const dnames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
let custMap={};T.forEach(t=>{const n=uname(t.requester);custMap[n]=custMap[n]||{n:n,c:0,closed:0};custMap[n].c++;if(['Resolved','Closed'].includes(t.status))custMap[n].closed++});
let custs=Object.values(custMap).sort((a,b)=>b.c-a.c).slice(0,5);
const techs=DB.users.filter(x=>x.role==='engineer').slice(0,5);
const pillFor=(o)=>o?['Busy','a']:['Available','g'];

const vols=days.map(d=>T.filter(t=>new Date(t.created).toDateString()===d.toDateString()).length);
c.innerHTML='<div class="page-head"><div><h2>Dashboard</h2><div class="page-sub">'+todayStr()+'</div></div><div class="spacer"></div><div class="page-actions"><button class="btn btn-ghost btn-sm hide-m" onclick="go(\'dashboard\')">⟳ Refresh</button><button class="btn btn-outline btn-sm hide-m" onclick="exportCSV()">⭳ Export</button><button class="btn btn-primary btn-sm" onclick="go(\'new\')">＋ New Ticket</button></div></div>'
+'<div class="kpis">'
+'<div class="kpi"><div class="kpi-top"><div class="kpi-lbl">Open Tickets</div><div class="kpi-ico t">🎫</div></div><div class="kpi-val">'+open.length+'</div><div class="kpi-sub up">▲ live queue</div></div>'
+'<div class="kpi"><div class="kpi-top"><div class="kpi-lbl">Resolved Today</div><div class="kpi-ico g">✓</div></div><div class="kpi-val">'+resToday.length+'</div><div class="kpi-sub up">▲ closed today</div></div>'
+'<div class="kpi"><div class="kpi-top"><div class="kpi-lbl">SLA Compliance</div><div class="kpi-ico g">◷</div></div><div class="kpi-val">'+comp+'%</div><div class="kpi-sub up">▲ on target</div></div>'
+'<div class="kpi"><div class="kpi-top"><div class="kpi-lbl">Overdue</div><div class="kpi-ico r">⚠</div></div><div class="kpi-val">'+over.length+'</div><div class="kpi-sub dn">▼ needs action</div></div>'
+'</div>'
+'<div class="grid-main"><div class="card"><div style="display:flex;align-items:center"><div><h3>Ticket Volume — Last 7 Days</h3><div class="csub">Open, closed, and escalated</div></div><div class="spacer" style="flex:1"></div><button class="link" onclick="go(\'reports\')">▤ Detail</button></div>'+areaSVG(vols)+'<div style="display:flex;justify-content:space-between;font-size:11px;color:#6D7E8C;margin-top:2px">'+days.map(d=>'<span>'+dnames[d.getDay()]+'</span>').join('')+'</div><div style="display:flex;gap:14px;font-size:11px;color:#6D7E8C;margin-top:2px"><span>20</span><span>40</span><span>60</span><span>80</span></div></div>'
+'<div class="card"><h3>SLA Performance</h3><div class="csub">Current period</div><div class="donut-flex"><div>'+donutSVG(met,atRisk,over.length)+'</div><div class="legend"><div><i style="background:#14532D"></i>Met<b>'+(done.length?Math.round(met/done.length*100):0)+'%</b></div><div><i style="background:#E8930C"></i>At Risk<b>'+(open.length?Math.round(atRisk/Math.max(1,open.length)*100):0)+'%</b></div><div><i style="background:#E5484D"></i>Breached<b>'+(open.length?Math.round(over.length/Math.max(1,open.length)*100):0)+'%</b></div></div></div></div></div>'
+'<div class="grid-main" style="margin-top:14px"><div class="card"><h3>Top Customers</h3><div class="csub">By open ticket volume</div>'+(custs.map((x,i)=>{const pct=x.c?Math.min(100,Math.round(x.closed/x.c*100)):0;const col=i===1?'#E8930C':i===4?'#E5484D':'#14532D';return '<div class="trow"><div class="cust-ic">◈</div><div style="flex:1"><b>'+esc(x.n)+'</b><br><span style="font-size:11px;color:#6D7E8C">'+esc(x.sub||'Account')+'</span></div><span style="font-size:11.5px;color:#6D7E8C">'+x.c+' tickets</span><div class="pbar" style="width:90px"><i style="width:'+pct+'%;background:'+col+'"></i></div><b style="font-size:12px;width:36px;text-align:right">'+pct+'%</b></div>'}).join('')||'<div class="trow"><div style="font-size:13px;color:#6D7E8C">No customer tickets yet. New requests will appear here.</div></div>')+'</div>'
+'<div class="card"><div style="display:flex;align-items:center"><h3>Technician Status</h3><div style="flex:1"></div><button class="link" onclick="go(\'techs\')">View all</button></div><div class="csub">Live availability</div>'+(techs.length?techs.map((t)=>{const o=DB.tickets.filter(z=>z.assignee===t.id&&!['Resolved','Closed'].includes(z.status));const p=pillFor(o.length);const lbl=o.length?((o[0].id||'')+' · '+(o[0].subject||'').slice(0,22)):t.dept;return '<div class="trow"><div class="tav">'+initials(t.name)+'</div><div><b>'+esc(t.name)+'</b><br><span style="font-size:11px;color:#6D7E8C">'+esc(lbl)+'</span></div><span class="pill '+p[1]+'">'+p[0]+'</span></div>'}).join(''):'<div class="trow"><div style="font-size:13px;color:#6D7E8C">No technicians yet. Add an engineer under Users to show live status.</div></div>')+'</div></div>'
+'<div class="m-only"><h3 style="margin:16px 2px 2px;font-size:14px">Quick Actions</h3><div class="qgrid"><div class="quick" onclick="go(\'new\')"><i style="background:#E8F1FE">＋</i>New Support<br>Ticket</div><div class="quick" onclick="go(\'new\')"><i style="background:#FFF3D6">🔧</i>Maintenance<br>Request</div><div class="quick" onclick="go(\'kb\')"><i style="background:#E7F7EE">📖</i>Knowledge<br>Base</div></div><div class="card"><div style="display:flex;align-items:center"><h3>Recent Tickets</h3><div style="flex:1"></div><button class="link" onclick="go(\'tickets\')">See All</button></div><div class="csub">Tap to open</div>'+([...T].sort((a,b)=>new Date(b.updated)-new Date(a.updated)).slice(0,4).map(t=>'<div class="mt-card" onclick="go(\'detail\',\''+t.id+'\')"><div style="display:flex;gap:8px;align-items:center"><b style="font-size:13px">'+esc(t.subject)+'</b><span style="flex:1"></span>'+stBadge(t.status)+'</div><div style="font-size:11.5px;color:#6D7E8C;margin-top:6px">◷ '+t.id+' &nbsp;·&nbsp; '+timeAgo(t.updated)+'</div></div>').join(''))+'</div></div>';
};

function exportCSV(){const rows=[['ID','Subject','Priority','Status','Requester','Updated']].concat(DB.tickets.map(t=>[t.id,'"'+String(t.subject).replace(/"/g,'""')+'"',t.priority,t.status,uname(t.requester),t.updated]));const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='tickets.csv';a.click();toast('Exported '+DB.tickets.length+' tickets')}
/* Branding pass applied after canonical renderAuth in app.js */
function applyAuthBranding(){const h=document.querySelector('.auth-left h1');if(h)h.innerHTML='IEPM<br>Ticket<br><em style="color:#4ADE80">System</em>';const p=document.querySelector('.auth-left p');if(p)p.textContent='A focused operations workspace for managing service requests, equipment, and team response.';const bl=document.querySelector('.auth-left .brand-mark');if(bl){bl.textContent='I';bl.style.background='#14532D';bl.style.color='#FFFFFF'}};
/* Topbar wiring augments canonical wireTop in app.js */
function wireTopExtras(){const rf=document.getElementById('refreshBtn');if(rf)rf.onclick=function(){go(ROUTE.page,ROUTE.arg);toast('Refreshed')};const ex=document.getElementById('exportBtn');if(ex)ex.onclick=exportCSV;document.querySelectorAll('#bottomNav .bn-item').forEach(function(b){b.onclick=function(){go(b.dataset.pg)}})};

