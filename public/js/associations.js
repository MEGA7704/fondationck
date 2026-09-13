(()=>{
  let data=null, selectedId='';
  const isAdmin=()=>data&&['admin','superadmin'].includes(data.user.role);
  const isAgent=()=>data?.user?.role==='member'&&data.user.access?.account_type==='agent';
  const isVisitor=()=>data?.user?.role==='member'&&data.user.access?.account_type==='visitor';
  const canAdd=()=>isAdmin()||(isAgent()&&data.access?.can_add!==false);
  const canPrint=()=>isAdmin()||data?.access?.can_print!==false;
  const esc=FCK.esc;
  const clean=v=>String(v||'').trim();

  function associationRows(){return data?.associations||[]}
  function selected(){return associationRows().find(a=>a.id===selectedId)||null}
  function sectors(){return data?.sectors||[]}
  function sectorOptions(id=''){return `<option value="">— Aucun secteur —</option>`+sectors().map(s=>`<option value="${esc(s.id)}" ${s.id===id?'selected':''}>${esc([s.name,s.locality,s.village].filter(Boolean).join(' · '))}</option>`).join('')}
  function associationOptions(id=''){return associationRows().map(a=>`<option value="${esc(a.id)}" ${a.id===id?'selected':''}>${esc(a.name)}</option>`).join('')}
  function approvalField(editing){return editing&&isAgent()?`<div class="field full admin-approval"><label>Mot de passe d’un Administrateur *</label><input class="input" type="password" name="admin_password" autocomplete="off" required><span class="hint">La modification par un Agent exige l’autorisation d’un Administrateur.</span></div>`:''}

  function render(){
    if(!data)return;
    if(!FCK.guardPage(data,'associations'))return;
    if(FCK.subscriptionGate(data,'#protectedMain'))return;
    if(!selectedId||!associationRows().some(a=>a.id===selectedId))selectedId=associationRows()[0]?.id||'';
    document.getElementById('associationPageActions').innerHTML=`${canPrint()?'<button id="printAssociations" class="btn btn-outline">🖨 Imprimer PDF</button>':''}${canAdd()?'<button id="addAssociation" class="btn btn-orange">＋ Ajouter association</button>':''}`;
    document.getElementById('addAssociation')?.addEventListener('click',()=>openAssociationForm());
    document.getElementById('printAssociations')?.addEventListener('click',()=>printSection('associationTable','Liste des associations',`${associationRows().length} association(s) enregistrée(s)`));
    renderAssociations();renderDetail();
  }

  function renderAssociations(){
    const q=clean(document.getElementById('associationSearch')?.value).toLowerCase();
    const rows=associationRows().filter(a=>!q||[a.name,a.acronym,a.responsible_name,a.activity_area,a.sector_name,a.locality,a.phone,a.email].some(v=>String(v||'').toLowerCase().includes(q)));
    document.getElementById('associationCount').textContent=`${rows.length} association${rows.length>1?'s':''}`;
    document.getElementById('associationTable').innerHTML=`<table><thead><tr><th>Association</th><th>Responsable</th><th>Domaine</th><th>Secteur</th><th>Localité</th><th>Contact</th><th>Actions</th></tr></thead><tbody>${rows.map(a=>`<tr class="${a.id===selectedId?'row-selected':''}"><td><strong>${esc(a.name)}</strong>${a.acronym?`<br><span class="hint">${esc(a.acronym)}</span>`:''}</td><td><strong>${esc(a.responsible_name||'—')}</strong></td><td>${esc(a.activity_area||'—')}</td><td>${esc(a.sector_name||'—')}</td><td>${esc(a.locality||'—')}</td><td>${esc(a.phone||a.email||'—')}</td><td><div class="actions"><button class="btn btn-sm btn-primary" data-select="${a.id}">Membres</button>${!isVisitor()?`<button class="btn btn-sm btn-ghost" data-edit="${a.id}">Modifier</button><button class="btn btn-sm btn-danger" data-delete="${a.id}">Supprimer</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="7">Aucune association enregistrée.</td></tr>'}</tbody></table>`;
    document.querySelectorAll('[data-select]').forEach(b=>b.addEventListener('click',()=>{selectedId=b.dataset.select;renderAssociations();renderDetail();document.getElementById('associationDetail')?.scrollIntoView({behavior:'smooth',block:'start'})}));
    document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openAssociationForm(associationRows().find(a=>a.id===b.dataset.edit))));
    document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>remove('delete-association',b.dataset.delete,'association')));
  }

  function renderDetail(){
    const a=selected(), detail=document.getElementById('associationDetail');
    if(!a){detail.style.display='none';return}
    detail.style.display='block';
    document.getElementById('selectedAssociationName').textContent=a.name;
    document.getElementById('selectedAssociationMeta').textContent=[a.responsible_name?`Responsable : ${a.responsible_name}`:'',a.activity_area,a.locality,a.village].filter(Boolean).join(' · ');
    document.getElementById('memberActions').innerHTML=`${canPrint()?'<button id="printMembers" class="btn btn-sm btn-outline">🖨 Imprimer PDF</button>':''}${canAdd()?'<button id="addMember" class="btn btn-sm btn-orange">＋ Membre</button>':''}`;
    document.getElementById('addMember')?.addEventListener('click',()=>openMemberForm({association_id:a.id}));
    document.getElementById('printMembers')?.addEventListener('click',()=>printSection('memberTable',`Liste des membres — ${a.name}`,`Responsable : ${a.responsible_name||'—'} · ${[a.locality,a.village].filter(Boolean).join(' · ')}`));
    renderMembers();
  }

  function renderMembers(){
    const rows=(data.association_members||[])
      .filter(m=>m.association_id===selectedId)
      .sort((a,b)=>Number(b.is_primary_responsible||0)-Number(a.is_primary_responsible||0)||String(a.full_name||'').localeCompare(String(b.full_name||''),'fr'));
    document.getElementById('memberTable').innerHTML=`<table><thead><tr><th>Nom</th><th>Sexe</th><th>Contact</th><th>Village</th><th>Activité</th><th>Actions</th></tr></thead><tbody>${rows.map(m=>`<tr class="${Number(m.is_primary_responsible||0)===1?'row-selected':''}"><td><strong>${esc(m.full_name)}</strong>${Number(m.is_primary_responsible||0)===1?'<br><span class="badge badge-green">Responsable principal</span>':''}</td><td>${esc(m.gender||'—')}</td><td>${esc(m.phone||m.email||'—')}</td><td>${esc(m.village||'—')}</td><td>${esc(m.occupation||'—')}</td><td>${Number(m.is_primary_responsible||0)===1?'<span class="hint">Lié à l’association</span>':isVisitor()?'—':`<div class="actions"><button class="btn btn-sm btn-ghost" data-edit-member="${m.id}">Modifier</button><button class="btn btn-sm btn-danger" data-delete-member="${m.id}">Supprimer</button></div>`}</td></tr>`).join('')||'<tr><td colspan="6">Aucun membre enregistré.</td></tr>'}</tbody></table>`;
    document.querySelectorAll('[data-edit-member]').forEach(b=>b.addEventListener('click',()=>openMemberForm(rows.find(m=>m.id===b.dataset.editMember))));
    document.querySelectorAll('[data-delete-member]').forEach(b=>b.addEventListener('click',()=>remove('delete-association-member',b.dataset.deleteMember,'membre')));
  }

  function openAssociationForm(row={}){
    const editing=!!row.id;
    FCK.modal({title:`${editing?'Modifier':'Ajouter'} une association`,large:true,html:`<form id="associationForm" class="form-grid"><div class="field"><label>Nom de l’association *</label><input class="input" name="name" value="${esc(row.name||'')}" required></div><div class="field"><label>Nom du responsable *</label><input class="input" name="responsible_name" value="${esc(row.responsible_name||'')}" required></div><div class="field"><label>Sigle / acronyme</label><input class="input" name="acronym" value="${esc(row.acronym||'')}"></div><div class="field"><label>Domaine / objet</label><input class="input" name="activity_area" value="${esc(row.activity_area||'')}"></div><div class="field"><label>Date de création</label><input class="input" type="date" name="creation_date" value="${esc(row.creation_date||'')}"></div><div class="field"><label>N° récépissé / enregistrement</label><input class="input" name="registration_number" value="${esc(row.registration_number||'')}"></div><div class="field"><label>Siège</label><input class="input" name="headquarters" value="${esc(row.headquarters||'')}"></div><div class="field"><label>Secteur d’implantation</label><select class="select" id="assocSector" name="sector_id">${sectorOptions(row.sector_id||'')}</select></div><div class="field"><label>Localité</label><input class="input" id="assocLocality" name="locality" value="${esc(row.locality||'')}"></div><div class="field"><label>Village</label><input class="input" id="assocVillage" name="village" value="${esc(row.village||'')}"></div><div class="field"><label>Téléphone</label><input class="input" name="phone" value="${esc(row.phone||'')}"></div><div class="field"><label>E-mail</label><input class="input" type="email" name="email" value="${esc(row.email||'')}"></div><div class="field"><label>Statut</label><input class="input" name="status_label" value="${esc(row.status_label||'Active')}"></div><div class="field full"><label>Description / objectifs</label><textarea class="textarea" name="description">${esc(row.description||'')}</textarea></div>${approvalField(editing)}<div class="field full"><button class="btn btn-primary" type="submit">Enregistrer</button></div></form>`,onReady:(wrap,close)=>{
      const sector=wrap.querySelector('#assocSector'),loc=wrap.querySelector('#assocLocality'),vil=wrap.querySelector('#assocVillage');
      sector.addEventListener('change',()=>{const s=sectors().find(x=>x.id===sector.value);if(s){loc.value=s.locality||'';vil.value=s.village||''}});
      wrap.querySelector('#associationForm').addEventListener('submit',async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget));if(editing)obj.id=row.id;try{const r=await FCK.save(editing?'update-association':'add-association',obj);selectedId=editing?row.id:(r.target_id||selectedId);FCK.toast('Association enregistrée.');close();await refresh();render()}catch(err){FCK.toast(err.message,'error')}})
    }})
  }

  function openMemberForm(row={}){
    const editing=!!row.id,a=selected();
    FCK.modal({title:`${editing?'Modifier':'Ajouter'} un membre`,html:`<form id="memberForm" class="form-grid"><div class="field full"><label>Association *</label><select class="select" name="association_id" required>${associationOptions(row.association_id||a?.id||'')}</select></div><div class="field"><label>Nom complet *</label><input class="input" name="full_name" value="${esc(row.full_name||'')}" required></div><div class="field"><label>Sexe</label><select class="select" name="gender"><option value="">—</option><option value="Féminin" ${row.gender==='Féminin'?'selected':''}>Féminin</option><option value="Masculin" ${row.gender==='Masculin'?'selected':''}>Masculin</option></select></div><div class="field"><label>Téléphone</label><input class="input" name="phone" value="${esc(row.phone||'')}"></div><div class="field"><label>E-mail</label><input class="input" type="email" name="email" value="${esc(row.email||'')}"></div><div class="field"><label>Localité</label><input class="input" name="locality" value="${esc(row.locality||a?.locality||'')}"></div><div class="field"><label>Village</label><input class="input" name="village" value="${esc(row.village||a?.village||'')}"></div><div class="field"><label>Activité / profession</label><input class="input" name="occupation" value="${esc(row.occupation||'')}"></div><div class="field"><label>Date d’adhésion</label><input class="input" type="date" name="joined_at" value="${esc(row.joined_at||'')}"></div><div class="field full"><label>Statut</label><input class="input" name="status_label" value="${esc(row.status_label||'Actif')}"></div>${approvalField(editing)}<div class="field full"><button class="btn btn-primary" type="submit">Enregistrer</button></div></form>`,onReady:(wrap,close)=>wrap.querySelector('#memberForm').addEventListener('submit',async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget));if(editing)obj.id=row.id;try{await FCK.save(editing?'update-association-member':'add-association-member',obj);selectedId=obj.association_id;FCK.toast('Membre enregistré.');close();await refresh();render()}catch(err){FCK.toast(err.message,'error')}})})
  }

  function remove(action,id,label){
    if(isAdmin()){
      if(!confirm(`Confirmer la suppression de cet élément (${label}) ?`))return;
      FCK.save(action,{id}).then(async()=>{FCK.toast('Suppression effectuée.');await refresh();render()}).catch(err=>FCK.toast(err.message,'error'));return;
    }
    FCK.modal({title:'Autorisation Administrateur requise',html:`<div class="alert alert-warn">La suppression par un Agent nécessite le mot de passe d’un Administrateur.</div><form id="assocDeleteApproval" class="form-grid"><div class="field full"><label>Mot de passe Administrateur *</label><input class="input" type="password" name="admin_password" autocomplete="off" required></div><div class="field full"><button class="btn btn-danger" type="submit">Autoriser et supprimer</button></div></form>`,onReady:(wrap,close)=>wrap.querySelector('#assocDeleteApproval').addEventListener('submit',async e=>{e.preventDefault();const admin_password=new FormData(e.currentTarget).get('admin_password');try{await FCK.save(action,{id,admin_password});FCK.toast('Suppression effectuée.');close();await refresh();render()}catch(err){FCK.toast(err.message,'error')}})})
  }

  function printSection(id,title,subtitle=''){
    const node=document.getElementById(id);if(!node)return;
    FCK.printProfessional({title,subtitle,source:node,orientation:'landscape'});
  }

  async function refresh(){data=await FCK.loadData(true,'associations')}
  document.addEventListener('DOMContentLoaded',()=>document.getElementById('associationSearch')?.addEventListener('input',renderAssociations));
  document.addEventListener('fck:ready',e=>{data=e.detail;if(data)render()});
})();
