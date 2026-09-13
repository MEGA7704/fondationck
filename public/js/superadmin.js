(()=>{
  let d=null, filtered=[];

  async function load(){
    try{
      const me=FCK.state.user;
      if(!me||me.role!=='superadmin'){location.href='/index.html';return}
      d=await FCK.api('/api/superadmin');
      render();
    }catch(e){
      if(e.status===403)location.href='/index.html';else FCK.toast(e.message,'error');
    }
  }

  function render(){
    renderStats();applyFilter();renderResets();renderAudit();
    const search=document.getElementById('superSearch');
    if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('input',applyFilter)}
  }

  function renderStats(){
    const users=d?.users||[];
    const active=users.filter(u=>u.status==='active').length;
    const principals=users.filter(u=>u.access?.account_type==='principal_admin').length;
    const visitors=users.filter(u=>u.access?.account_type==='visitor').length;
    const agents=users.filter(u=>u.access?.account_type==='agent').length;
    document.getElementById('superStats').innerHTML=`
      <div class="stat"><small>Comptes actifs</small><strong>${active}</strong></div>
      <div class="stat"><small>Administrateur principal</small><strong>${principals}/1</strong></div>
      <div class="stat"><small>Visiteurs</small><strong>${visitors}</strong></div>
      <div class="stat"><small>Agents</small><strong>${agents}</strong></div>`;
  }

  function applyFilter(){
    const q=(document.getElementById('superSearch')?.value||'').toLowerCase().trim();
    const src=d?.users||[];
    filtered=q?src.filter(u=>[u.full_name,u.email,u.role,FCK.roleLabel(u),u.plan,u.status].some(v=>String(v||'').toLowerCase().includes(q))):src;
    renderUsers();
  }

  function renderUsers(){
    const el=document.getElementById('superUsers');
    const all=d?.users||[];
    const principal=all.find(x=>x.access?.account_type==='principal_admin')||null;
    el.innerHTML=`<table><thead><tr><th>Nom</th><th>E-mail</th><th>Rôle / statut</th><th>État</th><th>Plan effectif</th><th>Expiration</th><th>Actions</th></tr></thead><tbody>${filtered.map(u=>{
      const type=u.role==='superadmin'?'superadmin':(u.access?.account_type||'visitor');
      const owner=(type==='visitor'||type==='agent'||type==='subadmin')?principal:u;
      const plan=owner?.plan||'—', expiry=owner?.plan_expires_at||'';
      const planText=(type==='visitor'||type==='agent'||type==='subadmin')?(principal?`${plan} · lié au principal`:'En attente du principal'):plan;
      const planBtn=type==='principal_admin'?`<button class="btn btn-sm btn-outline" data-plan="${u.id}">Plan</button>`:'';
      return `<tr><td>${FCK.esc(u.full_name)}</td><td>${FCK.esc(u.email)}</td><td><span class="badge badge-blue">${FCK.esc(FCK.roleLabel(u))}</span></td><td><span class="badge ${u.status==='active'?'badge-green':'badge-red'}">${FCK.esc(u.status)}</span></td><td><span class="badge ${plan==='free'?'badge-orange':'badge-green'}">${FCK.esc(planText)}</span></td><td>${FCK.fmtDate(expiry)}</td><td>${u.role==='superadmin'?'<span class="hint">Compte protégé</span>':`<div class="actions"><button class="btn btn-sm btn-orange" data-type="${u.id}">Rôle</button><button class="btn btn-sm btn-ghost" data-status="${u.id}">${u.status==='active'?'Désactiver':'Activer'}</button>${planBtn}<button class="btn btn-sm btn-outline" data-reset="${u.id}">Réinit. MDP</button>${u.access?.account_type==='agent'?`<button class="btn btn-sm btn-ghost" data-access="${u.id}">Accès</button>`:''}<button class="btn btn-sm btn-danger" data-delete="${u.id}">Supprimer</button></div>`}</td></tr>`
    }).join('')||'<tr><td colspan="7">Aucun compte.</td></tr>'}</tbody></table>`;

    el.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>openType(filtered.find(x=>x.id===b.dataset.type))));
    el.querySelectorAll('[data-status]').forEach(b=>b.addEventListener('click',()=>{const u=filtered.find(x=>x.id===b.dataset.status);post('set-status',{id:u.id,status:u.status==='active'?'disabled':'active'},'Statut mis à jour.')}));
    el.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>openPlan(filtered.find(x=>x.id===b.dataset.plan))));
    el.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click',()=>openReset(filtered.find(x=>x.id===b.dataset.reset))));
    el.querySelectorAll('[data-access]').forEach(b=>b.addEventListener('click',()=>openAccess(filtered.find(x=>x.id===b.dataset.access))));
    el.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{const u=filtered.find(x=>x.id===b.dataset.delete);if(confirm(`Supprimer définitivement le compte de ${u.full_name} ?`))post('delete-user',{id:u.id},'Compte supprimé.')}));
  }

  async function post(action,payload,msg){
    try{const r=await FCK.api('/api/superadmin',{method:'POST',body:JSON.stringify({action,...payload})});FCK.toast(r.message||msg||'Opération effectuée.');await load()}
    catch(e){FCK.toast(e.message,'error')}
  }

  function openType(u){
    const current=u.access?.account_type||'visitor';
    FCK.modal({title:`Rôle — ${u.full_name}`,html:`<form id="superType" class="form-grid"><div class="field full"><label>Rôle / statut</label><select class="select" name="user_type"><option value="visitor" ${current==='visitor'?'selected':''}>Visiteur — consultation uniquement</option><option value="agent" ${current==='agent'?'selected':''}>Agent — accès contrôlé</option><option value="subadmin" ${current==='subadmin'?'selected':''}>Sous-administrateur — accès complet</option><option value="principal_admin" ${current==='principal_admin'?'selected':''}>Administrateur principal — unique</option></select></div><div class="alert alert-warn field full"><strong>Règle :</strong> un seul Administrateur principal peut être actif. Une deuxième activation sera refusée par le serveur.</div><div class="field full"><button class="btn btn-primary" type="submit">Appliquer ce rôle</button></div></form>`,onReady:(wrap,close)=>{
      wrap.querySelector('#superType').addEventListener('submit',async e=>{
        e.preventDefault();const user_type=new FormData(e.currentTarget).get('user_type');
        try{const r=await FCK.api('/api/superadmin',{method:'POST',body:JSON.stringify({action:'set-account-type',id:u.id,user_type})});FCK.toast(r.message||'Rôle mis à jour.');close();await load()}
        catch(err){FCK.toast(err.message,'error')}
      })
    }})
  }

  function openPlan(u){
    FCK.modal({title:`Abonnement — ${u.full_name}`,html:`<form id="planForm" class="form-grid"><div class="field full"><label>Plan à activer</label><select class="select" name="plan"><option value="free" ${u.plan==='free'?'selected':''}>Free — 10 jours</option><option value="standard" ${u.plan==='standard'?'selected':''}>Standard — 30 jours — 5 100 F</option><option value="business" ${u.plan==='business'?'selected':''}>Business — 365 jours — 45 600 F</option></select></div><div class="alert alert-warn field full">L’activation démarre à la date de validation et remplace la date d’expiration actuelle.</div><div class="field full"><button class="btn btn-primary" type="submit">Activer ce plan</button></div></form>`,onReady:(wrap,close)=>wrap.querySelector('#planForm').addEventListener('submit',async e=>{e.preventDefault();const plan=new FormData(e.currentTarget).get('plan');try{const r=await FCK.api('/api/superadmin',{method:'POST',body:JSON.stringify({action:'set-plan',id:u.id,plan})});FCK.toast(r.message);close();await load()}catch(err){FCK.toast(err.message,'error')}})})
  }

  function openReset(u,requestId=''){
    FCK.modal({title:`Réinitialiser — ${u?.full_name||u?.email||'Compte'}`,html:`<form id="superReset" class="form-grid"><div class="field full"><label>Nouveau mot de passe temporaire</label><input class="input" type="password" name="password" minlength="8" required></div><div class="alert alert-warn field full">Toutes les sessions existantes de ce compte seront invalidées.</div><div class="field full"><button class="btn btn-danger" type="submit">Réinitialiser le mot de passe</button></div></form>`,onReady:(wrap,close)=>wrap.querySelector('#superReset').addEventListener('submit',async e=>{e.preventDefault();const password=new FormData(e.currentTarget).get('password');try{const r=await FCK.api('/api/superadmin',{method:'POST',body:JSON.stringify(requestId?{action:'resolve-reset',request_id:requestId,password}:{action:'reset-password',id:u.id,password})});FCK.toast(r.message||'Mot de passe réinitialisé.');close();await load()}catch(err){FCK.toast(err.message,'error')}})})
  }

  function accessChecks(a={}){return `<div class="checkboxes"><label class="check"><input type="checkbox" name="sectors" ${a.sectors!==false?'checked':''}> Secteur</label><label class="check"><input type="checkbox" name="responsibles" ${a.responsibles!==false?'checked':''}> Responsables</label><label class="check"><input type="checkbox" name="associations" ${a.associations!==false?'checked':''}> Associations</label><label class="check"><input type="checkbox" name="girls" ${a.girls!==false?'checked':''}> Jeunes filles</label><label class="check"><input type="checkbox" name="boys" ${a.boys!==false?'checked':''}> Jeunes garçons</label><label class="check"><input type="checkbox" name="reports" ${a.reports!==false?'checked':''}> Rapport</label><label class="check"><input type="checkbox" name="can_add" ${a.can_add!==false?'checked':''}> Ajouter</label><label class="check"><input type="checkbox" name="can_print" ${a.can_print!==false?'checked':''}> Imprimer</label></div>`}

  function openAccess(u){
    FCK.modal({title:`Accès — ${u.full_name}`,html:`<form id="superAccess" class="form-grid"><div class="field full">${accessChecks(u.access)}</div><div class="field full"><button class="btn btn-primary">Enregistrer</button></div></form>`,onReady:(wrap,close)=>wrap.querySelector('#superAccess').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,access={home:true,settings:true,sectors:f.elements.sectors.checked,responsibles:f.elements.responsibles.checked,associations:f.elements.associations.checked,girls:f.elements.girls.checked,boys:f.elements.boys.checked,reports:f.elements.reports.checked,can_add:f.elements.can_add.checked,can_print:f.elements.can_print.checked,account_type:'agent'};try{await FCK.api('/api/superadmin',{method:'POST',body:JSON.stringify({action:'update-access',id:u.id,access})});FCK.toast('Accès mis à jour.');close();await load()}catch(err){FCK.toast(err.message,'error')}})})
  }

  function renderResets(){
    const list=d?.reset_requests||[];
    document.getElementById('superResets').innerHTML=`<table><thead><tr><th>Date</th><th>Nom</th><th>E-mail</th><th>Type</th><th>Traitement</th></tr></thead><tbody>${list.map(r=>`<tr><td>${FCK.fmtDate(r.requested_at)}</td><td>${FCK.esc(r.full_name||'—')}</td><td>${FCK.esc(r.email)}</td><td><span class="badge badge-blue">${FCK.esc(r.target_role)}</span></td><td>${r.target_role==='admin'?`<button class="btn btn-sm btn-danger" data-rid="${r.id}">Réinitialiser</button>`:'<span class="hint">À traiter par l’Administrateur principal</span>'}</td></tr>`).join('')||'<tr><td colspan="5">Aucune demande en attente.</td></tr>'}</tbody></table>`;
    document.querySelectorAll('[data-rid]').forEach(b=>b.addEventListener('click',()=>{const r=list.find(x=>x.id===b.dataset.rid);openReset(r,r.id)}))
  }

  function renderAudit(){
    const list=d?.audit||[];
    document.getElementById('auditTable').innerHTML=`<table><thead><tr><th>Date</th><th>Rôle</th><th>Action</th><th>Cible</th><th>IP</th></tr></thead><tbody>${list.map(a=>`<tr><td>${FCK.fmtDate(a.created_at)}</td><td>${FCK.esc(a.actor_role||'—')}</td><td>${FCK.esc(a.action)}</td><td>${FCK.esc(a.target_type||'—')} ${FCK.esc(a.target_id||'')}</td><td>${FCK.esc(a.ip_address||'—')}</td></tr>`).join('')||'<tr><td colspan="5">Journal vide.</td></tr>'}</tbody></table>`
  }

  document.addEventListener('fck:ready',e=>{if(e.detail)load()});
})();
