(()=>{
  const key=document.body.dataset.page;
  const configs={
    sectors:{dataKey:'sectors',title:'secteur',plural:'Liste des secteurs',addLabel:'Ajouter un secteur',access:'sectors',columns:[['name','Secteur'],['locality','Localité']]},
    responsibles:{dataKey:'responsibles',title:'responsable',plural:'Liste des responsables de secteur',addLabel:'Ajouter un responsable',access:'responsibles',columns:[['full_name','Nom complet'],['sector_locality','Secteur / Localité'],['function_title','Fonction'],['responsible_contact','Contact'],['voting_place','Lieu de vote']]},
    girls:{dataKey:'girls',title:'jeune fille',plural:'Liste des jeunes filles',addLabel:'Ajouter une jeune fille',access:'girls',columns:[['full_name','Nom complet'],['sector_locality','Secteur / Localité'],['responsible_name','Responsable'],['girl_identity','Contact / Sexe'],['vote_summary','Vote'],['profile_summary','Naissance / Activité'],['ally1_summary','Allié 1'],['ally2_summary','Allié 2']]},
    boys:{dataKey:'boys',title:'jeune garçon',plural:'Liste des jeunes garçons',addLabel:'Ajouter un jeune garçon',access:'boys',columns:[['full_name','Nom complet'],['sector_locality','Secteur / Localité'],['responsible_name','Responsable'],['phone','Contact'],['vote_summary','Vote'],['profile_summary','Naissance / Activité']]}
  };
  const cfg=configs[key]; let data=null, filtered=[];
  const isAdmin=()=>data&&['admin','superadmin'].includes(data.user.role);
  const isAgent=()=>data?.user?.role==='member'&&data.user.access?.account_type==='agent';
  const isVisitor=()=>data?.user?.role==='member'&&data.user.access?.account_type==='visitor';
  const canAdd=()=>isAdmin() || (isAgent()&&data.access?.can_add!==false);
  const canPrint=()=>isAdmin() || (isAgent()&&data.access?.can_print!==false);
  const canEditWithApproval=()=>isAdmin() || isAgent();
  const clean=v=>String(v??'').trim();
  const uniq=arr=>[...new Set(arr.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
  function actionNames(){return key==='sectors'?['add-sector','update-sector','delete-sector']:key==='responsibles'?['add-responsible','update-responsible','delete-responsible']:key==='girls'?['add-girl','update-girl','delete-girl']:['add-boy','update-boy','delete-boy']}
  function render(){
    if(!cfg||!data)return;if(!FCK.guardPage(data,cfg.access))return;if(FCK.subscriptionGate(data,'#protectedMain'))return;
    const action=document.getElementById('pageAction');
    action.innerHTML=`<div class="page-actions">${canPrint()?`<button id="printBtn" class="btn btn-outline">🖨 Imprimer PDF</button>`:''}${canAdd()?`<button id="addBtn" class="btn btn-orange">＋ ${cfg.addLabel}</button>`:''}</div>`;
    action.querySelector('#addBtn')?.addEventListener('click',()=>openForm());
    action.querySelector('#printBtn')?.addEventListener('click',printList);
    applyFilter();
    const search=document.getElementById('tableSearch'); if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('input',applyFilter)}
  }
  function applyFilter(){const q=(document.getElementById('tableSearch')?.value||'').toLowerCase().trim();const src=data[cfg.dataKey]||[];filtered=q?src.filter(r=>Object.values(r).some(v=>String(v??'').toLowerCase().includes(q))):src;renderTable()}
  function displayValue(r,k){
    if(k==='birth_date')return FCK.fmtDate(r[k]);
    if(k==='sector_locality'){
      const sector=clean(r.sector_name||r.name); const locality=clean(r.locality);
      return [sector?`<strong>${FCK.esc(sector)}</strong>`:'',locality?`<span class="table-meta">${FCK.esc(locality)}</span>`:''].filter(Boolean).join('<br>')||'—';
    }
    if(k==='responsible_contact'){
      const bits=[clean(r.phone)?`Tél. : ${clean(r.phone)}`:'',clean(r.email)?clean(r.email):''].filter(Boolean);
      return bits.length?bits.map(FCK.esc).join('<br>'):'—';
    }
    if(k==='girl_identity'){
      const bits=[clean(r.phone)?`Contact : ${clean(r.phone)}`:'',clean(r.gender)?clean(r.gender):''].filter(Boolean);
      return bits.length?bits.map(FCK.esc).join('<br>'):'—';
    }
    if(k==='vote_summary'){
      const bits=[clean(r.polling_station)?`Bureau : ${clean(r.polling_station)}`:'',clean(r.voting_place)?`Lieu : ${clean(r.voting_place)}`:''].filter(Boolean);
      return bits.length?bits.map(FCK.esc).join('<br>'):'—';
    }
    if(k==='profile_summary'){
      const bits=[clean(r.birth_date)?`Naissance : ${FCK.fmtDate(r.birth_date)}`:'',clean(r.occupation)?`Activité : ${clean(r.occupation)}`:''].filter(Boolean);
      return bits.length?bits.map(FCK.esc).join('<br>'):'—';
    }
    if(k==='ally1_summary'||k==='ally2_summary'){
      const n=k==='ally1_summary'?1:2; const name=clean(r[`ally${n}_name`]); if(!name)return '—';
      const bits=[name,clean(r[`ally${n}_phone`])?`Contact: ${clean(r[`ally${n}_phone`])}`:'',clean(r[`ally${n}_gender`]),clean(r[`ally${n}_polling_station`])?`Bureau: ${clean(r[`ally${n}_polling_station`])}`:'',clean(r[`ally${n}_voting_place`])?`Lieu: ${clean(r[`ally${n}_voting_place`])}`:''].filter(Boolean);
      return bits.map(FCK.esc).join('<br>');
    }
    return FCK.esc(r[k]||'—');
  }
  function renderTable(){
    document.getElementById('tableCount').textContent=`${filtered.length} élément${filtered.length>1?'s':''}`;
    if(!filtered.length){document.getElementById('tableArea').innerHTML='<div class="empty-state">Aucun élément enregistré.</div>';return;}
    let html='<table id="printableTable"><thead><tr>'+cfg.columns.map(c=>`<th>${c[1]}</th>`).join('')+(canEditWithApproval()?'<th class="no-print">Actions</th>':'')+'</tr></thead><tbody>';
    html+=filtered.map(r=>`<tr>${cfg.columns.map(([k])=>`<td>${displayValue(r,k)}</td>`).join('')}${canEditWithApproval()?`<td class="no-print"><div class="actions"><button class="btn btn-sm btn-ghost" data-edit="${r.id}">Modifier</button><button class="btn btn-sm btn-danger" data-delete="${r.id}">Supprimer</button></div></td>`:''}</tr>`).join('');
    html+='</tbody></table>';const area=document.getElementById('tableArea');area.innerHTML=html;
    area.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openForm(filtered.find(x=>x.id===b.dataset.edit))));
    area.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>remove(b.dataset.delete)));
  }
  function printList(){
    const table=document.getElementById('printableTable');if(!table)return;
    FCK.printProfessional({title:cfg.plural,subtitle:`${filtered.length} élément(s) enregistré(s)`,source:table,orientation:'landscape'});
  }
  function sectorRows(){return data?.sectors||[]}
  function sectorOptions(selected=''){return `<option value="">— Aucun / non précisé —</option>`+sectorRows().map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${FCK.esc(s.name)}${s.locality?` · ${FCK.esc(s.locality)}`:''}</option>`).join('')}
  function sectorById(id){return sectorRows().find(s=>s.id===id)||null}
  function sectorNameOptions(selected=''){
    return `<option value="">— Sélectionner un secteur —</option>`+uniq(sectorRows().map(s=>s.name)).map(name=>`<option value="${FCK.esc(name)}" ${name===selected?'selected':''}>${FCK.esc(name)}</option>`).join('');
  }
  function localityOptions(sectorName,selected=''){
    const list=uniq(sectorRows().filter(s=>clean(s.name)===clean(sectorName)).map(s=>s.locality));
    return `<option value="">— Sélectionner une localité —</option>`+list.map(v=>`<option value="${FCK.esc(v)}" ${v===selected?'selected':''}>${FCK.esc(v)}</option>`).join('');
  }
  function matchingSector(sectorName,locality){
    return sectorRows().find(s=>clean(s.name)===clean(sectorName)&&clean(s.locality)===clean(locality))||null;
  }
  function bindGirlHierarchy(wrap,row={}){
    const sectorSel=wrap.querySelector('#girlSectorName');
    const localitySel=wrap.querySelector('#girlLocality');
    const idInput=wrap.querySelector('#girlSectorId');
    if(!sectorSel||!localitySel||!idInput)return;
    const linked=sectorById(row.sector_id);
    const initialSector=clean(linked?.name||row.sector_name||sectorSel.value);
    const initialLocality=clean(linked?.locality||row.locality||localitySel.value);
    function syncId(){
      const match=matchingSector(sectorSel.value,localitySel.value);
      idInput.value=match?.id||'';
    }
    function fillLocalities(preferredLocality=''){
      if(!sectorSel.value){
        localitySel.innerHTML='<option value="">— Choisir d’abord un secteur —</option>';
        localitySel.disabled=true;
        idInput.value='';
        return;
      }
      localitySel.disabled=false;
      localitySel.innerHTML=localityOptions(sectorSel.value,preferredLocality);
      if(preferredLocality && ![...localitySel.options].some(o=>o.value===preferredLocality)) localitySel.value='';
      syncId();
    }
    sectorSel.addEventListener('change',()=>fillLocalities());
    localitySel.addEventListener('change',syncId);
    sectorSel.value=initialSector;
    fillLocalities(initialLocality);
  }
  function bindBoyHierarchy(wrap,row={}){
    const sectorSel=wrap.querySelector('#boySectorName');
    const localitySel=wrap.querySelector('#boyLocality');
    const idInput=wrap.querySelector('#boySectorId');
    if(!sectorSel||!localitySel||!idInput)return;
    const linked=sectorById(row.sector_id);
    const initialSector=clean(linked?.name||row.sector_name||sectorSel.value);
    const initialLocality=clean(linked?.locality||row.locality||localitySel.value);
    function syncId(){
      const match=matchingSector(sectorSel.value,localitySel.value);
      idInput.value=match?.id||'';
    }
    function fillLocalities(preferredLocality=''){
      if(!sectorSel.value){
        localitySel.innerHTML='<option value="">— Choisir d’abord un secteur —</option>';
        localitySel.disabled=true;
        idInput.value='';
        return;
      }
      localitySel.disabled=false;
      localitySel.innerHTML=localityOptions(sectorSel.value,preferredLocality);
      if(preferredLocality && ![...localitySel.options].some(o=>o.value===preferredLocality)) localitySel.value='';
      syncId();
    }
    sectorSel.addEventListener('change',()=>fillLocalities());
    localitySel.addEventListener('change',syncId);
    sectorSel.value=initialSector;
    fillLocalities(initialLocality);
  }
  const RESPONSIBLE_ROLES=['Responsable de secteur','Responsable des jeunes filles','Responsable des jeunes garçons'];
  function functionOptions(locality, selected='', currentId=''){
    const loc=clean(locality).toLowerCase();
    const used=new Set((data?.responsibles||[])
      .filter(r=>r.id!==currentId&&clean(r.locality).toLowerCase()===loc)
      .map(r=>clean(r.function_title).toLowerCase()));
    return `<option value="">— Sélectionner une fonction —</option>`+RESPONSIBLE_ROLES.map(role=>{
      const disabled=used.has(role.toLowerCase());
      const isSelected=!disabled&&clean(selected)===role;
      return `<option value="${FCK.esc(role)}" ${isSelected?'selected':''} ${disabled?'disabled':''}>${FCK.esc(role)}${disabled?' — déjà attribuée':''}</option>`;
    }).join('');
  }
  function bindResponsibleHierarchy(wrap,row={}){
    const sectorSel=wrap.querySelector('#responsibleSectorName');
    const localitySel=wrap.querySelector('#responsibleLocality');
    const functionSel=wrap.querySelector('#responsibleFunction');
    const idInput=wrap.querySelector('#responsibleSectorId');
    const localityField=localitySel?.closest('.field');
    if(!sectorSel||!localitySel||!functionSel||!idInput||!localityField)return;
    const linked=sectorById(row.sector_id);
    const initialSector=clean(linked?.name||row.sector_name||sectorSel.value);
    const initialLocality=clean(linked?.locality||row.locality||localitySel.value);
    const initialFunction=clean(row.function_title||'');

    function ensureLocalityForSectorRole(){
      if(clean(functionSel.value)!=='Responsable de secteur')return;
      if(!sectorSel.value)return;
      const available=uniq(sectorRows().filter(s=>clean(s.name)===clean(sectorSel.value)).map(s=>s.locality));
      if(!localitySel.value || !available.includes(localitySel.value)) localitySel.value=available[0]||'';
    }
    function updateLocalityVisibility(){
      const sectorRole=clean(functionSel.value)==='Responsable de secteur';
      if(sectorRole) ensureLocalityForSectorRole();

      // Le champ Localité doit être totalement invisible pour « Responsable de secteur ».
      // On applique à la fois hidden + style.display afin qu'aucune règle .field{display:flex}
      // ne puisse réafficher le bloc dans le popup.
      localityField.hidden=sectorRole;
      localityField.style.display=sectorRole?'none':'';
      localityField.setAttribute('aria-hidden',sectorRole?'true':'false');

      // La localité technique reste calculée en arrière-plan pour conserver les règles
      // serveur et d'unicité déjà imposées, mais elle n'est pas présentée à l'utilisateur.
      localitySel.required=!sectorRole;
      localitySel.tabIndex=sectorRole?-1:0;
      localitySel.setAttribute('aria-hidden',sectorRole?'true':'false');
    }
    function refreshFunctions(preferredFunction=''){
      const wanted=clean(preferredFunction||functionSel.value||initialFunction);
      functionSel.innerHTML=functionOptions(localitySel.value,wanted,row.id||'');
      if(wanted && [...functionSel.options].some(o=>o.value===wanted&&!o.disabled)) functionSel.value=wanted;
      updateLocalityVisibility();
    }
    function syncId(preferredFunction=''){
      const match=matchingSector(sectorSel.value,localitySel.value);
      idInput.value=match?.id||'';
      refreshFunctions(preferredFunction);
    }
    function fillLocalities(preferredLocality='',preferredFunction=''){
      if(!sectorSel.value){
        localitySel.innerHTML='<option value="">— Choisir d’abord un secteur —</option>';
        localitySel.disabled=true; idInput.value='';
        refreshFunctions(preferredFunction||initialFunction);
        return;
      }
      localitySel.disabled=false;
      localitySel.innerHTML=localityOptions(sectorSel.value,preferredLocality);
      if(preferredLocality && ![...localitySel.options].some(o=>o.value===preferredLocality)) localitySel.value='';
      if(clean(preferredFunction||functionSel.value||initialFunction)==='Responsable de secteur' && !localitySel.value){
        const first=[...localitySel.options].find(o=>o.value);
        if(first)localitySel.value=first.value;
      }
      syncId(preferredFunction);
    }
    sectorSel.addEventListener('change',()=>fillLocalities('',functionSel.value));
    localitySel.addEventListener('change',()=>syncId(functionSel.value));
    functionSel.addEventListener('change',()=>{
      const selected=clean(functionSel.value);
      if(selected==='Responsable de secteur'){
        ensureLocalityForSectorRole();
        const match=matchingSector(sectorSel.value,localitySel.value);
        idInput.value=match?.id||'';
      }
      updateLocalityVisibility();
    });
    sectorSel.value=initialSector;
    fillLocalities(initialLocality,initialFunction);
    refreshFunctions(initialFunction);
  }
  function openForm(row={}){
    const editing=!!row.id;let fields='';
    if(key==='sectors')fields=`<div class="field"><label>Nom du secteur *</label><input class="input" name="name" value="${FCK.esc(row.name||'')}" required></div><div class="field"><label>Localité</label><input class="input" name="locality" value="${FCK.esc(row.locality||'')}"></div>`;
    if(key==='responsibles'){
      const linked=sectorById(row.sector_id);
      const selectedSector=clean(linked?.name||row.sector_name||'');
      const selectedLocality=clean(linked?.locality||row.locality||'');
      fields=`<div class="field"><label>Nom complet *</label><input class="input" name="full_name" value="${FCK.esc(row.full_name||'')}" required></div><div class="field"><label>Secteur *</label><select class="select" id="responsibleSectorName" name="sector_name" required>${sectorNameOptions(selectedSector)}</select><input type="hidden" id="responsibleSectorId" name="sector_id" value="${FCK.esc(row.sector_id||'')}"></div><div class="field"><label>Fonction *</label><select class="select" id="responsibleFunction" name="function_title" required>${functionOptions(selectedLocality,row.function_title||'',row.id||'')}</select><span class="hint">Une seule personne par fonction est autorisée dans une même localité.</span></div><div class="field"><label>Localité *</label><select class="select" id="responsibleLocality" name="locality" required ${selectedSector?'':'disabled'}>${selectedSector?localityOptions(selectedSector,selectedLocality):'<option value="">— Choisir d’abord un secteur —</option>'}</select></div><div class="field"><label>Téléphone</label><input class="input" name="phone" value="${FCK.esc(row.phone||'')}"></div><div class="field"><label>Lieu de vote</label><input class="input" name="voting_place" value="${FCK.esc(row.voting_place||'')}" placeholder="Lieu de vote"></div><div class="field full"><label>E-mail</label><input class="input" type="email" name="email" value="${FCK.esc(row.email||'')}"></div>`;
    }
    if(key==='girls'){
      const linked=sectorById(row.sector_id);
      const selectedSector=clean(linked?.name||row.sector_name||'');
      const selectedLocality=clean(linked?.locality||row.locality||'');
      fields=`<div class="field"><label>Nom complet *</label><input class="input" name="full_name" value="${FCK.esc(row.full_name||'')}" required></div><div class="field"><label>Secteur *</label><select class="select" id="girlSectorName" name="sector_name" required>${sectorNameOptions(selectedSector)}</select><input type="hidden" id="girlSectorId" name="sector_id" value="${FCK.esc(row.sector_id||'')}"></div><div class="field"><label>Localité *</label><select class="select" id="girlLocality" name="locality" required ${selectedSector?'':'disabled'}>${selectedSector?localityOptions(selectedSector,selectedLocality):'<option value="">— Choisir d’abord un secteur —</option>'}</select><span class="hint">La liste des localités dépend du secteur sélectionné.</span></div><div class="field"><label>Contact</label><input class="input" type="tel" name="phone" value="${FCK.esc(row.phone||'')}"></div><div class="field"><label>Sexe</label><select class="select" name="gender"><option ${clean(row.gender||'Féminin')==='Féminin'?'selected':''}>Féminin</option><option ${clean(row.gender)==='Masculin'?'selected':''}>Masculin</option></select></div><div class="field"><label>Bureau de vote</label><input class="input" name="polling_station" value="${FCK.esc(row.polling_station||'')}"></div><div class="field"><label>Lieu de vote</label><input class="input" name="voting_place" value="${FCK.esc(row.voting_place||'')}"></div><div class="field"><label>Date de naissance</label><input class="input" type="date" name="birth_date" value="${FCK.esc(row.birth_date||'')}"></div><div class="field full"><label>Activité / Études</label><input class="input" name="occupation" value="${FCK.esc(row.occupation||'')}"></div><div class="field full section-separator"><strong>Personne alliée 1</strong></div><div class="field"><label>Nom complet</label><input class="input" name="ally1_name" value="${FCK.esc(row.ally1_name||'')}"></div><div class="field"><label>Contact</label><input class="input" type="tel" name="ally1_phone" value="${FCK.esc(row.ally1_phone||'')}"></div><div class="field"><label>Sexe</label><select class="select" name="ally1_gender"><option value="">—</option><option ${row.ally1_gender==='Féminin'?'selected':''}>Féminin</option><option ${row.ally1_gender==='Masculin'?'selected':''}>Masculin</option></select></div><div class="field"><label>Bureau de vote</label><input class="input" name="ally1_polling_station" value="${FCK.esc(row.ally1_polling_station||'')}"></div><div class="field"><label>Lieu de vote</label><input class="input" name="ally1_voting_place" value="${FCK.esc(row.ally1_voting_place||'')}"></div><div class="field full section-separator"><strong>Personne alliée 2</strong></div><div class="field"><label>Nom complet</label><input class="input" name="ally2_name" value="${FCK.esc(row.ally2_name||'')}"></div><div class="field"><label>Contact</label><input class="input" type="tel" name="ally2_phone" value="${FCK.esc(row.ally2_phone||'')}"></div><div class="field"><label>Sexe</label><select class="select" name="ally2_gender"><option value="">—</option><option ${row.ally2_gender==='Féminin'?'selected':''}>Féminin</option><option ${row.ally2_gender==='Masculin'?'selected':''}>Masculin</option></select></div><div class="field"><label>Bureau de vote</label><input class="input" name="ally2_polling_station" value="${FCK.esc(row.ally2_polling_station||'')}"></div><div class="field"><label>Lieu de vote</label><input class="input" name="ally2_voting_place" value="${FCK.esc(row.ally2_voting_place||'')}"></div><input type="hidden" name="status_label" value="${FCK.esc(row.status_label||'Actif')}">`;
    }
    if(key==='boys'){
      const linked=sectorById(row.sector_id);
      const selectedSector=clean(linked?.name||row.sector_name||'');
      const selectedLocality=clean(linked?.locality||row.locality||'');
      fields=`<div class="field"><label>Nom complet *</label><input class="input" name="full_name" value="${FCK.esc(row.full_name||'')}" required></div><div class="field"><label>Secteur *</label><select class="select" id="boySectorName" name="sector_name" required>${sectorNameOptions(selectedSector)}</select><input type="hidden" id="boySectorId" name="sector_id" value="${FCK.esc(row.sector_id||'')}"></div><div class="field"><label>Localité *</label><select class="select" id="boyLocality" name="locality" required ${selectedSector?'':'disabled'}>${selectedSector?localityOptions(selectedSector,selectedLocality):'<option value="">— Choisir d’abord un secteur —</option>'}</select><span class="hint">La liste des localités dépend du secteur sélectionné.</span></div><div class="field"><label>Contact</label><input class="input" type="tel" name="phone" value="${FCK.esc(row.phone||'')}"></div><div class="field"><label>Bureau de vote</label><input class="input" name="polling_station" value="${FCK.esc(row.polling_station||'')}"></div><div class="field"><label>Lieu de vote</label><input class="input" name="voting_place" value="${FCK.esc(row.voting_place||'')}"></div><div class="field"><label>Date de naissance</label><input class="input" type="date" name="birth_date" value="${FCK.esc(row.birth_date||'')}"></div><div class="field"><label>Activité / Études</label><input class="input" name="occupation" value="${FCK.esc(row.occupation||'')}"></div><input type="hidden" name="status_label" value="${FCK.esc(row.status_label||'Actif')}">`;
    }

    const approval=(editing&&isAgent())?`<div class="field full admin-approval"><label>Mot de passe d’un Administrateur *</label><input class="input" type="password" name="admin_password" autocomplete="off" required><span class="hint">Un Agent ne peut modifier une ligne qu’après validation par le mot de passe d’un Administrateur.</span></div>`:'';
    FCK.modal({title:`${editing?'Modifier':'Ajouter'} ${cfg.title}`,html:`<form id="entityForm" class="form-grid">${fields}${approval}<div class="field full"><div class="modal-actions"><button type="submit" class="btn btn-primary">Enregistrer</button></div></div></form>`,onReady:(wrap,close)=>{
      if(key==='responsibles')bindResponsibleHierarchy(wrap,row);
      if(key==='girls')bindGirlHierarchy(wrap,row);
      if(key==='boys')bindBoyHierarchy(wrap,row);
      wrap.querySelector('#entityForm').addEventListener('submit',async e=>{
        e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget));
        if(key==='responsibles'){
          const sectorName=clean(obj.sector_name);
          if(!sectorName){FCK.toast('Sélectionnez un secteur.','error');return;}
          if(!clean(obj.locality)){FCK.toast('Sélectionnez une localité.','error');return;}
          if(!RESPONSIBLE_ROLES.includes(clean(obj.function_title))){FCK.toast('Sélectionnez une fonction valide.','error');return;}
          const match=matchingSector(sectorName,obj.locality);
          if(!match){FCK.toast('La combinaison Secteur · Localité n’existe pas dans la liste des secteurs.','error');return;}
          const duplicate=(data?.responsibles||[]).find(r=>r.id!==row.id&&clean(r.locality).toLowerCase()===clean(obj.locality).toLowerCase()&&clean(r.function_title).toLowerCase()===clean(obj.function_title).toLowerCase());
          if(duplicate){FCK.toast(`La fonction « ${clean(obj.function_title)} » est déjà attribuée dans cette localité.`,'error');return;}
          obj.sector_id=match.id;
          delete obj.sector_name;
        }
        if(key==='girls'){
          const sectorName=clean(obj.sector_name);
          const locality=clean(obj.locality);
          if(!sectorName){FCK.toast('Sélectionnez un secteur.','error');return;}
          if(!locality){FCK.toast('Sélectionnez une localité.','error');return;}
          const match=matchingSector(sectorName,locality);
          if(!match){FCK.toast('La combinaison Secteur · Localité n’existe pas dans la liste des secteurs.','error');return;}
          obj.sector_id=match.id;
          obj.locality=clean(match.locality);
          delete obj.sector_name;
        }
        if(key==='boys'){
          const sectorName=clean(obj.sector_name);
          const locality=clean(obj.locality);
          if(!sectorName){FCK.toast('Sélectionnez un secteur.','error');return;}
          if(!locality){FCK.toast('Sélectionnez une localité.','error');return;}
          const match=matchingSector(sectorName,locality);
          if(!match){FCK.toast('La combinaison Secteur · Localité n’existe pas dans la liste des secteurs.','error');return;}
          obj.sector_id=match.id;
          obj.locality=clean(match.locality);
          delete obj.sector_name;
        }
        if(editing)obj.id=row.id;const [add,update]=actionNames();
        try{await FCK.save(editing?update:add,obj);FCK.toast('Enregistrement effectué.');close();data=await FCK.loadData(true);render();}catch(err){FCK.toast(err.message,'error')}
      });
    }})
  }
  async function remove(id){
    const del=actionNames()[2];
    if(isAdmin()){
      if(!await FCK.confirmPopup({title:'Confirmer la suppression',message:'Voulez-vous vraiment supprimer cet élément ?',detail:'Cette action est définitive et ne peut pas être annulée.'}))return;
      try{await FCK.save(del,{id});FCK.toast('Élément supprimé.');data=await FCK.loadData(true);render()}catch(err){FCK.toast(err.message,'error')}return;
    }
    FCK.modal({title:'Autorisation Administrateur requise',html:`<div class="alert alert-warn">La suppression par un Agent nécessite le mot de passe d’un Administrateur.</div><form id="deleteApproval" class="form-grid"><div class="field full"><label>Mot de passe Administrateur *</label><input class="input" type="password" name="admin_password" autocomplete="off" required></div><div class="field full"><div class="modal-actions"><button class="btn btn-danger" type="submit">Autoriser et supprimer</button></div></div></form>`,onReady:(wrap,close)=>wrap.querySelector('#deleteApproval').addEventListener('submit',async e=>{e.preventDefault();const admin_password=new FormData(e.currentTarget).get('admin_password');try{await FCK.save(del,{id,admin_password});FCK.toast('Élément supprimé.');close();data=await FCK.loadData(true);render()}catch(err){FCK.toast(err.message,'error')}})});
  }
  document.addEventListener('fck:ready',e=>{data=e.detail;if(data)render()});
})();
