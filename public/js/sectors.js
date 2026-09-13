(()=>{
  let data=null, filtered=[];
  const clean=v=>String(v??'').trim();
  const isAdmin=()=>data&&['admin','superadmin'].includes(data.user.role);
  const isAgent=()=>data?.user?.role==='member'&&data.user.access?.account_type==='agent';
  const canAdd=()=>isAdmin()||(isAgent()&&data.access?.can_add!==false);
  const canPrint=()=>isAdmin()||(isAgent()&&data.access?.can_print!==false);
  const canEdit=()=>isAdmin()||isAgent();
  const canSeeYoung=type=>isAdmin()||data?.access?.[type]!==false;
  const canAddYoung=type=>canSeeYoung(type)&&canAdd();
  const sectors=()=>data?.sectors||[];
  const girls=()=>data?.girls||[];
  const boys=()=>data?.boys||[];
  const responsibles=()=>data?.responsibles||[];

  function principalFor(sectorId){
    return responsibles().find(r=>r.sector_id===sectorId&&String(r.function_title||'').toLowerCase()==='responsable de secteur')||responsibles().filter(r=>r.sector_id===sectorId).sort((a,b)=>Number(b.is_primary||0)-Number(a.is_primary||0)||String(a.full_name||'').localeCompare(String(b.full_name||''),'fr'))[0]||null;
  }
  function roleResponsibleFor(sectorId, role){
    const wanted=String(role||'').toLowerCase();
    return responsibles().find(r=>r.sector_id===sectorId&&String(r.function_title||'').toLowerCase()===wanted)||null;
  }
  function sectorGirls(id){return girls().filter(x=>x.sector_id===id)}
  function sectorBoys(id){return boys().filter(x=>x.sector_id===id)}

  function render(){
    if(!data)return;
    if(!FCK.guardPage(data,'sectors'))return;
    if(FCK.subscriptionGate(data,'#protectedMain'))return;
    const action=document.getElementById('pageAction');
    action.innerHTML=`<div class="page-actions">${canPrint()?'<button id="printSectors" class="btn btn-outline">🖨 Imprimer PDF</button>':''}${canAdd()?'<button id="addSector" class="btn btn-orange">＋ Ajouter secteur</button>':''}</div>`;
    action.querySelector('#addSector')?.addEventListener('click',()=>openSectorForm());
    action.querySelector('#printSectors')?.addEventListener('click',printSectorList);
    const search=document.getElementById('tableSearch');
    if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('input',applyFilter)}
    applyFilter();
  }

  function applyFilter(){
    const q=clean(document.getElementById('tableSearch')?.value).toLowerCase();
    filtered=q?sectors().filter(s=>[s.name,s.locality,s.responsible_name,s.responsible_phone,s.girls_responsible_name,s.boys_responsible_name].some(v=>String(v||'').toLowerCase().includes(q))):sectors();
    renderTable();
  }

  function renderTable(){
    const count=document.getElementById('tableCount');
    if(count)count.textContent=`${filtered.length} secteur${filtered.length>1?'s':''}`;
    const area=document.getElementById('tableArea');
    if(!filtered.length){area.innerHTML='<div class="empty-state">Aucun secteur enregistré.</div>';return;}
    let html=`<table id="printableSectorTable"><thead><tr><th>Secteur</th><th>Localité</th><th>Resp. secteur</th><th>Resp. jeunes filles</th><th>Resp. jeunes garçons</th><th class="no-print">Actions</th></tr></thead><tbody>`;
    html+=filtered.map(s=>{
      const r=principalFor(s.id);
      const rg=roleResponsibleFor(s.id,'Responsable des jeunes filles');
      const rb=roleResponsibleFor(s.id,'Responsable des jeunes garçons');
      return `<tr><td>${FCK.esc(s.name||'—')}</td><td>${FCK.esc(s.locality||'—')}</td><td>${FCK.esc(r?.full_name||s.responsible_name||'—')}</td><td>${FCK.esc(rg?.full_name||s.girls_responsible_name||'—')}</td><td>${FCK.esc(rb?.full_name||s.boys_responsible_name||'—')}</td><td class="no-print"><div class="actions">${canEdit()?`<button class="btn btn-sm btn-ghost" data-edit="${s.id}">Modifier</button><button class="btn btn-sm btn-danger" data-delete="${s.id}">Supprimer</button>`:'—'}</div></td></tr>`;
    }).join('');
    html+='</tbody></table>';
    area.innerHTML=html;
    area.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openSectorForm(sectors().find(x=>x.id===b.dataset.edit))));
    area.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>removeSector(b.dataset.delete)));
  }

  function printSectorList(){
    const t=document.getElementById('printableSectorTable'); if(!t)return;
    FCK.printProfessional({title:'Liste des secteurs',subtitle:`${filtered.length} secteur(s) enregistré(s)`,source:t,orientation:'landscape'});
  }

  function openSectorForm(row={}){
    const editing=!!row.id;
    const approval=editing&&isAgent()?`<div class="field full admin-approval"><label>Mot de passe d’un Administrateur *</label><input class="input" type="password" name="admin_password" required autocomplete="off"><span class="hint">Validation obligatoire pour toute modification par un Agent.</span></div>`:'';

    if(editing){
      FCK.modal({title:'Modifier le secteur',html:`<form id="sectorForm" class="form-grid">
        <div class="field"><label>Nom du secteur *</label><input class="input" name="name" value="${FCK.esc(row.name||'')}" required></div>
        <div class="field"><label>Localité *</label><input class="input" name="locality" value="${FCK.esc(row.locality||'')}" required></div>
        ${approval}
        <div class="field full"><div class="modal-actions"><button type="submit" class="btn btn-primary">Enregistrer</button></div></div>
      </form>`,onReady:(wrap,close)=>{
        wrap.querySelector('#sectorForm').addEventListener('submit',async e=>{
          e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget));obj.id=row.id;
          try{await FCK.save('update-sector',obj);FCK.toast('Secteur modifié.');close();data=await FCK.loadData(true);render();}catch(err){FCK.toast(err.message,'error')}
        });
      }});
      return;
    }

    const rowHtml=(idx=0)=>`<div class="sector-entry-row" data-sector-row>
      <div class="field"><label>Secteur *</label><input class="input" name="sector_name_${idx}" data-sector-name required placeholder="Nom du secteur"></div>
      <div class="field"><label>Localité *</label><input class="input" name="sector_locality_${idx}" data-sector-locality required placeholder="Localité"></div>
      <div class="sector-row-action"><button type="button" class="btn btn-sm btn-danger" data-remove-sector-row title="Supprimer cette ligne" aria-label="Supprimer cette ligne">✕</button></div>
    </div>`;

    FCK.modal({title:'Ajouter des secteurs',large:true,html:`<form id="sectorBulkForm">
      <div class="alert alert-info">Ajoutez un ou plusieurs secteurs avec leur localité. Les responsables se renseignent séparément dans la page <strong>Responsables</strong>.</div>
      <div id="sectorRows" class="sector-entry-list">${rowHtml(0)}</div>
      <div class="sector-add-line"><button type="button" id="addSectorRow" class="btn btn-outline">＋ Ajouter une ligne</button></div>
      <div class="modal-actions"><button type="submit" class="btn btn-primary">Enregistrer les secteurs</button></div>
    </form>`,onReady:(wrap,close)=>{
      const rows=wrap.querySelector('#sectorRows');
      const refreshRemoveButtons=()=>{
        const items=[...rows.querySelectorAll('[data-sector-row]')];
        items.forEach((item,i)=>{
          const btn=item.querySelector('[data-remove-sector-row]');
          if(btn){btn.style.visibility=items.length>1?'visible':'hidden';btn.onclick=()=>{if(items.length>1){item.remove();refreshRemoveButtons()}};}
        });
      };
      wrap.querySelector('#addSectorRow').addEventListener('click',()=>{
        const idx=rows.querySelectorAll('[data-sector-row]').length;
        rows.insertAdjacentHTML('beforeend',rowHtml(idx));
        refreshRemoveButtons();
        rows.lastElementChild?.querySelector('[data-sector-name]')?.focus();
      });
      refreshRemoveButtons();
      wrap.querySelector('#sectorBulkForm').addEventListener('submit',async e=>{
        e.preventDefault();
        const entries=[...rows.querySelectorAll('[data-sector-row]')].map(item=>({
          name:clean(item.querySelector('[data-sector-name]')?.value),
          locality:clean(item.querySelector('[data-sector-locality]')?.value)
        })).filter(x=>x.name||x.locality);
        if(!entries.length){FCK.toast('Ajoutez au moins un secteur.','error');return;}
        if(entries.some(x=>!x.name||!x.locality)){FCK.toast('Chaque ligne doit contenir le secteur et la localité.','error');return;}
        try{
          const out=await FCK.save('add-sectors-bulk',{rows:entries});
          FCK.toast(out?.message||`${entries.length} secteur(s) enregistré(s).`);
          close();data=await FCK.loadData(true);render();
        }catch(err){FCK.toast(err.message,'error')}
      });
    }});
  }

  function allySummary(row,n){
    const name=clean(row[`ally${n}_name`]); if(!name)return '—';
    const bits=[name,clean(row[`ally${n}_gender`]),clean(row[`ally${n}_polling_station`])?`Bureau: ${clean(row[`ally${n}_polling_station`])}`:'',clean(row[`ally${n}_voting_place`])?`Lieu: ${clean(row[`ally${n}_voting_place`])}`:''].filter(Boolean);
    return bits.map(FCK.esc).join('<br>');
  }

  function openSectorDetail(sectorId){
    const s=sectors().find(x=>x.id===sectorId);if(!s)return;
    const r=principalFor(sectorId), rg=roleResponsibleFor(sectorId,'Responsable des jeunes filles'), rb=roleResponsibleFor(sectorId,'Responsable des jeunes garçons'), gs=sectorGirls(sectorId), bs=sectorBoys(sectorId);
    const girlsTable=!canSeeYoung('girls')?'<div class="empty-state">Accès à la liste des jeunes filles non autorisé.</div>':gs.length?`<table id="sectorGirlsPrint"><thead><tr><th>Nom</th><th>Responsable</th><th>Contact</th><th>Sexe</th><th>Bureau de vote</th><th>Lieu de vote</th><th>Allié 1</th><th>Allié 2</th>${canEdit()?'<th class="no-print">Actions</th>':''}</tr></thead><tbody>${gs.map(g=>`<tr><td>${FCK.esc(g.full_name||'—')}</td><td>${FCK.esc(r?.full_name||'—')}</td><td>${FCK.esc(g.phone||'—')}</td><td>${FCK.esc(g.gender||'Féminin')}</td><td>${FCK.esc(g.polling_station||'—')}</td><td>${FCK.esc(g.voting_place||'—')}</td><td>${allySummary(g,1)}</td><td>${allySummary(g,2)}</td>${canEdit()?`<td class="no-print"><div class="actions"><button class="btn btn-sm btn-ghost" data-girl-edit="${g.id}">Modifier</button><button class="btn btn-sm btn-danger" data-girl-delete="${g.id}">Supprimer</button></div></td>`:''}</tr>`).join('')}</tbody></table>`:'<div class="empty-state">Aucune jeune fille dans ce secteur.</div>';
    const boysTable=!canSeeYoung('boys')?'<div class="empty-state">Accès à la liste des jeunes garçons non autorisé.</div>':bs.length?`<table id="sectorBoysPrint"><thead><tr><th>Nom</th><th>Responsable</th><th>Contact</th><th>Bureau de vote</th><th>Lieu de vote</th>${canEdit()?'<th class="no-print">Actions</th>':''}</tr></thead><tbody>${bs.map(b=>`<tr><td>${FCK.esc(b.full_name||'—')}</td><td>${FCK.esc(r?.full_name||'—')}</td><td>${FCK.esc(b.phone||'—')}</td><td>${FCK.esc(b.polling_station||'—')}</td><td>${FCK.esc(b.voting_place||'—')}</td>${canEdit()?`<td class="no-print"><div class="actions"><button class="btn btn-sm btn-ghost" data-boy-edit="${b.id}">Modifier</button><button class="btn btn-sm btn-danger" data-boy-delete="${b.id}">Supprimer</button></div></td>`:''}</tr>`).join('')}</tbody></table>`:'<div class="empty-state">Aucun jeune garçon dans ce secteur.</div>';
    FCK.modal({title:`Secteur : ${s.name}`,large:true,html:`<div class="sector-summary"><div><span class="hint">Localité</span><strong>${FCK.esc(s.locality||'—')}</strong></div><div><span class="hint">Responsable principal</span><strong>${FCK.esc(r?.full_name||'—')}</strong></div><div><span class="hint">Contact responsable</span><strong>${FCK.esc(r?.phone||'—')}</strong></div></div>
      <section class="sector-list-block"><div class="section-head compact"><div><h3>Liste des jeunes filles</h3><p>${gs.length} personne(s) · Responsable : ${FCK.esc(rg?.full_name||'—')}</p></div><div class="page-actions">${canSeeYoung('girls')&&canPrint()&&gs.length?'<button id="printGirls" class="btn btn-outline btn-sm">🖨 PDF</button>':''}${canAddYoung('girls')?'<button id="addGirlHere" class="btn btn-orange btn-sm">＋ Ajouter</button>':''}</div></div><div class="table-wrap">${girlsTable}</div></section>
      <section class="sector-list-block"><div class="section-head compact"><div><h3>Liste des jeunes garçons</h3><p>${bs.length} personne(s) · Responsable : ${FCK.esc(rb?.full_name||'—')}</p></div><div class="page-actions">${canSeeYoung('boys')&&canPrint()&&bs.length?'<button id="printBoys" class="btn btn-outline btn-sm">🖨 PDF</button>':''}${canAddYoung('boys')?'<button id="addBoyHere" class="btn btn-orange btn-sm">＋ Ajouter</button>':''}</div></div><div class="table-wrap">${boysTable}</div></section>`,onReady:(wrap,close)=>{
        wrap.querySelector('#addGirlHere')?.addEventListener('click',()=>openYoungForm('girls',{sector_id:sectorId},()=>{close();openSectorDetail(sectorId)}));
        wrap.querySelector('#addBoyHere')?.addEventListener('click',()=>openYoungForm('boys',{sector_id:sectorId},()=>{close();openSectorDetail(sectorId)}));
        wrap.querySelector('#printGirls')?.addEventListener('click',()=>FCK.printProfessional({title:`Jeunes filles — ${s.name}`,subtitle:`Responsable : ${r?.full_name||'—'}`,source:wrap.querySelector('#sectorGirlsPrint'),orientation:'landscape'}));
        wrap.querySelector('#printBoys')?.addEventListener('click',()=>FCK.printProfessional({title:`Jeunes garçons — ${s.name}`,subtitle:`Responsable : ${r?.full_name||'—'}`,source:wrap.querySelector('#sectorBoysPrint'),orientation:'landscape'}));
        wrap.querySelectorAll('[data-girl-edit]').forEach(btn=>btn.addEventListener('click',()=>openYoungForm('girls',gs.find(x=>x.id===btn.dataset.girlEdit),()=>{close();openSectorDetail(sectorId)})));
        wrap.querySelectorAll('[data-boy-edit]').forEach(btn=>btn.addEventListener('click',()=>openYoungForm('boys',bs.find(x=>x.id===btn.dataset.boyEdit),()=>{close();openSectorDetail(sectorId)})));
        wrap.querySelectorAll('[data-girl-delete]').forEach(btn=>btn.addEventListener('click',()=>removeYoung('girls',btn.dataset.girlDelete,async()=>{close();openSectorDetail(sectorId)})));
        wrap.querySelectorAll('[data-boy-delete]').forEach(btn=>btn.addEventListener('click',()=>removeYoung('boys',btn.dataset.boyDelete,async()=>{close();openSectorDetail(sectorId)})));
      }});
  }

  function sectorOptions(selected=''){
    return '<option value="">— Sélectionner —</option>'+sectors().map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${FCK.esc(s.name)}${s.locality?` · ${FCK.esc(s.locality)}`:''}</option>`).join('');
  }

  function openYoungForm(type,row={},afterSave){
    const editing=!!row.id, girl=type==='girls';
    const approval=editing&&isAgent()?`<div class="field full admin-approval"><label>Mot de passe d’un Administrateur *</label><input class="input" type="password" name="admin_password" required autocomplete="off"></div>`:'';
    const girlFields=girl?`<div class="field"><label>Sexe</label><select class="select" name="gender"><option ${clean(row.gender||'Féminin')==='Féminin'?'selected':''}>Féminin</option><option ${clean(row.gender)==='Masculin'?'selected':''}>Masculin</option></select></div>
      <div class="field"><label>Bureau de vote</label><input class="input" name="polling_station" value="${FCK.esc(row.polling_station||'')}"></div><div class="field full"><label>Lieu de vote</label><input class="input" name="voting_place" value="${FCK.esc(row.voting_place||'')}"></div>
      <div class="field full section-separator"><strong>Personne alliée 1</strong></div><div class="field"><label>Nom complet</label><input class="input" name="ally1_name" value="${FCK.esc(row.ally1_name||'')}"></div><div class="field"><label>Sexe</label><select class="select" name="ally1_gender"><option value="">—</option><option ${row.ally1_gender==='Féminin'?'selected':''}>Féminin</option><option ${row.ally1_gender==='Masculin'?'selected':''}>Masculin</option></select></div><div class="field"><label>Bureau de vote</label><input class="input" name="ally1_polling_station" value="${FCK.esc(row.ally1_polling_station||'')}"></div><div class="field"><label>Lieu de vote</label><input class="input" name="ally1_voting_place" value="${FCK.esc(row.ally1_voting_place||'')}"></div>
      <div class="field full section-separator"><strong>Personne alliée 2</strong></div><div class="field"><label>Nom complet</label><input class="input" name="ally2_name" value="${FCK.esc(row.ally2_name||'')}"></div><div class="field"><label>Sexe</label><select class="select" name="ally2_gender"><option value="">—</option><option ${row.ally2_gender==='Féminin'?'selected':''}>Féminin</option><option ${row.ally2_gender==='Masculin'?'selected':''}>Masculin</option></select></div><div class="field"><label>Bureau de vote</label><input class="input" name="ally2_polling_station" value="${FCK.esc(row.ally2_polling_station||'')}"></div><div class="field"><label>Lieu de vote</label><input class="input" name="ally2_voting_place" value="${FCK.esc(row.ally2_voting_place||'')}"></div>`:`<div class="field"><label>Bureau de vote</label><input class="input" name="polling_station" value="${FCK.esc(row.polling_station||'')}"></div><div class="field"><label>Lieu de vote</label><input class="input" name="voting_place" value="${FCK.esc(row.voting_place||'')}"></div>`;
    FCK.modal({title:`${editing?'Modifier':'Ajouter'} ${girl?'une jeune fille':'un jeune garçon'}`,large:true,html:`<form id="youngSectorForm" class="form-grid"><div class="field"><label>Nom complet *</label><input class="input" name="full_name" value="${FCK.esc(row.full_name||'')}" required></div><div class="field"><label>Secteur *</label><select class="select" name="sector_id" required>${sectorOptions(row.sector_id||'')}</select></div><div class="field"><label>Contact</label><input class="input" name="phone" value="${FCK.esc(row.phone||'')}"></div><div class="field"><label>Date de naissance</label><input class="input" type="date" name="birth_date" value="${FCK.esc(row.birth_date||'')}"></div><div class="field"><label>Localité</label><input class="input" name="locality" value="${FCK.esc(row.locality||'')}"></div><div class="field"><label>Activité / Études</label><input class="input" name="occupation" value="${FCK.esc(row.occupation||'')}"></div>${girlFields}<input type="hidden" name="status_label" value="${FCK.esc(row.status_label||'Actif')}">${approval}<div class="field full"><div class="modal-actions"><button class="btn btn-primary" type="submit">Enregistrer</button></div></div></form>`,onReady:(wrap,close)=>{
      wrap.querySelector('#youngSectorForm').addEventListener('submit',async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget));if(editing)obj.id=row.id;try{await FCK.save(editing?(girl?'update-girl':'update-boy'):(girl?'add-girl':'add-boy'),obj);FCK.toast('Enregistrement effectué.');close();data=await FCK.loadData(true);render();afterSave?.();}catch(err){FCK.toast(err.message,'error')}})
    }});
  }

  async function removeSector(id){
    if(isAdmin()){
      if(!await FCK.confirmPopup({title:'Supprimer le secteur',message:'Cette suppression effacera aussi toutes les lignes liées à ce secteur : responsables, jeunes filles, jeunes garçons, associations et membres concernés.',detail:'Toutes les données rattachées seront supprimées définitivement.'}))return;
      try{const out=await FCK.save('delete-sector',{id});FCK.toast(out?.message||'Secteur et données liées supprimés.');data=await FCK.loadData(true);render()}catch(err){FCK.toast(err.message,'error')}return;
    }
    approvalDelete('delete-sector',id,'secteur et toutes les données qui lui sont liées',async()=>{data=await FCK.loadData(true);render()});
  }
  async function removeYoung(type,id,after){
    const action=type==='girls'?'delete-girl':'delete-boy';
    if(isAdmin()){
      if(!await FCK.confirmPopup({title:'Confirmer la suppression',message:'Voulez-vous vraiment supprimer cet élément ?',detail:'Cette opération est définitive.'}))return;
      try{await FCK.save(action,{id});FCK.toast('Élément supprimé.');data=await FCK.loadData(true);render();after?.()}catch(err){FCK.toast(err.message,'error')}return;
    }
    approvalDelete(action,id,'élément',async()=>{data=await FCK.loadData(true);render();after?.()});
  }
  function approvalDelete(action,id,label,after){
    FCK.modal({title:'Autorisation Administrateur requise',html:`<div class="alert alert-warn">La suppression de cet ${label} par un Agent nécessite le mot de passe d’un Administrateur.</div><form id="approvalDelete" class="form-grid"><div class="field full"><label>Mot de passe Administrateur *</label><input class="input" type="password" name="admin_password" required autocomplete="off"></div><div class="field full"><div class="modal-actions"><button class="btn btn-danger" type="submit">Autoriser et supprimer</button></div></div></form>`,onReady:(wrap,close)=>wrap.querySelector('#approvalDelete').addEventListener('submit',async e=>{e.preventDefault();try{await FCK.save(action,{id,admin_password:new FormData(e.currentTarget).get('admin_password')});FCK.toast('Suppression effectuée.');close();await after?.()}catch(err){FCK.toast(err.message,'error')}})});
  }

  document.addEventListener('fck:ready',e=>{data=e.detail;if(data)render()});
})();
