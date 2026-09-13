(()=>{
  let data=null;
  function n(v){return Number(v||0)}
  function render(){
    if(!data)return;
    if(!FCK.guardPage(data,'reports'))return;
    if(FCK.subscriptionGate(data,'#protectedMain'))return;
    const totals=data.report?.totals||{};
    const totalYoung=n(totals.girls)+n(totals.boys);
    document.getElementById('reportStats').innerHTML=`
      <div class="stat"><small>Secteurs</small><strong>${n(totals.sectors)}</strong></div>
      <div class="stat"><small>Responsables secteurs</small><strong>${n(totals.responsibles)}</strong></div>
      <div class="stat"><small>Associations</small><strong>${n(totals.associations)}</strong></div>
      <div class="stat"><small>Membres associations</small><strong>${n(totals.association_members)}</strong></div>
      <div class="stat"><small>Jeunes filles</small><strong>${n(totals.girls)}</strong></div>
      <div class="stat"><small>Jeunes garçons</small><strong>${n(totals.boys)}</strong></div>`;
    const rows=data.report?.by_sector||[];
    document.getElementById('reportTable').innerHTML=`<table id="reportPrintable"><thead><tr><th>Secteur</th><th>Localité</th><th>Resp. secteur</th><th>Resp. jeunes filles</th><th>Resp. jeunes garçons</th><th>Associations</th><th>Jeunes filles</th><th>Jeunes garçons</th><th>Total jeunes</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${FCK.esc(r.name||'—')}</td><td>${FCK.esc(r.locality||'—')}</td><td>${FCK.esc(r.sector_responsible_name||'—')}</td><td>${FCK.esc(r.girls_responsible_name||'—')}</td><td>${FCK.esc(r.boys_responsible_name||'—')}</td><td>${n(r.associations)}</td><td>${n(r.girls)}</td><td>${n(r.boys)}</td><td><strong>${n(r.girls)+n(r.boys)}</strong></td></tr>`).join('')||'<tr><td colspan="9">Aucun secteur enregistré.</td></tr>'}<tr><td colspan="5"><strong>TOTAL GÉNÉRAL</strong></td><td><strong>${n(totals.associations)}</strong></td><td><strong>${n(totals.girls)}</strong></td><td><strong>${n(totals.boys)}</strong></td><td><strong>${totalYoung}</strong></td></tr></tbody></table>`;
    const assoc=data.report?.by_association||[];
    document.getElementById('associationReportTable').innerHTML=`<table><thead><tr><th>Association</th><th>Responsable</th><th>Sigle</th><th>Domaine</th><th>Localité</th><th>Membres</th></tr></thead><tbody>${assoc.map(a=>`<tr><td>${FCK.esc(a.name||'—')}</td><td>${FCK.esc(a.responsible_name||'—')}</td><td>${FCK.esc(a.acronym||'—')}</td><td>${FCK.esc(a.activity_area||'—')}</td><td>${FCK.esc(a.locality||'—')}</td><td>${n(a.members)}</td></tr>`).join('')||'<tr><td colspan="6">Aucune association enregistrée.</td></tr>'}<tr><td colspan="5"><strong>TOTAL ASSOCIATIONS : ${n(totals.associations)}</strong></td><td><strong>${n(totals.association_members)}</strong></td></tr></tbody></table>`;
    const canPrint=data.user.role==='superadmin'||data.user.role==='admin'||data.access?.can_print!==false;
    document.getElementById('reportAction').innerHTML=canPrint?'<button id="printReport" class="btn btn-outline">🖨 Imprimer PDF</button>':'';
    document.getElementById('printReport')?.addEventListener('click',()=>{
      const wrap=document.createElement('div');
      wrap.innerHTML=`<h3>Indicateurs généraux</h3>${document.getElementById('reportStats').outerHTML}<h3 style="margin-top:14px">Résumé par secteur</h3>${document.getElementById('reportTable').innerHTML}<h3 style="margin-top:14px">Résumé des associations</h3>${document.getElementById('associationReportTable').innerHTML}`;
      FCK.printProfessional({title:'Rapport général',subtitle:'Synthèse consolidée des activités et bénéficiaires',source:wrap,orientation:'landscape'});
    });
  }
  document.addEventListener('fck:ready',e=>{data=e.detail;if(data)render()});
})();
