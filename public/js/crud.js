(()=>{
  const key=document.body.dataset.page;
  const configs={
    sectors:{dataKey:'sectors',title:'secteur',plural:'Liste des secteurs',addLabel:'Ajouter un secteur',access:'sectors',columns:[['name','Secteur'],['locality','Localité'],['description','Description']]},
    responsibles:{dataKey:'responsibles',title:'responsable',plural:'Liste des responsables de secteur',addLabel:'Ajouter un responsable',access:'responsibles',columns:[['full_name','Nom complet'],['sector_name','Secteur'],['function_title','Fonction'],['phone','Téléphone'],['email','E-mail'],['locality','Localité']]},
    girls:{dataKey:'girls',title:'jeune fille',plural:'Liste des jeunes filles',addLabel:'Ajouter une jeune fille',access:'girls',columns:[['full_name','Nom complet'],['sector_name','Secteur'],['birth_date','Date de naissance'],['phone','Téléphone'],['locality','Localité'],['occupation','Activité / Études'],['status_label','Statut']]},
    boys:{dataKey:'boys',title:'jeune garçon',plural:'Liste des jeunes garçons',addLabel:'Ajouter un jeune garçon',access:'boys',columns:[['full_name','Nom complet'],['sector_name','Secteur'],['birth_date','Date de naissance'],['phone','Téléphone'],['locality','Localité'],['occupation','Activité / Études'],['status_label','Statut']]}
  };
  const cfg=configs[key]; let data=null, filtered=[];
  const isAdmin=()=>data&&['admin','superadmin'].includes(data.user.role);
  const isAgent=()=>data?.user?.role==='member';
  const canAdd=()=>isAdmin() || (isAgent()&&data.access?.can_add!==false);
  const canPrint=()=>isAdmin() || (isAgent()&&data.access?.can_print!==false);
  const canEditWithApproval=()=>isAdmin() || isAgent();
  function actionNames(){return key==='sectors'?['add-sector','update-sector','delete-sector']:key==='responsibles'?['add-responsible','update-responsible','delete-responsible']:key==='girls'?['add-girl','update-girl','delete-girl']:['add-boy','update-boy','delete-boy']}
  function render(){
    if(!cfg||!data)return;if(!FCK.guardPage(data,cfg.access))return;if(FCK.subscriptionGate(data,'#protectedMain'))return;
    const action=document.getElementById('pageAction');
    action.innerHTML=`<div class="page-actions">${canPrint()?`<button id="printBtn" class="btn btn-outline">🖨 Imprimer la liste</button>`:''}${canAdd()?`<button id="addBtn" class="btn btn-orange">＋ ${cfg.addLabel}</button>`:''}</div>`;
    action.querySelector('#addBtn')?.addEventListener('click',()=>openForm());
    action.querySelector('#printBtn')?.addEventListener('click',printList);
    applyFilter();
    const search=document.getElementById('tableSearch'); if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('input',applyFilter)}
  }
  function applyFilter(){const q=(document.getElementById('tableSearch')?.value||'').toLowerCase().trim();const src=data[cfg.dataKey]||[];filtered=q?src.filter(r=>Object.values(r).some(v=>String(v??'').toLowerCase().includes(q))):src;renderTable()}
  function renderTable(){
    document.getElementById('tableCount').textContent=`${filtered.length} élément${filtered.length>1?'s':''}`;
    if(!filtered.length){document.getElementById('tableArea').innerHTML='<div class="empty-state">Aucun élément enregistré.</div>';return;}
    let html='<table id="printableTable"><thead><tr>'+cfg.columns.map(c=>`<th>${c[1]}</th>`).join('')+(canEditWithApproval()?'<th class="no-print">Actions</th>':'')+'</tr></thead><tbody>';
    html+=filtered.map(r=>`<tr>${cfg.columns.map(([k])=>`<td>${k==='birth_date'?FCK.fmtDate(r[k]):FCK.esc(r[k]||'—')}</td>`).join('')}${canEditWithApproval()?`<td class="no-print"><div class="actions"><button class="btn btn-sm btn-ghost" data-edit="${r.id}">Modifier</button><button class="btn btn-sm btn-danger" data-delete="${r.id}">Supprimer</button></div></td>`:''}</tr>`).join('');
    html+='</tbody></table>';const area=document.getElementById('tableArea');area.innerHTML=html;
    area.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openForm(filtered.find(x=>x.id===b.dataset.edit))));
    area.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>remove(b.dataset.delete)));
  }
  function printList(){
    const oldTitle=document.title; document.title=`${cfg.plural} — LA FONDATION CK`;
    document.body.classList.add('printing-list');
    const cleanup=()=>{document.body.classList.remove('printing-list');document.title=oldTitle;window.removeEventListener('afterprint',cleanup)};
    window.addEventListener('afterprint',cleanup); window.print(); setTimeout(cleanup,1500);
  }
  function sectorOptions(selected=''){return `<option value="">— Aucun / non précisé —</option>`+(data.sectors||[]).map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${FCK.esc(s.name)}</option>`).join('')}
  function openForm(row={}){
    const editing=!!row.id;let fields='';
    if(key==='sectors')fields=`<div class="field"><label>Nom du secteur *</label><input class="input" name="name" value="${FCK.esc(row.name||'')}" required></div><div class="field"><label>Localité</label><input class="input" name="locality" value="${FCK.esc(row.locality||'')}"></div><div class="field full"><label>Description</label><textarea class="textarea" name="description">${FCK.esc(row.description||'')}</textarea></div>`;
    if(key==='responsibles')fields=`<div class="field"><label>Nom complet *</label><input class="input" name="full_name" value="${FCK.esc(row.full_name||'')}" required></div><div class="field"><label>Secteur</label><select class="select" name="sector_id">${sectorOptions(row.sector_id)}</select></div><div class="field"><label>Fonction</label><input class="input" name="function_title" value="${FCK.esc(row.function_title||'Responsable de secteur')}"></div><div class="field"><label>Téléphone</label><input class="input" name="phone" value="${FCK.esc(row.phone||'')}"></div><div class="field"><label>E-mail</label><input class="input" type="email" name="email" value="${FCK.esc(row.email||'')}"></div><div class="field"><label>Localité</label><input class="input" name="locality" value="${FCK.esc(row.locality||'')}"></div>`;
    if(key==='girls'||key==='boys')fields=`<div class="field"><label>Nom complet *</label><input class="input" name="full_name" value="${FCK.esc(row.full_name||'')}" required></div><div class="field"><label>Secteur</label><select class="select" name="sector_id">${sectorOptions(row.sector_id)}</select></div><div class="field"><label>Date de naissance</label><input class="input" type="date" name="birth_date" value="${FCK.esc(row.birth_date||'')}"></div><div class="field"><label>Téléphone</label><input class="input" name="phone" value="${FCK.esc(row.phone||'')}"></div><div class="field"><label>Localité</label><input class="input" name="locality" value="${FCK.esc(row.locality||'')}"></div><div class="field"><label>Activité / Études</label><input class="input" name="occupation" value="${FCK.esc(row.occupation||'')}"></div><div class="field full"><label>Statut</label><input class="input" name="status_label" value="${FCK.esc(row.status_label||'Actif')}"></div>`;
    const approval=(editing&&isAgent())?`<div class="field full admin-approval"><label>Mot de passe d’un Administrateur *</label><input class="input" type="password" name="admin_password" autocomplete="off" required><span class="hint">Un Agent ne peut modifier une ligne qu’après validation par le mot de passe d’un Administrateur.</span></div>`:'';
    FCK.modal({title:`${editing?'Modifier':'Ajouter'} ${cfg.title}`,html:`<form id="entityForm" class="form-grid">${fields}${approval}<div class="field full"><div class="modal-actions"><button type="submit" class="btn btn-primary">Enregistrer</button></div></div></form>`,onReady:(wrap,close)=>{wrap.querySelector('#entityForm').addEventListener('submit',async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget));if(editing)obj.id=row.id;const [add,update]=actionNames();try{await FCK.save(editing?update:add,obj);FCK.toast('Enregistrement effectué.');close();data=await FCK.loadData(true);render();}catch(err){FCK.toast(err.message,'error')}})}})
  }
  async function remove(id){
    const del=actionNames()[2];
    if(isAdmin()){
      if(!confirm('Confirmer la suppression de cet élément ?'))return;
      try{await FCK.save(del,{id});FCK.toast('Élément supprimé.');data=await FCK.loadData(true);render()}catch(err){FCK.toast(err.message,'error')}return;
    }
    FCK.modal({title:'Autorisation Administrateur requise',html:`<div class="alert alert-warn">La suppression par un Agent nécessite le mot de passe d’un Administrateur.</div><form id="deleteApproval" class="form-grid"><div class="field full"><label>Mot de passe Administrateur *</label><input class="input" type="password" name="admin_password" autocomplete="off" required></div><div class="field full"><div class="modal-actions"><button class="btn btn-danger" type="submit">Autoriser et supprimer</button></div></div></form>`,onReady:(wrap,close)=>wrap.querySelector('#deleteApproval').addEventListener('submit',async e=>{e.preventDefault();const admin_password=new FormData(e.currentTarget).get('admin_password');try{await FCK.save(del,{id,admin_password});FCK.toast('Élément supprimé.');close();data=await FCK.loadData(true);render()}catch(err){FCK.toast(err.message,'error')}})});
  }
  document.addEventListener('fck:ready',e=>{data=e.detail;if(data)render()});
})();
