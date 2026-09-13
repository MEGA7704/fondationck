(() => {
  const state = { data: null, csrf: '', user: null, loadPromise: null, scope: '' };
  const page = document.body.dataset.page || 'home';
  const authRequired = document.body.dataset.auth === 'required';
  const FOUNDATION_PHONE = '0757577542 / 0545202646';
  const FOUNDATION_EMAIL = 'oukami011@gmail.com';

  function esc(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function fmtDate(v) { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString('fr-FR'); }
  function money(v) { return new Intl.NumberFormat('fr-FR').format(Number(v || 0)) + ' F'; }
  function roleLabel(u={}) {
    if (u.role === 'superadmin') return 'Super Admin';
    if (u.role === 'admin') return u.access?.account_type === 'principal_admin' ? 'Administrateur principal' : 'Sous-administrateur';
    if (u.access?.account_type === 'visitor') return 'Visiteur';
    return 'Agent';
  }
  function toast(message, type='ok') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('aria-live','polite');
      document.body.appendChild(stack);
    }
    const kind = type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'ok';
    const title = kind === 'error' ? 'Une erreur est survenue' : kind === 'warn' ? 'Attention' : 'Information';
    const icon = kind === 'error' ? '!' : kind === 'warn' ? '!' : '✓';
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.innerHTML = `<div class="toast-icon" aria-hidden="true">${icon}</div><div class="toast-copy"><strong>${esc(title)}</strong><span>${esc(message)}</span></div><button type="button" class="toast-close" aria-label="Fermer">×</button><span class="toast-progress" aria-hidden="true"></span>`;
    stack.appendChild(el);
    const close = () => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 180); };
    el.querySelector('.toast-close')?.addEventListener('click', close);
    const timer = setTimeout(close, kind === 'error' ? 6200 : 4600);
    el.addEventListener('mouseenter', () => clearTimeout(timer), {once:true});
  }
  function modal({title, html, large=false, onReady, variant='default', icon=''}={}) {
    const wrap = document.createElement('div'); wrap.className='modal-backdrop open';
    const modalIcon = icon || (variant==='danger' ? '!' : variant==='success' ? '✓' : variant==='warning' ? '!' : 'i');
    wrap.innerHTML = `<div class="modal ${large?'modal-lg':''} modal-${esc(variant)}" role="dialog" aria-modal="true"><div class="modal-head"><div class="modal-title-wrap"><span class="modal-title-icon" aria-hidden="true">${esc(modalIcon)}</span><h2>${esc(title||'')}</h2></div><button class="close-x" type="button" aria-label="Fermer">×</button></div><div class="modal-body">${html||''}</div></div>`;
    document.body.appendChild(wrap);
    enhancePasswordFields(wrap);
    const close = () => { wrap.classList.add('closing'); setTimeout(()=>wrap.remove(),140); };
    wrap.querySelector('.close-x').addEventListener('click', close);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    const escHandler=e=>{if(e.key==='Escape'){document.removeEventListener('keydown',escHandler);close();}};
    document.addEventListener('keydown',escHandler);
    if (onReady) onReady(wrap, close);
    return {el:wrap, close};
  }
  function infoPopup(message, {title='Information', type='info', buttonText='Compris'}={}) {
    return new Promise(resolve => {
      const variant = type==='error'?'danger':type==='warn'?'warning':type==='success'?'success':'info';
      modal({title,variant,html:`<div class="pro-message"><p>${esc(message)}</p></div><div class="modal-actions"><button type="button" class="btn btn-primary" data-ok>${esc(buttonText)}</button></div>`,onReady:(wrap,close)=>{
        wrap.querySelector('[data-ok]').addEventListener('click',()=>{close();resolve(true)});
      }});
    });
  }
  function confirmPopup({title='Confirmer la suppression', message='Voulez-vous vraiment supprimer cet élément ?', detail='Cette action est définitive et ne peut pas être annulée.', confirmText='Supprimer', cancelText='Annuler'}={}) {
    return new Promise(resolve => {
      let settled=false;
      const finish=(value,close)=>{if(settled)return;settled=true;close();resolve(value)};
      modal({title,variant:'danger',icon:'!',html:`<div class="delete-confirm"><div class="delete-confirm-shield" aria-hidden="true">!</div><div><h3>Suppression définitive</h3><p>${esc(message)}</p>${detail?`<small>${esc(detail)}</small>`:''}</div></div><div class="modal-actions modal-actions-split"><button type="button" class="btn btn-ghost" data-cancel>${esc(cancelText)}</button><button type="button" class="btn btn-danger" data-confirm>${esc(confirmText)}</button></div>`,onReady:(wrap,close)=>{
        wrap.querySelector('[data-cancel]').addEventListener('click',()=>finish(false,close));
        wrap.querySelector('[data-confirm]').addEventListener('click',()=>finish(true,close));
        wrap.querySelector('.close-x').addEventListener('click',()=>{if(!settled){settled=true;resolve(false)}});
        wrap.addEventListener('click',e=>{if(e.target===wrap&&!settled){settled=true;resolve(false)}});
      }});
    });
  }
  async function api(url, options={}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
    if (options.method && options.method !== 'GET' && state.csrf) headers.set('X-CSRF-Token', state.csrf);
    const res = await fetch(url, {...options, headers, credentials:'same-origin'});
    let data = {}; try { data = await res.json(); } catch {}
    if (!res.ok) { const err = new Error(data.error || `Erreur ${res.status}`); err.status=res.status; err.data=data; throw err; }
    return data;
  }
  function scopeForPage() {
    if (page === 'sectors') return 'sectors';
    if (page === 'responsibles') return 'responsibles';
    if (page === 'associations') return 'associations';
    if (page === 'girls') return 'girls';
    if (page === 'boys') return 'boys';
    if (page === 'settings') return 'settings';
    if (page === 'reports') return 'report';
    return 'session';
  }
  async function loadData(force=false, scopeOverride='') {
    const scope = scopeOverride || scopeForPage();
    if (state.loadPromise && !force && state.scope === scope) return state.loadPromise;
    state.scope = scope;
    state.loadPromise = (async () => {
      try {
        const data = await api(`/api/load?scope=${encodeURIComponent(scope)}`);
        state.data = data; state.user = data.user; state.csrf = data.csrf_token || ''; renderHeader(); handleFreePlan(data); return data;
      } catch (e) {
        if (e.status === 401) { state.data=null; state.user=null; state.csrf=''; renderHeader(); if (authRequired) location.href='/connexion.html?next='+encodeURIComponent(location.pathname+location.search); return null; }
        throw e;
      }
    })();
    try { return await state.loadPromise; } finally { state.loadPromise = null; }
  }
  function renderHeader() {
    const header = document.getElementById('siteHeader'); if (!header) return;
    const u = state.user; const access = state.data?.access || {};
    const publicNav = `<a class="nav-link ${page==='home'?'active':''}" href="/index.html">Accueil</a><a class="nav-link ${page==='contact'?'active':''}" href="/contact.html">Contacts</a>`;
    let privateNav = `<a class="nav-link ${page==='home'?'active':''}" href="/index.html">Accueil</a>`;
    if (u?.role === 'superadmin') privateNav += `<a class="nav-link ${page==='sectors'?'active':''}" href="/secteurs.html">Secteur</a><a class="nav-link ${page==='responsibles'?'active':''}" href="/responsables.html">Responsables</a><a class="nav-link ${page==='associations'?'active':''}" href="/associations.html">Associations</a><a class="nav-link ${page==='girls'?'active':''}" href="/jeunes-filles.html">Jeunes filles</a><a class="nav-link ${page==='boys'?'active':''}" href="/jeunes-garcons.html">Jeunes garçons</a><a class="nav-link ${page==='reports'?'active':''}" href="/rapport.html">Rapport</a><a class="nav-link ${page==='superadmin'?'active':''}" href="/superadmin.html">Super Admin</a>`;
    else if (u) {
      if (access.sectors) privateNav += `<a class="nav-link ${page==='sectors'?'active':''}" href="/secteurs.html">Secteur</a>`;
      if (access.responsibles) privateNav += `<a class="nav-link ${page==='responsibles'?'active':''}" href="/responsables.html">Responsables</a>`;
      if (access.associations) privateNav += `<a class="nav-link ${page==='associations'?'active':''}" href="/associations.html">Associations</a>`;
      if (access.girls) privateNav += `<a class="nav-link ${page==='girls'?'active':''}" href="/jeunes-filles.html">Jeunes filles</a>`;
      if (access.boys) privateNav += `<a class="nav-link ${page==='boys'?'active':''}" href="/jeunes-garcons.html">Jeunes garçons</a>`;
      if (access.reports) privateNav += `<a class="nav-link ${page==='reports'?'active':''}" href="/rapport.html">Rapport</a>`;
      privateNav += `<a class="nav-link ${page==='settings'?'active':''}" href="/parametres.html">Paramètre</a>`;
    }
    header.innerHTML = `<div class="header-inner">
      <a class="brand" href="/index.html"><img src="/assets/logo-fondation-ck.png" alt="Logo LA FONDATION CK"><span class="brand-copy"><strong>LA FONDATION CK</strong><small>Charité · Cohésion · Développement</small></span></a>
      <button id="mobileNav" class="mobile-toggle" type="button" aria-label="Menu">☰</button>
      <nav id="mainNav" class="main-nav">${u?privateNav:publicNav}</nav>
      <div class="header-actions">${u ? `<span class="badge badge-green hide-tablet">${esc(u.full_name)}</span><button id="logoutBtn" class="btn btn-ghost"><span class="label">Déconnexion</span> ↗</button>` : `<button id="loginBtn" class="btn btn-ghost"><span class="label">Connexion</span> 🔐</button><a class="btn btn-orange" href="/inscription.html"><span class="label">Créer un compte</span> ＋</a>`}</div>
    </div>`;
    header.querySelector('#mobileNav')?.addEventListener('click', () => header.querySelector('#mainNav')?.classList.toggle('open'));
    header.querySelector('#loginBtn')?.addEventListener('click', showLoginModal);
    header.querySelector('#logoutBtn')?.addEventListener('click', async () => { try { await api('/api/logout',{method:'POST',body:'{}'}); } catch {} location.href='/index.html'; });
  }
  function showLoginModal() {
    modal({title:'Connexion sécurisée', html:`<form id="quickLogin" class="form-grid">
      <div class="field full"><label>Adresse e-mail</label><input class="input" type="email" name="email" autocomplete="username" required></div>
      <div class="field full"><label>Mot de passe</label><input class="input" type="password" name="password" autocomplete="current-password" required></div>
      <div class="field full"><button class="btn btn-primary" type="submit">Se connecter</button></div>
      <div class="field full"><button id="forgotBtn" class="text-link" type="button">Mot de passe oublié ?</button></div>
    </form>`, onReady:(wrap,close)=>{
      wrap.querySelector('#forgotBtn').addEventListener('click', () => { close(); showForgotModal(); });
      wrap.querySelector('#quickLogin').addEventListener('submit', async e => {
        e.preventDefault(); const f=new FormData(e.currentTarget); const btn=e.currentTarget.querySelector('button[type=submit]'); btn.disabled=true;
        try { const r=await api('/api/login',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})}); sessionStorage.setItem('fckJustLoggedIn','1'); close(); location.href = r.user.role==='superadmin' ? '/superadmin.html' : '/index.html'; }
        catch(err){ toast(err.message,'error'); btn.disabled=false; }
      });
    }});
  }
  function showForgotModal() {
    modal({title:'Demande de réinitialisation',html:`<div class="alert alert-info">L’<strong>Administrateur principal</strong> et les <strong>Sous-administrateurs</strong> sont réinitialisés par le <strong>Super Admin</strong>. Les <strong>Visiteurs</strong> et <strong>Agents</strong> sont réinitialisés par l’<strong>Administrateur principal</strong>.</div><form id="forgotForm" class="form-grid"><div class="field full"><label>Adresse e-mail du compte</label><input class="input" type="email" name="email" required></div><div class="field full"><button class="btn btn-primary" type="submit">Envoyer la demande</button></div></form>`,onReady:(wrap,close)=>{
      wrap.querySelector('#forgotForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const r=await api('/api/password-reset-request',{method:'POST',body:JSON.stringify({email:f.get('email')})});toast(r.message);close();}catch(err){toast(err.message,'error');}});
    }});
  }
  function showFreePlanPopup() {
    const d=state.data;if(!d||!state.user||state.user.role==='superadmin'||state.user.access?.account_type!=='principal_admin'||state.user.plan!=='free'||!d.subscription_active)return;
    localStorage.setItem('fckFreeLastPrompt', String(Date.now()));
    modal({title:'Passez à une formule payante',html:`<div style="text-align:center"><img src="/assets/logo-fondation-ck.png" alt="Logo" style="width:95px;height:95px;object-fit:contain"><h3 style="color:var(--green-deep)">Votre plan Free est actif</h3><p>Il vous reste <strong>${Number(d.plan?.days_remaining||0)} jour(s)</strong>. Profitez d’un accès continu en choisissant Standard ou Business.</p><div class="alert alert-warn">Standard : 5 100 F / 30 jours · Business : 45 600 F / 365 jours</div><div class="modal-actions"><button id="understood" class="btn btn-ghost">Compris</button><button id="buyPlan" class="btn btn-orange">Acheter mon plan</button></div></div>`,onReady:(wrap,close)=>{
      wrap.querySelector('#understood').addEventListener('click',close);wrap.querySelector('#buyPlan').addEventListener('click',()=>{close();location.href='/parametres.html#abonnement';});
    }});
  }
  let freeIntervalStarted=false;
  function handleFreePlan(data){
    if(!data?.user||data.user.role==='superadmin'||data.user.access?.account_type!=='principal_admin'||data.user.plan!=='free'||!data.subscription_active)return;
    const justLogged=sessionStorage.getItem('fckJustLoggedIn')==='1';
    const last=Number(localStorage.getItem('fckFreeLastPrompt')||0);
    if(justLogged){sessionStorage.removeItem('fckJustLoggedIn');setTimeout(showFreePlanPopup,250)}
    else if(!last || Date.now()-last>=15*60*1000){setTimeout(showFreePlanPopup,350)}
    if(!freeIntervalStarted){freeIntervalStarted=true;setInterval(()=>{const t=Number(localStorage.getItem('fckFreeLastPrompt')||0);if(!t||Date.now()-t>=15*60*1000)showFreePlanPopup()},60*1000)}
  }
  function guardPage(data, key){ if(!data)return false; if(data.user.role==='superadmin'||data.user.role==='admin')return true; if(!data.access?.[key]){location.href='/index.html';return false;} return true; }
  function subscriptionGate(data, target){
    if(!data||data.user.role==='superadmin'||data.subscription_active)return false;
    const el=typeof target==='string'?document.querySelector(target):target;
    const type=data.user.access?.account_type||'';
    const dependent=['visitor','agent','subadmin'].includes(type);
    if(el)el.innerHTML=dependent
      ? `<div class="glass lock-screen"><h2>Accès suspendu</h2><p>L’abonnement de votre Administrateur principal est expiré ou n’est pas encore actif.</p><a class="btn btn-orange" href="/parametres.html">Mon compte</a></div>`
      : `<div class="glass lock-screen"><h2>Abonnement expiré</h2><p>Votre période d’accès est terminée. Ouvrez Paramètre pour choisir une formule.</p><a class="btn btn-orange" href="/parametres.html#abonnement">Voir les formules</a></div>`;
    return true;
  }
  async function save(action, payload={}){ return api('/api/save',{method:'POST',body:JSON.stringify({action,...payload})}); }
  function initBackgroundSlideshow(){
    if(document.querySelector('.fck-bg-slideshow')) return;
    const images=[
      '/assets/fondation-bg-1.webp',
      '/assets/fondation-bg-2.webp',
      '/assets/fondation-bg-3.webp',
      '/assets/fondation-bg-4.webp',
      '/assets/fondation-bg-5.webp'
    ];
    const layer=document.createElement('div');
    layer.className='fck-bg-slideshow';
    layer.setAttribute('aria-hidden','true');
    layer.innerHTML=images.map((src,i)=>`<img class="fck-bg-slide" src="${src}" alt="" decoding="async" ${i===0?'fetchpriority="high"':'loading="lazy"'}>`).join('');
    document.body.prepend(layer);
  }
  function enhancePasswordFields(root=document){
    const inputs=root.querySelectorAll ? root.querySelectorAll('input[type="password"]') : [];
    inputs.forEach(input=>{
      if(input.dataset.passwordToggleReady==='1' || input.closest('.password-field')) return;
      input.dataset.passwordToggleReady='1';
      const holder=document.createElement('div');
      holder.className='password-field';
      input.parentNode.insertBefore(holder,input);
      holder.appendChild(input);
      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.className='password-toggle';
      toggle.setAttribute('aria-label','Afficher le mot de passe');
      toggle.setAttribute('aria-pressed','false');
      toggle.textContent='Afficher';
      holder.appendChild(toggle);
      toggle.addEventListener('click',()=>{
        const showing=input.type==='text';
        input.type=showing?'password':'text';
        toggle.textContent=showing?'Afficher':'Masquer';
        toggle.setAttribute('aria-label',showing?'Afficher le mot de passe':'Masquer le mot de passe');
        toggle.setAttribute('aria-pressed',showing?'false':'true');
        input.focus({preventScroll:true});
        try{input.setSelectionRange(input.value.length,input.value.length)}catch{}
      });
    });
  }
  function observePasswordFields(){
    enhancePasswordFields(document);
    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        for(const node of mutation.addedNodes){
          if(node.nodeType!==1) continue;
          if(node.matches?.('input[type="password"]')) enhancePasswordFields(node.parentElement||document);
          else enhancePasswordFields(node);
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  function enhanceActionTables(root=document){
    const tables=[];
    if(root?.matches?.('table')) tables.push(root);
    if(root?.querySelectorAll) tables.push(...root.querySelectorAll('table'));
    tables.forEach(table=>{
      const headers=[...table.querySelectorAll('thead th')];
      if(!headers.length) return;
      const indexes=[];
      headers.forEach((th,index)=>{
        const label=(th.textContent||'').trim().toLowerCase();
        if(label==='action'||label==='actions'||label==='traitement') indexes.push(index);
      });
      if(!indexes.length) return;
      table.classList.add('fck-action-table');
      let maxButtons=1;
      indexes.forEach(index=>{
        headers[index]?.classList.add('action-col');
        table.querySelectorAll('tbody tr').forEach(tr=>{
          const cell=tr.children[index];
          if(!cell) return;
          cell.classList.add('action-cell');
          const group=cell.querySelector('.actions');
          if(group) group.classList.add('action-row');
          const count=cell.querySelectorAll('button,.btn').length;
          if(count>maxButtons) maxButtons=count;
        });
      });
      [...table.classList].filter(c=>/^action-count-/.test(c)).forEach(c=>table.classList.remove(c));
      table.classList.add(`action-count-${Math.min(Math.max(maxButtons,1),6)}`);
    });
  }
  function observeActionTables(){
    enhanceActionTables(document);
    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        for(const node of mutation.addedNodes){
          if(node.nodeType!==1) continue;
          enhanceActionTables(node);
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  function printProfessional({title='Document', subtitle='', source=null, orientation='landscape'}={}) {
    if(!source)return;
    const clone=source.cloneNode(true);
    clone.querySelectorAll('button,.no-print,.actions').forEach(el=>el.remove());
    clone.querySelectorAll('table').forEach(table=>{
      const headers=[...table.querySelectorAll('thead th')];
      const actionIndex=headers.findIndex(th=>/^actions?$/i.test((th.textContent||'').trim()));
      if(actionIndex>=0){
        table.querySelectorAll('tr').forEach(tr=>tr.children[actionIndex]?.remove());
      }
    });
    const w=window.open('','_blank','width=1200,height=850');
    if(!w){toast('Autorisez les fenêtres pop-up pour imprimer le PDF.','error');return;}
    const logo=`${location.origin}/assets/logo-fondation-ck.png`;
    const now=new Date();
    const dateLabel=now.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
    const timeLabel=now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    const safeOrientation=orientation==='portrait'?'portrait':'landscape';
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)} — LA FONDATION CK</title><style>
      @page{size:A4 ${safeOrientation};margin:12mm 10mm 16mm}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      html,body{margin:0;padding:0;background:#fff;color:#183128;font-family:Arial,Helvetica,sans-serif}
      body{font-size:10.5px;padding-bottom:18mm}
      .print-head{display:flex;align-items:center;gap:14px;border-bottom:3px solid #f47c20;padding:0 0 9px;margin:0 0 12px}
      .print-head img{width:68px;height:68px;object-fit:contain}
      .identity{flex:1}.identity h1{margin:0;color:#0a6947;font-size:20px;letter-spacing:.2px}.identity .motto{font-size:10px;color:#5a665f;margin-top:3px}
      .doc-title{text-align:right;max-width:48%}.doc-title h2{margin:0 0 4px;font-size:16px;color:#173e32}.doc-title p{margin:0;color:#6b746f;font-size:9.5px;line-height:1.35}
      .print-meta{display:flex;justify-content:space-between;gap:12px;margin:0 0 10px;padding:7px 9px;background:#f4f8f6;border:1px solid #d8e4dd;border-radius:7px;color:#52635b;font-size:9px}
      .print-content{width:100%}.table-wrap{overflow:visible!important}.empty-state{padding:20px;text-align:center}
      .stats{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin:0 0 10px}.stat{border:1px solid #d8e4dd;border-radius:7px;padding:7px;background:#f7faf8;text-align:center}.stat small{display:block;color:#68756f;font-size:7.8px;margin-bottom:2px}.stat strong{font-size:14px;color:#0a6947}
      table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9.5px}
      thead{display:table-header-group}tr{page-break-inside:avoid}th,td{border:1px solid #cbd8d1;padding:6px 5px;vertical-align:middle;text-align:center;overflow-wrap:anywhere;word-break:normal}
      th{background:#0a6947!important;color:#fff!important;font-weight:700;text-transform:uppercase;font-size:8.6px;letter-spacing:.25px}
      tbody tr:nth-child(even) td{background:#f7faf8!important}tbody td:first-child{text-align:left;font-weight:600}
      .badge{display:inline-block;padding:2px 5px;border:1px solid #b7c9bf;border-radius:999px;font-size:8px;background:#eef6f1;color:#0a6947}.hint{font-size:8.5px;color:#6c756f}
      .row-selected td{background:#eef8f3!important}
      .print-foot{position:fixed;left:0;right:0;bottom:-9mm;border-top:1px solid #d8e4dd;padding-top:5px;display:flex;justify-content:space-between;gap:12px;color:#65736c;font-size:8px;background:#fff}
      a{color:inherit;text-decoration:none}h3{margin:0 0 8px;color:#173e32}
    </style></head><body><header class="print-head"><img src="${logo}" alt="Logo"><div class="identity"><h1>LA FONDATION CK</h1><div class="motto">Charité · Cohésion · Développement</div></div><div class="doc-title"><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></header><div class="print-meta"><span>Document édité le ${dateLabel} à ${timeLabel}</span><span>Côte d’Ivoire</span></div><main class="print-content">${clone.outerHTML}</main><footer class="print-foot"><span>${FOUNDATION_PHONE} · ${FOUNDATION_EMAIL}</span><span>LA FONDATION CK</span></footer></body></html>`);
    w.document.close();
    let printed=false;
    const run=()=>{if(printed)return;printed=true;w.focus();w.print();};
    const imgs=[...w.document.images];
    if(!imgs.length||imgs.every(i=>i.complete))setTimeout(run,250);
    else{let left=imgs.length;imgs.forEach(img=>{const done=()=>{left--;if(left<=0)setTimeout(run,150)};img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true})});setTimeout(run,1200)}
  }

  function footer(){
    const el=document.getElementById('siteFooter'); if(!el)return;
    el.innerHTML=`<div class="footer"><div class="footer-inner"><div><strong>LA FONDATION CK</strong><br><small>Charité · Cohésion · Développement</small></div><div class="footer-contact"><a href="tel:+2250757577542">${FOUNDATION_PHONE}</a><a href="mailto:${FOUNDATION_EMAIL}">${FOUNDATION_EMAIL}</a></div><div class="footer-copyright">©2026 Méga Services SARL U - Tous droits réservés</div></div></div>`;
  }

  window.FCK = { state, api, loadData, save, modal, toast, infoPopup, confirmPopup, esc, fmtDate, money, roleLabel, showLoginModal, showForgotModal, guardPage, subscriptionGate, printProfessional };
  document.addEventListener('DOMContentLoaded', async () => {
    initBackgroundSlideshow();
    renderHeader(); footer();
    observePasswordFields();
    observeActionTables();
    try { await loadData(); } catch (e) { console.error(e); if(authRequired) toast(e.message || 'Erreur de chargement','error'); }
    document.dispatchEvent(new CustomEvent('fck:ready',{detail:state.data}));
  });
})();
