/* AuthN + AuthZ hardening - loaded after app.js + supportdesk-ui.js */
const AUTH={MAX_ATTEMPTS:5,LOCK_MS:5*60*1000,SESSION_MS:12*3600*1000,ADMIN_PAGES:['users','techs','depts','cats','sla','audit'],STAFF:['admin','engineer','qms'],ADMIN_ROLES:['admin','qms']};
async function hashPw(s){try{if(window.crypto&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('sd$'+s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch(e){}
let h1=0x811c9dc5;const str='sd$'+s;for(let i=0;i<str.length;i++){h1^=str.charCodeAt(i);h1=Math.imul(h1,0x01000193)>>>0}return'fb-'+h1.toString(16)}
function isHashed(s){return /^[a-f0-9]{64}$/i.test(s||'')||/^fb-[0-9a-f]+$/.test(s||'')}
function isStaff(){const u=me();return !!(u&&AUTH.STAFF.includes(u.role))}
function isAdmin(){const u=me();return !!(u&&AUTH.ADMIN_ROLES.includes(u.role))}
function deny(m){toast(m||'Access denied');return false}
function lockKey(e){return 'sd_lock_'+e}
function isLocked(e){try{const o=JSON.parse(localStorage.getItem(lockKey(e))||'{}');return !!(o.until&&Date.now()<o.until)}catch(x){return false}}
function recordFail(e){try{const k=lockKey(e);const o=JSON.parse(localStorage.getItem(k)||'{"n":0}');o.n=(o.n||0)+1;if(o.n>=AUTH.MAX_ATTEMPTS){o.until=Date.now()+AUTH.LOCK_MS;o.n=0}localStorage.setItem(k,JSON.stringify(o))}catch(x){}}
function clearFails(e){try{localStorage.removeItem(lockKey(e))}catch(x){}}
/* Login: hashed verify + brute-force lockout + legacy plaintext upgrade (single canonical definition) */
async function doLogin(){const e=($('#lEmail').value||'').trim().toLowerCase(),p=$('#lPass').value;
if(!e||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){showAuthSummary('Invalid email or password','error');setFieldError($('#lEmail'),'Enter a valid email address');return toast('Invalid email or password');}
if(!p){showAuthSummary('Invalid email or password','error');setFieldError($('#lPass'),'Password is required');return toast('Invalid email or password');}
if(isLocked(e))return toast('Too many failed attempts. Try again in 5 minutes.');
const u=DB.users.find(x=>x.email.toLowerCase()===e);
const ok=u&&(isHashed(u.pass)?(await hashPw(p))===u.pass:u.pass===p);
if(!u||!ok){recordFail(e);showAuthSummary('Invalid email or password','error');setFieldError($('#lPass'),'Invalid email or password');audit('Failed login for '+e);save();return toast('Invalid email or password')}
if(!isHashed(u.pass)){u.pass=await hashPw(p)}
clearFails(e);showAuthSummary('', 'success');DB.session=u.id;DB.sessionAt=Date.now();if($('#lRemember')&&$('#lRemember').checked){localStorage.setItem('sd_remember','true');}else{localStorage.removeItem('sd_remember');}audit(u.name+' signed in');save();boot();toast('Welcome, '+u.name)};
async function doRegister(){const n=$('#rName').value.trim(),e=$('#rEmail').value.trim(),p=$('#rPass').value,cp=$('#rPassConfirm').value,d=$('#rDept').value,r=normalizeRole($('#rRole')?$('#rRole').value:'employee');let hasError=false;if(n.length<2){setFieldError($('#rName'),'Please enter your full name');hasError=true;}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){setFieldError($('#rEmail'),'Enter a valid email address');hasError=true;}const strong=/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(p);if(!strong){setFieldError($('#rPass'),'Use 8+ characters, 1 uppercase, 1 number, and 1 symbol');hasError=true;}if(!cp){setFieldError($('#rPassConfirm'),'Please confirm your password');hasError=true;}else if(p!==cp){setFieldError($('#rPassConfirm'),'Passwords do not match');hasError=true;}const tosError=document.getElementById('rTosError');if(!$('#rTos')||!$('#rTos').checked||!$('#rPrivacy')||!$('#rPrivacy').checked){if(tosError)tosError.textContent='You must accept the Terms of Service and Privacy Policy.';hasError=true;}else if(tosError){tosError.textContent='';}if(DB.users.some(x=>x.email.toLowerCase()===e.toLowerCase())){toast('Email already registered');return;}if(hasError){showAuthSummary('Please complete the required fields correctly.','error');return toast('Please complete the required fields correctly.');}
const u={id:uid('u'),name:n,email:e,pass:await hashPw(p),role:r,dept:d,phone:'',location:'Head Office'};
DB.users.push(u);showAuthSummary('', 'success');DB.session=u.id;DB.sessionAt=Date.now();notify(u.id,'Welcome, '+n.split(' ')[0]+'!');audit('New user registered: '+n+' ('+roleLabel(r)+')');save();boot();toast('Account created. Welcome!')};
/* Route guard wrapper: single go override chain (captures canonical go from app.js) */
const _goBase=go;
go=function(pg,arg){const u=me();
if(!u){boot();return}
if(DB.sessionAt&&Date.now()-DB.sessionAt>AUTH.SESSION_MS){DB.session=null;save();boot();toast('Session expired. Please sign in.');return}
if(AUTH.ADMIN_PAGES.includes(pg)&&!isAdmin()){deny('Admins only');_goBase('dashboard');return}
if((pg==='reports'||pg==='unassigned')&&!isStaff()){deny('Staff only');_goBase('dashboard');return}
return _goBase(pg,arg)};
/* Canonical secured admin mutations (single definitions; insecure base duplicates in app.js removed) */
async function userSave(){if(!isAdmin())return deny('Admins only');
const n=$('#uuN').value.trim(),e=$('#uuE').value.trim();
if(!n||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))return toast('Check fields');
if(DB.users.some(x=>x.email.toLowerCase()===e.toLowerCase()))return toast('Email already registered');
const role=normalizeRole($('#uuR').value);
if(role==='admin'&&me().role!=='admin')return deny('Only admins can create admins');
DB.users.push({id:uid('u'),name:n,email:e,pass:await hashPw($('#uuP').value||'user123456'),role:role,dept:'IT',phone:'',location:'Head Office'});
audit(me().name+' created user '+n+' ('+roleLabel(role)+')');save();closeModal();go('users')};
function delUser(id){if(!isAdmin())return deny('Admins only');
const t=DB.users.find(x=>x.id===id);if(!t)return;
if(id===me().id)return toast('You cannot delete yourself');
if(t.role==='admin'&&me().role!=='admin')return deny('Admins only');
if(!confirm('Delete user '+t.name+'?'))return;
DB.users=DB.users.filter(u=>u.id!==id);audit(me().name+' deleted user '+t.name);save();go('users')};
function kbSave(){if(!isStaff())return deny('Staff only');
const t=$('#kbT').value.trim();if(!t)return toast('Enter title');
DB.kb.unshift({id:uid('kb'),cat:$('#kbC').value,title:t,body:$('#kbB').value,views:0});audit(me().name+' added KB: '+t);save();closeModal();go('kb');toast('Article published')};
function assetSave(){if(!isAdmin())return deny('Admins only');
const i=$('#asI').value.trim().toUpperCase();if(!i)return toast('Enter asset ID');
if(DB.assets.some(a=>a.id===i))return toast('Asset ID already exists');
DB.assets.unshift({id:i,device:$('#asD').value||'Device',user:$('#asU').value,dept:$('#asDept').value,serial:'SN-'+Math.random().toString(36).slice(2,7).toUpperCase(),location:'Head Office',status:'Active',warranty:'2027-01-01'});
audit(me().name+' added asset '+i);save();closeModal();go('assets')};
function deptAdd(){if(!isAdmin())return deny('Admins only');
const v=$('#dN').value.trim();if(!v)return;
DB.departments.push({id:uid('d'),name:v});audit(me().name+' added dept '+v);save();go('depts')};
function deptDel(id){if(!isAdmin())return deny('Admins only');
DB.departments=DB.departments.filter(d=>d.id!==id);audit(me().name+' deleted dept '+id);save();go('depts')};
function sendReply(id,internal){const u=me();const t=DB.tickets.find(x=>x.id===id);if(!t)return deny('Ticket not found');
if(!(isStaff()||t.requester===u.id||t.assignee===u.id))return deny('Not your ticket');
if(internal&&!isStaff())return deny('Staff only');
const v=$('#rText').value.trim();if(!v)return toast('Type a reply');
t.messages.push({by:u.id,kind:internal?'internal':'user',text:v,at:new Date().toISOString()});t.updated=new Date().toISOString();
t.history.push({t:new Date().toISOString(),e:(internal?'Internal note by ':'Reply by ')+u.name});
const other=internal?null:(u.id===t.requester?t.assignee:t.requester);
if(other)notify(other,(internal?'Note':'Reply')+' on '+id+' from '+u.name);
audit(u.name+(internal?' added note on ':' replied on ')+id);save();go('detail',id);toast(internal?'Note saved':'Reply sent')};
function saveDetail(id){if(!isStaff())return deny('Staff only');
const t=DB.tickets.find(x=>x.id===id);if(!t)return deny('Ticket not found');
const ns=$('#dStatus').value;
if((ns==='Resolved'||ns==='Closed')&&!$('#dRes').value.trim())return toast('Add resolution notes first');
const old=t.status;t.status=ns;t.priority=$('#dPri').value;const na=$('#dAssign').value;
if(na&&na!==t.assignee){t.assignee=na;notify(na,'Ticket '+id+' assigned to you');t.history.push({t:new Date().toISOString(),e:'Assigned to '+uname(na)})}
if($('#dRes').value)t.resolution=$('#dRes').value;
if(old!==ns){t.history.push({t:new Date().toISOString(),e:'Status: '+old+' -> '+ns});notify(t.requester,'Your ticket '+id+' is now '+ns)}
t.updated=new Date().toISOString();audit(me().name+' updated '+id+' to '+ns);save();go('detail',id);toast('Saved: '+ns)};
function rateTicket(id,n){const t=DB.tickets.find(x=>x.id===id);if(!t)return;
if(t.requester!==me().id)return deny('Only the requester can rate');
if(t.status!=='Resolved')return deny('Ticket is not resolved');
if(n<1||n>5)return deny('Invalid rating');
t.rating=n;audit(me().name+' rated '+id+' '+n+'/5');save();go('detail',id);toast('Thanks for rating '+n+'/5')};
function reopenTicket(id){const u=me();const t=DB.tickets.find(x=>x.id===id);if(!t)return;
if(!(t.requester===u.id||isStaff()))return deny('Not allowed');
t.status='Open';t.history.push({t:new Date().toISOString(),e:'Reopened by '+u.name});t.updated=new Date().toISOString();
audit(u.name+' reopened '+id);save();go('detail',id);toast('Reopened')};
/* Canonical role-aware ticket list (single definition; base duplicate in app.js removed) */
function vTickets(c,view){const u=me();let T=[...DB.tickets];
if(!isStaff())T=T.filter(t=>t.requester===u.id);
else if(view==='mine')T=T.filter(t=>t.requester===u.id||t.assignee===u.id);
if(view==='unassigned'){if(!isStaff()){c.innerHTML=head('Access denied','Staff only');return deny('Staff only')}T=T.filter(t=>!t.assignee&&!['Resolved','Closed'].includes(t.status))}
const title=view==='mine'?'My Tickets':view==='unassigned'?'Unassigned':'All Tickets';
c.innerHTML=head(title,T.length+' tickets - click a row to open')+'<div class="filters"><input id="fQ" placeholder="Search..." style="flex:1;min-width:200px"><select id="fS"><option value="">All statuses</option><option>New</option><option>Open</option><option>Assigned</option><option>In Progress</option><option>Pending</option><option>Waiting for User</option><option>Escalated</option><option>Resolved</option><option>Closed</option></select><select id="fP"><option value="">All priorities</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select><button class="btn btn-primary btn-sm" onclick="go(\'new\')">+ New</button></div><div class="table-wrap"><table class="table"><tr><th>ID</th><th>Subject</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Updated</th><th>SLA</th></tr><tbody id="tBody"></tbody></table></div>';
function drawVT(){const q=($('#fQ').value||'').toLowerCase(),s=$('#fS').value,p=$('#fP').value;
const rows=T.filter(t=>(!q||(t.subject+t.id+uname(t.requester)).toLowerCase().includes(q))&&(!s||t.status===s)&&(!p||t.priority===p)).sort((a,b)=>new Date(b.updated)-new Date(a.updated));
$('#tBody').innerHTML=rows.map(t=>'<tr class="ticket-row" onclick="go(\'detail\',\''+t.id+'\')"><td><b>'+t.id+'</b></td><td>'+esc(t.subject)+'<br><span style="color:var(--muted);font-size:12px">'+esc(uname(t.requester))+'</span></td><td>'+prBadge(t.priority)+'</td><td>'+stBadge(t.status)+'</td><td>'+esc(t.assignee?uname(t.assignee):'-')+'</td><td style="font-size:12px">'+timeAgo(t.updated)+'</td><td>'+slaBadge(t)+'</td></tr>').join('')||'<tr><td colspan="7" style="text-align:center">No tickets</td></tr>'}
['fQ','fS','fP'].forEach(id=>$('#'+id).oninput=drawVT);drawVT()};
/* Access-checked detail wrapper calls base vDetail in app.js */
function vDetailChecked(c,id){const u=me();const t=DB.tickets.find(x=>x.id===id);
if(!t){c.innerHTML=head('Not found','');return}
if(!(isStaff()||t.requester===u.id||t.assignee===u.id)){c.innerHTML=head('Access denied','This ticket is not assigned to you.');return deny('Not your ticket')}
return vDetail(c,id)};
function guard(fn,rule){const cur=eval(fn);eval(fn+'=function(c){const r=rule();if(r!==true){c.innerHTML=head("Access denied",r||"Not allowed");return deny(r)}return cur(c)}')}
guard('vReports',function(){return isStaff()?true:'Staff only'});
guard('vUsers',function(){return isAdmin()?true:'Admins only'});
guard('vTechs',function(){return isAdmin()?true:'Admins only'});
guard('vDepts',function(){return isAdmin()?true:'Admins only'});
guard('vCats',function(){return isAdmin()?true:'Admins only'});
guard('vSLA',function(){return isAdmin()?true:'Admins only'});
guard('vAudit',function(){return isAdmin()?true:'Admins only'});
/* Role-based nav guards (single definitions; canonical buildNavBase lives in supportdesk-ui.js) */
function applyNavGuards(){const u=me();if(!u)return;
if(u.role==='engineer'){document.querySelectorAll('#mainNav a').forEach(a=>{if(['users','techs','depts','cats','sla','audit','settings'].includes(a.dataset.pg))a.style.display='none'})}
if(u.role==='employee'){document.querySelectorAll('#mainNav a').forEach(a=>{if(['reports','users','techs','depts','cats','sla','audit','unassigned'].includes(a.dataset.pg))a.style.display='none'})}
document.querySelectorAll('#bottomNav .bn-item').forEach(b=>{if(u.role==='employee'&&b.dataset.pg==='unassigned')b.style.display='none'})}
function buildNav(){const u=me();if(!u)return;buildNavBase();applyNavGuards();}
/* Session-aware boot (single definition; replaces base boot in app.js) */
function boot(){const u=me();
if(u&&DB.sessionAt&&Date.now()-DB.sessionAt>AUTH.SESSION_MS){DB.session=null;DB.sessionAt=null;save()}
if(!me()){$('#app').classList.add('hidden');$('#auth-screen').style.display='flex';renderAuth('login');return}
$('#auth-screen').style.display='none';$('#app').classList.remove('hidden');buildNav();updateChrome();
if(AUTH.ADMIN_PAGES.includes(ROUTE.page)&&!isAdmin())ROUTE.page='dashboard';
go(ROUTE.page,ROUTE.arg)};
/* Audited logout (single definition; replaces base logout in app.js) */
function logout(){const u=me();if(u)audit(u.name+' signed out');DB.session=null;DB.sessionAt=null;save();location.reload()};
(async function(){let dirty=false;for(const x of DB.users){const nr=normalizeRole(x.role);if(nr!==x.role){x.role=nr;dirty=true}if(x.pass&&!isHashed(x.pass)){x.pass=await hashPw(x.pass);dirty=true}}if(dirty)save()})();
