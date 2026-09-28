/* IEPM Ticket System */
const DB_KEY='iepm_ticket_system_v1';
const LEGACY_DB_KEY='aiatech_hd_v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>(p||'id')+'-'+Math.random().toString(36).slice(2,8);
function fmtDT(iso){try{return new Date(iso).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return iso}}
function timeAgo(iso){const s=(Date.now()-new Date(iso))/1000;if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}
function toast(m){const r=$('#toastRoot');const d=document.createElement('div');d.className='toast';d.textContent=m;r.appendChild(d);setTimeout(()=>d.remove(),3200)}
function openModal(h,w){$('#modalRoot').innerHTML='<div class="modal-back" onclick="if(event.target===this)closeModal()"><div class="modal'+(w?' wide':'')+'">'+h+'</div></div>'}
function closeModal(){$('#modalRoot').innerHTML=''}
function hrsAgo(h){return new Date(Date.now()-h*3600*1000).toISOString()}
const SLA_H={Critical:{resp:15,res:120},High:{resp:30,res:240},Medium:{resp:120,res:480},Low:{resp:240,res:1440}};
const CATS=['Network','Hardware','Software','Email','Microsoft 365','Security','Printer','Mobile / Device','Account / Password','Other'];
const ROLES=[{value:'employee',label:'Employee'},{value:'admin',label:'Admin'},{value:'engineer',label:'Engineer'},{value:'qms',label:'QMS'}];
function roleLabel(r){const f=ROLES.find(x=>x.value===String(r||'').toLowerCase());return f?f.label:(r||'')}
function normalizeRole(r){r=String(r||'').toLowerCase();if(r==='agent')return'engineer';if(r==='manager'||r==='qms-admin')return'qms';if(r==='administrator')return'admin';return ROLES.some(x=>x.value===r)?r:'employee'}

function createInitialState(){
  const now=new Date().toISOString();
  return {
    seq:1001,
    users:[{id:'u-admin',name:'System Administrator',email:'admin@iepm.local',pass:'ChangeMe123!',role:'admin',dept:'IT',phone:'',location:'Primary site'}],
    departments:[{id:'d1',name:'IT'},{id:'d2',name:'Operations'},{id:'d3',name:'Finance'},{id:'d4',name:'HR'},{id:'d5',name:'Sales'}],
    categories:CATS.map(c=>({name:c,team:c==='Network'?'Network Team':c==='Security'?'Security Team':(c==='Hardware'||c==='Printer')?'Hardware Support':'Service Desk'})),
    tickets:[],
    assets:[],
    kb:[],
    notifs:[],
    audit:[{t:now,by:'system',act:'System initialized with empty data'}],
    session:null
  };
}
let DB;try{
  const stored=localStorage.getItem(DB_KEY);
  const legacy=localStorage.getItem(LEGACY_DB_KEY);
  if(legacy && !stored){localStorage.removeItem(LEGACY_DB_KEY)}
  DB = stored ? JSON.parse(stored) : createInitialState();
  if(!DB || !Array.isArray(DB.users)) DB = createInitialState();
  // One-time purge of old hardcoded demo records (if stored from previous builds)
  try{
    const DEMO_NAMES=['precision parts ltd','autotech gmbh','medequip solutions','global mfg co.','global mfg co','logistics corp','alex mercer','sara khalid','omar farouk'];
    const DEMO_SUBJ=['hvac repair','elevator inspect','generator service'];
    let _purged=false;
    if(Array.isArray(DB.tickets)){
      const before=DB.tickets.length;
      DB.tickets=DB.tickets.filter(t=>{
        const rq=String((DB.users.find(u=>u.id===t.requester)||{}).name||'').toLowerCase();
        const as=String((DB.users.find(u=>u.id===t.assignee)||{}).name||'').toLowerCase();
        const sj=String(t.subject||'').toLowerCase();
        if(DEMO_NAMES.includes(rq)||DEMO_NAMES.includes(as))return false;
        if(DEMO_SUBJ.some(s=>sj.includes(s))&&/tk-28(31|36|39|41)/.test(sj+' '+(t.id||'').toLowerCase()))return false;
        return true;
      });
      if(DB.tickets.length!==before)_purged=true;
    }
    if(Array.isArray(DB.users)){
      const before=DB.users.length;
      DB.users=DB.users.filter(u=>!DEMO_NAMES.includes(String(u.name||'').toLowerCase())||u.id==='u-admin');
      // never delete the real bootstrap admin; drop exact demo technician impostors only
      if(DB.users.length!==before)_purged=true;
    }
    if(_purged)save();
  }catch(_e){}
  let _roleDirty=false;DB.users.forEach(u=>{const n=normalizeRole(u.role);if(n!==u.role){u.role=n;_roleDirty=true}});if(_roleDirty)save();
}catch(e){DB=createInitialState()}

async function hydrateFromSupabase() {
  if (!window.IEPM_SUPABASE || !window.IEPM_SUPABASE.ready) return;
  const remote = await loadRemoteDbState();
  if (remote && Array.isArray(remote.users)) {
    DB = remote;
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
  }
}

function refreshVisibleData(){
  if (!document.getElementById('app') || document.getElementById('app').classList.contains('hidden')) return;
  if (!me()) return;
  const pages=['dashboard','tickets','mytickets','unassigned','detail','reports'];
  if (pages.includes(ROUTE.page)) {
    try { go(ROUTE.page, ROUTE.arg); } catch (e) { /* avoid stale-render loops */ }
  }
}
function save(){
  try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) { /* storage may be unavailable */ }
  try {
    window.dispatchEvent(new CustomEvent('iepm-db-updated'));
  } catch (e) {}
  if (window.IEPM_SUPABASE && window.IEPM_SUPABASE.ready) {
    syncDbToSupabase();
  }
}
let ROUTE={page:'dashboard',arg:''};
function me(){return DB.users.find(u=>u.id===DB.session)||null}
function uname(id){const u=DB.users.find(x=>x.id===id);return u?u.name:'System'}
function slaRemain(t){const mins=(SLA_H[t.priority]||SLA_H.Medium).res-(Date.now()-new Date(t.created))/60000;return Math.round(mins)}
function slaBadge(t){if(['Resolved','Closed'].includes(t.status))return'<span class="badge b-green">SLA met</span>';const r=slaRemain(t);if(r<0)return'<span class="badge b-red">SLA breached</span>';if(r<60)return'<span class="badge b-amber">SLA: '+r+'m left</span>';return'<span class="badge b-blue">SLA: '+Math.floor(r/60)+'h '+(r%60)+'m</span>'}
function stBadge(s){const m={'New':'b-blue','Open':'b-blue','Assigned':'b-purple','In Progress':'b-purple','Pending':'b-amber','Waiting for User':'b-amber','Escalated':'b-red','Resolved':'b-green','Closed':'b-gray'};return'<span class="badge '+(m[s]||'b-gray')+'">'+esc(s)+'</span>'}
function prBadge(p){const m={Critical:'b-red',High:'b-amber',Medium:'b-blue',Low:'b-gray'};return'<span class="badge '+(m[p]||'b-gray')+'">'+esc(p)+'</span>'}
function notify(to,text){DB.notifs.unshift({id:uid('n'),to,text,at:new Date().toISOString(),read:false})}
async function sendTicketNotificationEmail(ticket){
  const payload={
    subject:'New support ticket raised: '+ticket.id+' - '+ticket.subject,
    category:ticket.category,
    priority:ticket.priority,
    dept:ticket.dept,
    location:ticket.location,
    requester:uname(ticket.requester),
    created:ticket.created,
    description:ticket.desc || ticket.subject,
    link:(window.location.protocol==='file:' ? 'http://localhost:3000' : window.location.origin)+'/'
  };

  const fallbackTicketMail = () => {
    const to='aiatechworldltd@outlook.com';
    const body=[
      'A new ticket has been raised in IEPM Ticket System.',
      '',
      'Ticket ID: '+ticket.id,
      'Subject: '+ticket.subject,
      'Category: '+ticket.category,
      'Priority: '+ticket.priority,
      'Department: '+ticket.dept,
      'Location: '+ticket.location,
      'Requester: '+uname(ticket.requester),
      'Raised at: '+new Date(ticket.created).toLocaleString(),
      '',
      'Description:',
      ticket.desc || ticket.subject,
      '',
      'View the ticket in the system: '+payload.link
    ].join('\n');
    const mailto='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(payload.subject)+'&body='+encodeURIComponent(body);
    try { window.location.href = mailto; } catch (e) { window.open(mailto, '_self'); }
  };

  if(window.location.protocol==='file:'){
    fallbackTicketMail();
    return;
  }

  try{
    const response=await fetch('/api/tickets/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>({ok:false,message:'Unexpected response'}));
    if(!response.ok || data.ok === false){
      console.warn('Ticket email failed:', data);
      fallbackTicketMail();
      return;
    }
  }catch(error){
    console.warn('Ticket email failed:',error);
    fallbackTicketMail();
  }
}
function getPasswordStrength(password){if(!password){return {score:0,label:'',state:'weak',width:0};}let score=0;if(password.length>=8)score++;if(/[A-Z]/.test(password))score++;if(/[0-9]/.test(password))score++;if(/[^A-Za-z0-9]/.test(password))score++;if(score<=1){return {score,label:'Weak',state:'weak',width:25};}if(score===2||score===3){return {score,label:'Fair',state:'fair',width:55};}if(score===4){return {score,label:'Good',state:'good',width:80};}return {score:5,label:'Strong',state:'strong',width:100};}
function showAuthSummary(message, type){const el=document.getElementById('authSummary');if(!el)return;el.hidden=!message;el.textContent=message||'';el.dataset.type=type||'error';}
function clearFieldError(input){if(!input)return;const field=input.closest('.field');if(field){const errorEl=field.querySelector('.field-error');if(errorEl)errorEl.textContent='';}input.setAttribute('aria-invalid','false');}
function setFieldError(input, message){if(!input)return;const field=input.closest('.field');if(field){const errorEl=field.querySelector('.field-error');if(errorEl)errorEl.textContent=message||'';}input.setAttribute('aria-invalid', message ? 'true' : 'false');}
function bindAuthPasswordToggles(){document.querySelectorAll('.toggle-password').forEach(btn=>{btn.onclick=()=>{const input=document.getElementById(btn.dataset.target);if(!input)return;const isHidden=input.type==='password';input.type=isHidden?'text':'password';btn.textContent=isHidden?'🙈':'👁';btn.setAttribute('aria-label',isHidden?'Hide password':'Show password');}})}
function bindAuthFieldValidation(){const emailInputs=[document.getElementById('lEmail'),document.getElementById('rEmail')].filter(Boolean);emailInputs.forEach(input=>{input.addEventListener('input',()=>{if(!input.value.trim())return setFieldError(input,'Email is required');const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());setFieldError(input, valid ? '' : 'Enter a valid email address');showAuthSummary('', 'success');});input.addEventListener('blur',()=>{if(!input.value.trim())setFieldError(input,'Email is required');else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()))setFieldError(input,'Enter a valid email address');});});
const rp=document.getElementById('rPass');if(rp){const meter=document.getElementById('rStrengthMeter');const label=document.getElementById('rStrengthLabel');rp.addEventListener('input',()=>{const strength=getPasswordStrength(rp.value);if(meter){meter.setAttribute('data-state',strength.state);const fill=meter.querySelector('span');if(fill)fill.style.width=strength.width+'%';}if(label)label.textContent=strength.label;const confirm=document.getElementById('rPassConfirm');if(confirm&&confirm.value){const match=rp.value===confirm.value;setFieldError(confirm, match ? '' : 'Passwords do not match');}if(!rp.value){if(label)label.textContent='';if(meter){meter.setAttribute('data-state','weak');const fill=meter.querySelector('span');if(fill)fill.style.width='0%';}}showAuthSummary('', 'success');});rp.addEventListener('blur',()=>{const value=rp.value.trim();if(!value){setFieldError(rp,'Password is required');return;}const ok=/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);setFieldError(rp, ok ? '' : 'Use 8+ characters, 1 uppercase, 1 number, and 1 symbol');const strength=getPasswordStrength(value);if(label)label.textContent=strength.label;});}
const rc=document.getElementById('rPassConfirm');if(rc){rc.addEventListener('input',()=>{const pass=document.getElementById('rPass');if(!pass)return;const match=pass.value===rc.value;if(rc.value && !match){setFieldError(rc,'Passwords do not match');}else{setFieldError(rc,'');}showAuthSummary('', 'success');});rc.addEventListener('blur',()=>{const pass=document.getElementById('rPass');if(!pass)return;const match=pass.value===rc.value;if(!rc.value){setFieldError(rc,'Please confirm your password');return;}setFieldError(rc, match ? '' : 'Passwords do not match');});}}
function renderAuth(mode){const a=$('#auth-screen');a.innerHTML='<div class="auth-card"><div class="auth-left"><div><div class="brand-mark">A</div><h1>IEPM Ticket System</h1><p>From daily maintenance tasks to critical outages, keep every support conversation organized, visible, and moving.</p><ul class="feat"><li>Keep ticket flow clear from intake to resolution.</li><li>Track people, assets, and SLA priorities in one place.</li><li>Give your support team a calmer, smarter workflow.</li></ul></div></div><div class="auth-right"><h2 style="margin:0">'+(mode==='reg'?'Create your account':'Welcome back')+'</h2><p style="color:var(--muted);font-size:14px">'+(mode==='reg'?'Set up your workspace access and keep support moving.':'Sign in to your workspace and continue where you left off.')+'</p><div class="tabs"><button id="tLogin" type="button" class="'+(mode!=='reg'?'active':'')+'" aria-selected="'+(mode!=='reg')+'">Login</button><button id="tReg" type="button" class="'+(mode==='reg'?'active':'')+'" aria-selected="'+(mode==='reg')+'">Register</button></div><div id="authForm"></div></div></div>';
$('#tLogin').onclick=()=>renderAuth('login');$('#tReg').onclick=()=>renderAuth('reg');
const f=$('#authForm');
if(mode==='reg'){f.innerHTML='<form novalidate aria-label="Create account form"><div id="authSummary" class="field-error" role="status" aria-live="polite" hidden></div><div class="row2"><div class="field"><label for="rName">Full name</label><input id="rName" name="fullName" type="text" autocomplete="name" placeholder="Jane Doe" aria-describedby="rNameError" required><div class="field-error" id="rNameError"></div></div><div class="field"><label for="rDept">Department</label><select id="rDept" name="department" aria-label="Select department">'+DB.departments.map(d=>'<option>'+esc(d.name)+'</option>').join('')+'</select></div></div><div class="field"><label for="rEmail">Email address</label><input id="rEmail" name="email" type="email" autocomplete="email" placeholder="you@company.com" aria-describedby="rEmailError" required><div class="field-error" id="rEmailError"></div></div><div class="row2"><div class="field"><label for="rPass">Password</label><div class="password-input-wrap"><input id="rPass" name="password" type="password" autocomplete="new-password" placeholder="Create a strong password" aria-describedby="rPassError rStrengthLabel" required><button class="toggle-password" type="button" data-target="rPass" aria-label="Show password">👁</button></div><div class="strength-label" id="rStrengthLabel" aria-live="polite"></div><div class="strength-meter" id="rStrengthMeter" data-state="weak" aria-hidden="true"><span></span></div><div class="field-error" id="rPassError"></div></div><div class="field"><label for="rRole">Role</label><select id="rRole" name="role" aria-label="Select role">'+ROLES.map(r=>'<option value="'+r.value+'">'+r.label+'</option>').join('')+'</select></div></div><div class="field"><label for="rPassConfirm">Confirm password</label><div class="password-input-wrap"><input id="rPassConfirm" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Re-enter your password" aria-describedby="rPassConfirmError" required><button class="toggle-password" type="button" data-target="rPassConfirm" aria-label="Show password">👁</button></div><div class="field-error" id="rPassConfirmError"></div></div><label class="checkbox-row" for="rTos"><input id="rTos" type="checkbox" required><span>I agree to the <a href="#" onclick="event.preventDefault()">Terms of Service</a> and <a href="#" id="rPrivacyLink" onclick="event.preventDefault()">Privacy Policy</a>.</span></label><label class="checkbox-row" for="rPrivacy"><input id="rPrivacy" type="checkbox" required><span>I have read and agree to the Privacy Policy.</span></label><div class="field-error" id="rTosError"></div><label class="checkbox-row" for="rMarketing"><input id="rMarketing" type="checkbox"><span>Opt in to service updates and internal announcements.</span></label><div class="auth-divider"><span>or continue with</span></div><div class="sso-grid"><button class="sso-btn sso-google" type="button" aria-label="Continue with Google" onclick="toast(\'Google sign in is not configured in this environment.\')"><span class="sso-icon">G</span>Google</button><button class="sso-btn sso-github" type="button" aria-label="Continue with GitHub" onclick="toast(\'GitHub sign in is not configured in this environment.\')"><span class="sso-icon">◌</span>GitHub</button><button class="sso-btn sso-apple" type="button" aria-label="Continue with Apple" onclick="toast(\'Apple sign in is not configured in this environment.\')"><span class="sso-icon"></span>Apple</button><button class="sso-btn sso-microsoft" type="button" aria-label="Continue with Microsoft" onclick="toast(\'Microsoft sign in is not configured in this environment.\')"><span class="sso-icon">M</span>Microsoft</button></div><button class="btn btn-primary btn-block" type="submit">Create account</button><p class="auth-switch">Already have an account? <a href="#" onclick="event.preventDefault();renderAuth(\'login\')">Log in</a>.</p></form>';
}else{f.innerHTML='<form novalidate aria-label="Login form"><div id="authSummary" class="field-error" role="status" aria-live="polite" hidden></div><div class="field"><label for="lEmail">Email address</label><input id="lEmail" name="email" type="email" autocomplete="email" placeholder="you@company.com" aria-describedby="lEmailError" required><div class="field-error" id="lEmailError"></div></div><div class="field"><label for="lPass">Password</label><div class="password-input-wrap"><input id="lPass" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" aria-describedby="lPassError" required><button class="toggle-password" type="button" data-target="lPass" aria-label="Show password">👁</button></div><div class="field-error" id="lPassError"></div></div><div class="auth-actions-row"><label class="checkbox-row compact" for="lRemember"><input id="lRemember" type="checkbox"><span>Remember me</span></label><a href="#" class="inline-link" onclick="event.preventDefault();toast(\'Password reset is not enabled in this environment.\')">Forgot password?</a></div><button class="btn btn-primary btn-block" type="submit">Log in</button><div class="auth-divider"><span>or continue with</span></div><div class="sso-grid"><button class="sso-btn sso-google" type="button" aria-label="Continue with Google" onclick="toast(\'Google sign in is not configured in this environment.\')"><span class="sso-icon">G</span>Google</button><button class="sso-btn sso-github" type="button" aria-label="Continue with GitHub" onclick="toast(\'GitHub sign in is not configured in this environment.\')"><span class="sso-icon">◌</span>GitHub</button><button class="sso-btn sso-apple" type="button" aria-label="Continue with Apple" onclick="toast(\'Apple sign in is not configured in this environment.\')"><span class="sso-icon"></span>Apple</button><button class="sso-btn sso-microsoft" type="button" aria-label="Continue with Microsoft" onclick="toast(\'Microsoft sign in is not configured in this environment.\')"><span class="sso-icon">M</span>Microsoft</button></div><p class="auth-switch">Don\'t have an account? <a href="#" onclick="event.preventDefault();renderAuth(\'reg\')">Sign up</a>.</p></form>';
}
const form=f.querySelector('form');if(form){form.addEventListener('submit',e=>{e.preventDefault();if(mode==='reg'){doRegister();}else{doLogin();}})}
bindAuthPasswordToggles();bindAuthFieldValidation();if(typeof applyAuthBranding==='function')applyAuthBranding();}
/* Base auth/session stubs removed — canonical secure versions live in js/auth-fix.js (doLogin/doRegister/boot/logout). */
function updateChrome(){const u=me();$('#userMini').innerHTML='<div class="um-avatar">'+esc(initials(u.name))+'</div><div class="um-meta"><b>'+esc(u.name)+'</b><span>'+esc(roleLabel(u.role))+' <em>·</em> '+esc(u.dept)+'</span></div>';$('#profileChip').innerHTML='<div class="avatar">'+esc(u.name[0])+'</div><div><b>'+esc(u.name.split(' ')[0])+'</b><br><span style="color:var(--muted);font-size:11px">'+esc(roleLabel(u.role))+'</span></div>';const my=DB.notifs.filter(n=>n.to===u.id&&!n.read).length;$('#notifDot').style.display=my?'block':'none';const urg=DB.tickets.filter(t=>!['Resolved','Closed'].includes(t.status)&&slaRemain(t)<60).length;$('#slaMini').innerHTML=urg?('<span class="pulse" style="background:#E8930C;box-shadow:0 0 0 4px rgba(232,147,12,.18)"></span><span>SLA attention — <b>'+urg+' ticket(s)</b></span>'):('<span class="pulse"></span><span>SLA healthy — <b>all clear</b></span>');const lo=$('#logoutBtn2');if(lo)lo.innerHTML=navIcon('logout')+'<span>Log out</span>';const titleMap={dashboard:'Dashboard',tickets:'All Tickets',mytickets:'My Tickets',unassigned:'Unassigned Queue',new:'New Ticket',kb:'Knowledge Base',assets:'Asset Registry',ai:'AI Assistant',reports:'Reports',users:'User Management',techs:'Technicians',depts:'Departments',cats:'Categories',sla:'SLA Management',audit:'Audit Logs',settings:'Settings'};const titleEl=document.querySelector('.topbar-title');if(titleEl){titleEl.innerHTML='<b>'+ (titleMap[ROUTE.page]||'Dashboard') +'</b><span>Operations overview</span>';} document.title = (titleMap[ROUTE.page]||'Dashboard') + ' · IEPM Ticket System';}
/* buildNav lives in js/supportdesk-ui.js (single canonical definition) */
function go(pg,arg){ROUTE={page:pg,arg:arg||''};buildNav();const c=$('#content');window.scrollTo(0,0);
if(pg==='dashboard')return vDashboard(c);if(pg==='tickets')return vTickets(c,'all');if(pg==='mytickets')return vTickets(c,'mine');if(pg==='unassigned')return vTickets(c,'unassigned');if(pg==='new')return vNew(c);if(pg==='detail')return (typeof vDetailChecked==='function'?vDetailChecked:vDetail)(c,arg);if(pg==='kb')return vKB(c);if(pg==='assets')return vAssets(c);if(pg==='ai')return vAI(c);if(pg==='reports')return vReports(c);if(pg==='users')return vUsers(c);if(pg==='techs')return vTechs(c);if(pg==='depts')return vDepts(c);if(pg==='cats')return vCats(c);if(pg==='sla')return vSLA(c);if(pg==='audit')return vAudit(c);if(pg==='settings')return vSettings(c);return vDashboard(c)}
function head(t,s){return'<div class="page-head"><div><h2>'+t+'</h2><p>'+s+'</p></div><div class="spacer"></div></div>'}
/* vTickets canonical definition lives in js/auth-fix.js (role-aware filtering). Base duplicate removed. */
/* vDashboard canonical definition lives in js/supportdesk-ui.js. Base duplicate removed. */
function kbSuggest(cat,desc){const w=(cat+' '+desc).toLowerCase().split(/[^a-z0-9]+/);return DB.kb.map(k=>{const t=(k.title+' '+k.body+' '+k.cat).toLowerCase();let s=w.filter(x=>x.length>3&&t.includes(x)).length;if(t.includes(cat.toLowerCase()))s+=2;return{k,s}}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,3)}
function vNew(c){c.innerHTML=head('Create New Ticket','SLA enforced - auto-assigned to best technician')+'<div class="cards2"><div class="card"><div class="row2"><div class="field"><label>Subject</label><input id="nSub" placeholder="e.g. Internet connection unavailable"></div><div class="field"><label>Category</label><select id="nCat">'+CATS.map(x=>'<option>'+x+'</option>').join('')+'</select></div></div><div class="row3"><div class="field"><label>Priority</label><select id="nPri"><option>Critical</option><option selected>High</option><option>Medium</option><option>Low</option></select></div><div class="field"><label>Department</label><select id="nDept">'+DB.departments.map(d=>'<option>'+esc(d.name)+'</option>').join('')+'</select></div><div class="field"><label>Location</label><input id="nLoc" value="Primary site"></div></div><div class="field"><label>Description</label><textarea id="nDesc" placeholder="Describe the problem..."></textarea></div><div class="row2"><div class="field"><label>Asset (optional)</label><select id="nAsset"><option value="">- none -</option>'+DB.assets.map(a=>'<option value="'+a.id+'">'+a.id+' - '+esc(a.device)+'</option>').join('')+'</select></div><div class="field"><label>Attachment filename</label><input id="nFile" placeholder="e.g. screenshot.png"></div></div><div id="kbSug"></div><button class="btn btn-primary" onclick="submitTicket()">Submit Ticket</button></div><div class="card"><h3>AI Assistant</h3><div class="ai-box" id="aiPrev">Type subject + description, then classify.</div><button class="btn btn-ghost btn-sm" onclick="aiClassify()">Classify with AI</button><h3 style="margin-top:14px">SLA targets</h3><div style="font-size:13px">Critical: 15m / 2h<br>High: 30m / 4h<br>Medium: 2h / 8h<br>Low: 4h / 24h</div></div></div>';
const upd=()=>{const s=kbSuggest($('#nCat').value,$('#nSub').value+' '+$('#nDesc').value);$('#kbSug').innerHTML=s.length?'<div class="ai-box"><b>Articles that may help</b><br>'+s.map(x=>'- '+esc(x.k.title)+'<br>').join('')+'</div>':''};
['nSub','nDesc'].forEach(id=>$('#'+id).oninput=upd);$('#nCat').onchange=upd}
function aiClassify(){const t=($('#nSub').value+' '+$('#nDesc').value).toLowerCase();let cat='Other';if(/wifi|internet|network|vpn|router/.test(t))cat='Network';else if(/laptop|printer|hardware|boot|keyboard|monitor/.test(t))cat='Hardware';else if(/outlook|email|365|office|teams/.test(t))cat='Microsoft 365';else if(/password|login|account|locked/.test(t))cat='Account / Password';else if(/phish|hack|virus|malware|security/.test(t))cat='Security';else if(/print|scan/.test(t))cat='Printer';else if(/phone|mobile|tablet/.test(t))cat='Mobile / Device';else if(/install|software|app/.test(t))cat='Software';
let pri='Medium';if(/urgent|critical|down|breach|entire|all users/.test(t))pri='Critical';else if(/not working|blocked|unable|fail/.test(t))pri='High';else if(/slow|request|question/.test(t))pri='Low';
$('#nCat').value=cat;$('#nPri').value=pri;$('#aiPrev').innerHTML='<b>AI result</b><br>Category: <b>'+cat+'</b><br>Priority: <b>'+pri+'</b>';toast('AI: '+cat+' / '+pri)}
function submitTicket(){const u=me();const sub=$('#nSub').value.trim();if(sub.length<4)return toast('Enter a subject');const cat=$('#nCat').value;const id='TK-'+(DB.seq++);const agents=DB.users.filter(x=>x.role==='engineer');let ag='';if(agents.length){ag=agents.sort((a,b)=>DB.tickets.filter(t=>t.assignee===a.id&&!['Resolved','Closed'].includes(t.status)).length-DB.tickets.filter(t=>t.assignee===b.id&&!['Resolved','Closed'].includes(t.status)).length)[0].id}
const t={id,subject:sub,category:cat,priority:$('#nPri').value,status:ag?'Assigned':'New',dept:$('#nDept').value,location:$('#nLoc').value,requester:u.id,assignee:ag,created:new Date().toISOString(),updated:new Date().toISOString(),desc:$('#nDesc').value,asset:$('#nAsset').value,rating:0,messages:[{by:u.id,kind:'user',text:$('#nDesc').value||sub,at:new Date().toISOString(),file:$('#nFile').value||''}],history:[{t:new Date().toISOString(),e:'Created by '+u.name}]};
if(ag)t.history.push({t:new Date().toISOString(),e:'Auto-assigned to '+uname(ag)});
DB.tickets.unshift(t);if(ag)notify(ag,'New ticket '+id+' assigned to you');sendTicketNotificationEmail(t);audit(u.name+' created '+id);save();toast('Ticket '+id+' created');go('detail',id)}
function vDetail(c,id){const t=DB.tickets.find(x=>x.id===id);if(!t){c.innerHTML=head('Not found','');return}const u=me();const canStaff=['admin','qms','engineer'].includes(u.role);
const asset=t.asset?DB.assets.find(a=>a.id===t.asset):null;
c.innerHTML=head('#'+t.id+' - '+esc(t.subject),esc(t.category)+' · opened '+fmtDT(t.created))+'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+stBadge(t.status)+prBadge(t.priority)+slaBadge(t)+'<span class="badge b-gray">'+esc(t.dept)+'</span></div><div class="cards2"><div class="card"><div class="chat">'+t.messages.map(m=>{const cls=m.kind==='internal'?'internal':(DB.users.find(x=>x.id===m.by)||{}).role==='employee'?'user':'staff';return'<div class="msg '+cls+'"><div class="meta">'+esc(uname(m.by))+' · '+fmtDT(m.at)+(m.kind==='internal'?' · INTERNAL':'')+'</div>'+esc(m.text)+(m.file?'<br><span class="attach-chip">📎 '+esc(m.file)+'</span>':'')+'</div>'}).join('')+'</div><div class="reply-box"><input id="rText" placeholder="Write a reply..."><button class="btn btn-primary btn-sm" onclick="sendReply(\''+t.id+'\',false)">Send</button>'+(canStaff?'<button class="btn btn-ghost btn-sm" onclick="sendReply(\''+t.id+'\',true)">Internal note</button>':'')+'</div>'+(t.status==='Resolved'&&t.requester===u.id?'<div style="margin-top:10px">Rate support: <span id="stars"></span> <button class="btn btn-ghost btn-sm" onclick="reopenTicket(\''+t.id+'\')">Reopen</button></div>':'')+'<div id="aiOut"></div>'+(canStaff?'<div class="ai-box"><b>AI Assist</b><br><button class="btn btn-ghost btn-sm" onclick="aiSum(\''+t.id+'\')">Summarize</button> <button class="btn btn-ghost btn-sm" onclick="aiDraft(\''+t.id+'\')">Draft response</button> <button class="btn btn-ghost btn-sm" onclick="aiSol(\''+t.id+'\')">Suggest solution</button></div>':'')+'</div><div><div class="card"><h3>Details</h3><div style="font-size:13px;display:grid;gap:6px"><div>Requester: <b>'+esc(uname(t.requester))+'</b></div><div>Assignee: <b>'+esc(t.assignee?uname(t.assignee):'Unassigned')+'</b></div><div>Department: '+esc(t.dept)+'</div><div>Location: '+esc(t.location)+'</div><div>Asset: '+(asset?esc(asset.id+' - '+asset.device):'-')+'</div>'+(t.resolution?'<div>Resolution: '+esc(t.resolution)+'</div>':'')+'</div>'+(canStaff?'<div class="field"><label>Status</label><select id="dStatus">'+['New','Open','Assigned','In Progress','Pending','Waiting for User','Escalated','Resolved','Closed'].map(s=>'<option '+(t.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></div><div class="row2"><div class="field"><label>Priority</label><select id="dPri">'+['Critical','High','Medium','Low'].map(s=>'<option '+(t.priority===s?'selected':'')+'>'+s+'</option>').join('')+'</select></div><div class="field"><label>Assign to</label><select id="dAssign"><option value="">Unassigned</option>'+DB.users.filter(x=>['admin','qms','engineer'].includes(x.role)).map(a=>'<option value="'+a.id+'" '+(t.assignee===a.id?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></div></div><div class="field"><label>Resolution notes</label><input id="dRes" value="'+esc(t.resolution||'')+'" placeholder="Required when resolving"></div><button class="btn btn-primary btn-sm btn-block" onclick="saveDetail(\''+t.id+'\')">Save changes</button>':'')+'</div><div class="card" style="margin-top:14px"><h3>Timeline</h3><div class="timeline">'+t.history.map(h=>'<div><b>'+fmtDT(h.t)+'</b><br>'+esc(h.e)+'</div>').join('')+'</div></div></div></div>';
if(t.status==='Resolved'&&t.requester===u.id){let s='';for(let i=1;i<=5;i++)s+='<span style="cursor:pointer;font-size:20px" onclick="rateTicket(\''+t.id+'\','+i+')">'+(i<=t.rating?'⭐':'☆')+'</span>';setTimeout(()=>{const el=$('#stars');if(el)el.innerHTML=s},0)}}
/* Base ticket/user mutations removed — canonical secured versions live in js/auth-fix.js (sendReply/saveDetail/rateTicket/reopenTicket/userSave/delUser/kbSave/assetSave/deptAdd/deptDel). */
function aiSum(id){const t=DB.tickets.find(x=>x.id===id);$('#aiOut').innerHTML='<div class="ai-box"><b>AI summary</b><br>Issue: '+esc(t.subject)+'<br>Category: '+esc(t.category)+' · Priority: '+esc(t.priority)+'<br>Messages: '+t.messages.length+' · Latest: '+esc((t.messages[t.messages.length-1]||{}).text||'-').slice(0,140)+'</div>'}
function aiDraft(id){const t=DB.tickets.find(x=>x.id===id);const d='Hi '+uname(t.requester).split(' ')[0]+', thanks for reporting "'+t.subject+'". Our '+(t.category)+' team is on it (priority '+t.priority+'). Next step: we will update you within '+(SLA_H[t.priority].resp)+' minutes. Please keep the device available.';$('#aiOut').innerHTML='<div class="ai-box"><b>AI draft</b><br>'+esc(d)+'<br><br><button class="btn btn-primary btn-sm" onclick="useDraft(\''+id+'\')">Use in reply box</button></div>';window._draft=d}
function useDraft(id){const el=$('#rText');if(el){el.value=window._draft||'';el.focus()}}
function aiSol(id){const t=DB.tickets.find(x=>x.id===id);const s=kbSuggest(t.category,t.subject+' '+t.desc);$('#aiOut').innerHTML='<div class="ai-box"><b>AI suggested fix</b><br>1) Confirm scope (one user or many). 2) Check related KB below. 3) Collect logs/screenshot. 4) Apply fix and verify.<br>'+(s.map(x=>'- '+esc(x.k.title)).join('<br>')||'- No KB match')+'</div>'}
function vKB(c){c.innerHTML=head('Knowledge Base',DB.kb.length+' articles')+'<div class="filters"><input id="kQ" placeholder="Search articles..." style="flex:1;min-width:220px"><select id="kC"><option value="">All</option>'+[...new Set(DB.kb.map(k=>k.cat))].map(x=>'<option>'+esc(x)+'</option>').join('')+'</select>'+(['admin','engineer','qms'].includes(me().role)?'<button class="btn btn-primary btn-sm" onclick="kbModal()">+ Article</button>':'')+'</div><div class="kb-grid" id="kGrid"></div>';
function drawK(){const q=($('#kQ').value||'').toLowerCase(),cc=$('#kC').value;$('#kGrid').innerHTML=DB.kb.filter(k=>(!q||(k.title+k.body).toLowerCase().includes(q))&&(!cc||k.cat===cc)).map(k=>'<div class="card kb-card" onclick="kbView(\''+k.id+'\')"><span class="badge b-blue">'+esc(k.cat)+'</span><h3 style="margin:8px 0">'+esc(k.title)+'</h3><div style="font-size:13px;color:var(--muted)">'+esc(k.body.slice(0,110))+'...</div><div style="font-size:12px;color:var(--muted);margin-top:8px">👁 '+k.views+' views</div></div>').join('')||'No articles'}
['kQ','kC'].forEach(id=>$('#'+id).oninput=drawK);drawK()}
function kbView(id){const k=DB.kb.find(x=>x.id===id);k.views++;save();openModal('<h3>'+esc(k.title)+'</h3><p><span class="badge b-blue">'+esc(k.cat)+'</span> <span style="color:var(--muted);font-size:12px">'+k.views+' views</span></p><p style="line-height:1.6">'+esc(k.body)+'</p><button class="btn btn-ghost" onclick="closeModal()">Close</button>')}
function kbModal(){openModal('<h3>New article</h3><div class="field"><label>Title</label><input id="kbT"></div><div class="field"><label>Category</label><select id="kbC">'+CATS.map(x=>'<option>'+x+'</option>').join('')+'</select></div><div class="field"><label>Body</label><textarea id="kbB"></textarea></div><button class="btn btn-primary" onclick="kbSave()">Save</button> <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>')}
/* kbSave canonical secured version lives in js/auth-fix.js. Base duplicate removed. */
function vAssets(c){c.innerHTML=head('Asset Management',DB.assets.length+' devices with ticket history')+'<div class="filters"><input id="aQ" placeholder="Search asset, serial, user..." style="flex:1;min-width:200px">'+(['admin','qms'].includes(me().role)?'<button class="btn btn-primary btn-sm" onclick="assetModal()">+ Asset</button>':'')+'</div><div class="table-wrap"><table class="table"><tr><th>Asset</th><th>Device</th><th>User</th><th>Dept</th><th>Status</th><th>Tickets</th></tr><tbody id="aB"></tbody></table></div>';
function drawA(){const q=($('#aQ').value||'').toLowerCase();$('#aB').innerHTML=DB.assets.filter(a=>!q||(a.id+a.device+a.serial+uname(a.user)).toLowerCase().includes(q)).map(a=>{const n=DB.tickets.filter(t=>t.asset===a.id).length;return'<tr class="ticket-row" onclick="assetView(\''+a.id+'\')"><td><b>'+a.id+'</b><br><span style="font-size:12px;color:var(--muted)">'+esc(a.serial)+'</span></td><td>'+esc(a.device)+'</td><td>'+esc(a.user?uname(a.user):'-')+'</td><td>'+esc(a.dept)+'</td><td><span class="badge '+(a.status==='Active'?'b-green':'b-amber')+'">'+esc(a.status)+'</span></td><td>'+n+'</td></tr>'}).join('')}
$('#aQ').oninput=drawA;drawA()}
function assetView(id){const a=DB.assets.find(x=>x.id===id);const h=DB.tickets.filter(t=>t.asset===id);openModal('<h3>'+a.id+' - '+esc(a.device)+'</h3><div style="font-size:14px;display:grid;gap:6px"><div>User: <b>'+esc(a.user?uname(a.user):'-')+'</b></div><div>Dept: '+esc(a.dept)+' · Location: '+esc(a.location)+'</div><div>Serial: '+esc(a.serial)+' · Warranty: '+esc(a.warranty)+'</div><div>Status: '+esc(a.status)+'</div></div><h3 style="margin-top:12px">Ticket history ('+h.length+')</h3>'+(h.map(t=>'<div style="font-size:13px;padding:6px 0">• <a href="#" onclick="event.preventDefault();closeModal();go(\'detail\',\''+t.id+'\')">'+t.id+'</a> '+esc(t.subject)+' '+stBadge(t.status)+'</div>').join('')||'No tickets')+'<br><button class="btn btn-ghost" onclick="closeModal()">Close</button>',true)}
function assetModal(){openModal('<h3>New asset</h3><div class="row2"><div class="field"><label>Asset ID</label><input id="asI" placeholder="LAP-00500"></div><div class="field"><label>Device</label><input id="asD" placeholder="Dell Latitude 5440"></div></div><div class="row2"><div class="field"><label>User</label><select id="asU"><option value="">- none -</option>'+DB.users.map(u=>'<option value="'+u.id+'">'+esc(u.name)+'</option>').join('')+'</select></div><div class="field"><label>Dept</label><select id="asDept">'+DB.departments.map(d=>'<option>'+esc(d.name)+'</option>').join('')+'</select></div></div><button class="btn btn-primary" onclick="assetSave()">Save</button>')}
/* assetSave canonical secured version lives in js/auth-fix.js. Base duplicate removed. */
function vAI(c){c.innerHTML=head('AI Support Assistant','Describe the issue - AI suggests a fix or drafts a ticket')+'<div class="cards2"><div class="card"><div class="field"><label>Describe your problem</label><textarea id="aiQ" placeholder="e.g. Access issue or device outage..."></textarea></div><button class="btn btn-primary" onclick="aiAsk()">Ask AI</button> <button class="btn btn-ghost" onclick="aiToTicket()">Create ticket from this</button><div id="aiAns"></div></div><div class="card"><h3>Suggested issue types</h3><div style="display:grid;gap:8px;font-size:14px"><button class="btn btn-ghost btn-sm" onclick="aiFill(0)">Email access issue</button><button class="btn btn-ghost btn-sm" onclick="aiFill(1)">Network or VPN outage</button><button class="btn btn-ghost btn-sm" onclick="aiFill(2)">Printer offline</button><button class="btn btn-ghost btn-sm" onclick="aiFill(3)">Suspicious login or security alert</button></div></div></div>'}
const AIEX=['My Outlook is not receiving emails','Wi-Fi keeps disconnecting on my laptop','Printer shows offline but is powered on','I think I clicked a phishing link'];
function aiFill(i){$('#aiQ').value=AIEX[i];aiAsk()}
function aiAsk(){const q=$('#aiQ').value||'';if(q.length<4)return toast('Describe the problem');const s=kbSuggest('',q);const t=q.toLowerCase();let steps=['Check power, cables and restart the device','Confirm whether others are affected','Capture exact error message + screenshot','Try the KB article below','If unresolved, create a ticket'];if(/outlook|email|365/.test(t))steps=['Check internet first','Verify Outlook shows Connected (bottom bar)','File > Account Settings > Repair','Check mailbox storage (webmail)','Restart Outlook, sign in again'];else if(/wifi|network|vpn|internet/.test(t))steps=['Toggle Wi-Fi, forget + rejoin','Restart adapter (ncpa.cpl)','ipconfig /release + /renew','Try wired / hotspot to isolate','Restart router if home network'];else if(/print/.test(t))steps=['Power cycle printer','Reseat paper tray, clear jam','Reinstall driver','Set as default printer','Test page'];else if(/phish|hack|virus|security/.test(t))steps=['Disconnect network immediately','Do NOT enter passwords','Report Message > Phishing in Outlook','Raise Security/High ticket now','Contact IT by phone'];
$('#aiAns').innerHTML='<div class="ai-box"><b>Possible solution</b><ol>'+steps.map(x=>'<li>'+x+'</li>').join('')+'</ol>'+(s.length?'<b>Related articles</b><br>'+s.map(x=>'- '+esc(x.k.title)).join('<br>'):'')+'<br><br>Not solved? Click <b>Create ticket from this</b>.</div>';window._aiQ=q}
function aiToTicket(){const q=window._aiQ||($('#aiQ')&&$('#aiQ').value)||'';if(!q)return toast('Ask AI first');go('new');setTimeout(()=>{const s=$('#nSub');if(s){s.value=q.slice(0,80);$('#nDesc').value='AI-assisted report: '+q;aiClassify()}},50)}
function vReports(c){const T=DB.tickets;const res=T.filter(t=>['Resolved','Closed'].includes(t.status)).length;const comp=T.length?Math.round(res/T.length*100):0;const rated=T.filter(t=>t.rating>0);const sat=rated.length?(rated.reduce((a,b)=>a+b.rating,0)/rated.length).toFixed(1):'-';
function bars(list){const m=Math.max(1,...list.map(x=>x[1]));return list.map(([k,v])=>'<div class="chart-bar"><div class="t">'+esc(k)+'</div><div class="bar" style="width:'+Math.round(v/m*220)+'px"></div><b>'+v+'</b></div>').join('')}
const byCat=CATS.map(k=>[k,T.filter(t=>t.category===k).length]).filter(x=>x[1]>0);const byPri=['Critical','High','Medium','Low'].map(k=>[k,T.filter(t=>t.priority===k).length]);const byTech=DB.users.filter(u=>u.role==='engineer').map(u=>[u.name,T.filter(t=>t.assignee===u.id).length]);const byDept=DB.departments.map(d=>[d.name,T.filter(t=>t.dept===d.name).length]).filter(x=>x[1]>0);
c.innerHTML=head('Reports & Analytics','Performance, workload and SLA')+'<div class="stats"><div class="stat"><div class="lbl">Total</div><div class="val">'+T.length+'</div></div><div class="stat"><div class="lbl">Resolved %</div><div class="val">'+comp+'%</div></div><div class="stat"><div class="lbl">Satisfaction</div><div class="val">'+sat+'★</div></div><div class="stat"><div class="lbl">SLA breaches</div><div class="val">'+T.filter(t=>slaRemain(t)<0&&!['Resolved','Closed'].includes(t.status)).length+'</div></div></div><div class="cards2"><div class="card"><h3>Tickets by category</h3>'+bars(byCat)+'<h3>By priority</h3>'+bars(byPri)+'</div><div class="card"><h3>By technician</h3>'+bars(byTech)+'<h3>By department</h3>'+bars(byDept)+'</div></div>'}
function vUsers(c){c.innerHTML=head('User Management',DB.users.length+' users')+'<button class="btn btn-primary btn-sm" onclick="userModal()">+ User</button><div class="table-wrap" style="margin-top:12px"><table class="table"><tr><th>Name</th><th>Email</th><th>Role</th><th>Dept</th><th>Tickets</th><th></th></tr>'+DB.users.map(u=>{const n=DB.tickets.filter(t=>t.requester===u.id||t.assignee===u.id).length;return'<tr><td><b>'+esc(u.name)+'</b></td><td>'+esc(u.email)+'</td><td><span class="badge b-dark">'+esc(roleLabel(u.role))+'</span></td><td>'+esc(u.dept)+'</td><td>'+n+'</td><td>'+(u.id!==me().id?'<button class="btn btn-danger btn-sm" onclick="delUser(\''+u.id+'\')">Del</button>':'')+'</td></tr>'}).join('')+'</table></div>'}
function userModal(){openModal('<h3>New user</h3><div class="field"><label>Name</label><input id="uuN"></div><div class="field"><label>Email</label><input id="uuE"></div><div class="row2"><div class="field"><label>Password</label><input id="uuP" value="user123"></div><div class="field"><label>Role</label><select id="uuR">'+ROLES.map(r=>'<option value="'+r.value+'">'+r.label+'</option>').join('')+'</select></div></div><button class="btn btn-primary" onclick="userSave()">Save</button>')}
/* userSave/delUser canonical secured versions live in js/auth-fix.js. Base duplicates removed. */
function vTechs(c){const ts=DB.users.filter(u=>u.role==='engineer');c.innerHTML=head('Technicians',ts.length+' engineers')+'<div class="kb-grid">'+ts.map(t=>{const open=DB.tickets.filter(x=>x.assignee===t.id&&!['Resolved','Closed'].includes(x.status)).length;const done=DB.tickets.filter(x=>x.assignee===t.id&&['Resolved','Closed'].includes(x.status)).length;return'<div class="card"><b>'+esc(t.name)+'</b><div style="font-size:13px;color:var(--muted)">'+esc(t.email)+'</div><div class="stats" style="grid-template-columns:1fr 1fr"><div class="stat"><div class="lbl">Open</div><div class="val">'+open+'</div></div><div class="stat"><div class="lbl">Done</div><div class="val">'+done+'</div></div></div></div>'}).join('')+'</div>'}
function vDepts(c){c.innerHTML=head('Departments',DB.departments.length+' departments')+'<div class="filters"><input id="dN" placeholder="New department"><button class="btn btn-primary btn-sm" onclick="deptAdd()">Add</button></div><div class="table-wrap"><table class="table"><tr><th>Name</th><th>Tickets</th><th></th></tr>'+DB.departments.map(d=>'<tr><td><b>'+esc(d.name)+'</b></td><td>'+DB.tickets.filter(t=>t.dept===d.name).length+'</td><td><button class="btn btn-danger btn-sm" onclick="deptDel(\''+d.id+'\')">Del</button></td></tr>').join('')+'</table></div>'}
/* deptAdd/deptDel canonical secured versions live in js/auth-fix.js. Base duplicates removed. */
function vCats(c){c.innerHTML=head('Categories',DB.categories.length+' routing rules')+'<div class="table-wrap"><table class="table"><tr><th>Category</th><th>Team</th><th>Tickets</th></tr>'+DB.categories.map(k=>'<tr><td><b>'+esc(k.name)+'</b></td><td>'+esc(k.team)+'</td><td>'+DB.tickets.filter(t=>t.category===k.name).length+'</td></tr>').join('')+'</table></div>'}
function vSLA(c){c.innerHTML=head('SLA Management','Targets by priority')+'<div class="table-wrap"><table class="table"><tr><th>Priority</th><th>Response</th><th>Resolution</th><th>Open</th><th>Breached</th></tr>'+Object.entries(SLA_H).map(([k,v])=>{const o=DB.tickets.filter(t=>t.priority===k&&!['Resolved','Closed'].includes(t.status));return'<tr><td>'+prBadge(k)+'</td><td>'+v.resp+' min</td><td>'+(v.res/60)+'h</td><td>'+o.length+'</td><td>'+o.filter(t=>slaRemain(t)<0).length+'</td></tr>'}).join('')+'</table></div><div class="card" style="margin-top:14px"><h3>At risk now</h3>'+(DB.tickets.filter(t=>!['Resolved','Closed'].includes(t.status)&&slaRemain(t)<60).map(t=>'<div style="font-size:13px;padding:6px 0"><b>'+t.id+'</b> '+esc(t.subject)+' '+slaBadge(t)+'</div>').join('')||'All clear')+'</div>'}
function vAudit(c){c.innerHTML=head('Audit Logs',DB.audit.length+' events')+'<div class="table-wrap"><table class="table"><tr><th>Time</th><th>Actor</th><th>Event</th></tr>'+DB.audit.slice(0,80).map(a=>'<tr><td style="font-size:12px">'+fmtDT(a.t)+'</td><td>'+esc(a.by)+'</td><td>'+esc(a.act)+'</td></tr>').join('')+'</table></div>'}
function vSettings(c){const u=me();c.innerHTML=head('Settings','Profile + local system')+'<div class="cards2"><div class="card"><h3>My profile</h3><div class="field"><label>Name</label><input id="sN" value="'+esc(u.name)+'"></div><div class="row2"><div class="field"><label>Phone</label><input id="sP" value="'+esc(u.phone||'')+'"></div><div class="field"><label>Location</label><input id="sL" value="'+esc(u.location||'')+'"></div></div><button class="btn btn-primary btn-sm" onclick="setSave()">Save</button></div><div class="card"><h3>System</h3><p style="font-size:13px;color:var(--muted)">Runs in browser localStorage and can be cleared for a new deployment.</p><button class="btn btn-ghost btn-sm" onclick="resetLocalData()">Clear local data</button> <button class="btn btn-danger btn-sm" onclick="logout()">Log out</button></div></div>'}
function setSave(){const u=me();u.name=$('#sN').value;u.phone=$('#sP').value;u.location=$('#sL').value;save();updateChrome();toast('Saved')}
function resetLocalData(){if(!confirm('Clear all saved local data and reset the app?'))return;localStorage.removeItem(DB_KEY);location.reload()}
function wireTop(){const hb=$('#hamburger');if(hb)hb.onclick=()=>$('#sidebar').classList.toggle('open');const sc=$('#sidebarClose');if(sc)sc.onclick=()=>$('#sidebar').classList.remove('open');const nb=$('#newTicketBtn');if(nb){nb.innerHTML='💬';nb.title='Chat with system admin on WhatsApp';nb.setAttribute('aria-label','Chat with system admin on WhatsApp');nb.onclick=()=>window.open('https://wa.me/2348188615005?text=' + encodeURIComponent('Hello admin, I need help with the IEPM Ticket System.'), '_blank', 'noopener,noreferrer');}const lo=$('#logoutBtn2');if(lo)lo.onclick=logout;
const gs=$('#globalSearch');if(gs)gs.onkeydown=e=>{if(e.key==='Enter'){const q=gs.value.toLowerCase();const t=DB.tickets.find(x=>(x.subject+x.id).toLowerCase().includes(q));if(t)go('detail',t.id);else toast('No match for "'+gs.value+'"')}};
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){e.preventDefault();const g=$('#globalSearch');if(g)g.focus()}});
const bell=$('#notifBtn');if(bell)bell.onclick=()=>{const p=$('#notifPanel');p.classList.toggle('hidden');const u=me();p.innerHTML='<div style="padding:12px;border-bottom:1px solid var(--border)"><b>Notifications</b> <button class="btn btn-ghost btn-sm" style="float:right" onclick="readAll()">Mark read</button></div>'+(DB.notifs.filter(n=>n.to===u.id).slice(0,15).map(n=>'<div class="notif-item'+(n.read?'':' unread')+'">'+esc(n.text)+'<br><span style="color:var(--muted);font-size:11px">'+timeAgo(n.at)+'</span></div>').join('')||'<div class="notif-item">No notifications</div>')};
if(typeof wireTopExtras==='function')wireTopExtras();}
function readAll(){DB.notifs.forEach(n=>{if(n.to===me().id)n.read=true});save();updateChrome();$('#notifPanel').classList.add('hidden');toast('All read')}
window.addEventListener('DOMContentLoaded',()=>{wireTop();boot()});











window.addEventListener('storage', (event) => {
  if (event.key !== DB_KEY || !event.newValue) return;
  try {
    const next = JSON.parse(event.newValue);
    if (next && Array.isArray(next.users) && Array.isArray(next.tickets)) {
      DB = next;
      refreshVisibleData();
    }
  } catch (e) { /* ignore stale/invalid localStorage payloads */ }
});
window.addEventListener('iepm-db-updated', () => {
  refreshVisibleData();
});

function audit(act){DB.audit.unshift({t:new Date().toISOString(),by:DB.session||'system',act})}

