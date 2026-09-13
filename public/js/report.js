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
      <div class="stat"><small>Responsables</small><strong>${n(totals.responsibles)}</strong></div>
      <div class="stat"><small>Jeunes filles</small><strong>${n(totals.girls)}</strong></div>
      <div class="stat"><small>Jeunes garçons</small><strong>${n(totals.boys)}</strong></div>`;
    const rows=data.report?.by_sector||[];
    document.getElementById('reportTable').innerHTML=`<table id="reportPrintable"><thead><tr><th>Secteur</th><th>Localité</th><th>Village</th><th>Responsables</th><th>Jeunes filles</th><th>Jeunes garçons</th><th>Total jeunes</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${FCK.esc(r.name||'—')}</td><td>${FCK.esc(r.locality||'—')}</td><td>${FCK.esc(r.village||'—')}</td><td>${n(r.responsibles)}</td><td>${n(r.girls)}</td><td>${n(r.boys)}</td><td><strong>${n(r.girls)+n(r.boys)}</strong></td></tr>`).join('')||'<tr><td colspan="7">Aucun secteur enregistré.</td></tr>'}<tr><td colspan="3"><strong>TOTAL GÉNÉRAL</strong></td><td><strong>${n(totals.responsibles)}</strong></td><td><strong>${n(totals.girls)}</strong></td><td><strong>${n(totals.boys)}</strong></td><td><strong>${totalYoung}</strong></td></tr></tbody></table>`;
    const canPrint=data.user.role==='superadmin'||data.user.role==='admin'||data.access?.can_print!==false;
    document.getElementById('reportAction').innerHTML=canPrint?'<button id="printReport" class="btn btn-outline">🖨 Imprimer le rapport</button>':'';
    document.getElementById('printReport')?.addEventListener('click',()=>{
      const old=document.title;document.title='Rapport — LA FONDATION CK';document.body.classList.add('printing-list');
      const clean=()=>{document.body.classList.remove('printing-list');document.title=old;window.removeEventListener('afterprint',clean)};
      window.addEventListener('afterprint',clean);window.print();setTimeout(clean,1500);
    });
  }
  document.addEventListener('fck:ready',e=>{data=e.detail;if(data)render()});
})();
