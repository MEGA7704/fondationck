(async()=>{
  async function render(){
    try{
      const r=await fetch('/api/public-home',{credentials:'same-origin'}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Erreur');
      const c=d.content||{};
      document.getElementById('heroPresentation').textContent=c.presentation||'LA FONDATION CK agit au service de la solidarité, de la cohésion sociale et du développement humain.';
      document.getElementById('missionText').textContent=c.mission||'Créer des actions utiles, inclusives et durables.';
      document.getElementById('visionText').textContent=c.vision||'Construire une communauté solidaire.';
      document.getElementById('perspectivesText').textContent=c.perspectives||'Étendre progressivement les secteurs d’intervention.';
      const grid=document.getElementById('newsGrid');
      if(!d.news?.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1">Aucune nouvelle publiée pour le moment.</div>';return;}
      grid.innerHTML=d.news.map(n=>`<a class="news-card" href="/actualite.html?id=${encodeURIComponent(n.id)}"><div class="news-thumb">${n.image_url?`<img src="${n.image_url}" alt="${FCK.esc(n.title)}" loading="lazy" decoding="async">`:'<img src="/assets/logo-fondation-ck.png" alt="Logo LA FONDATION CK" loading="lazy" decoding="async" style="object-fit:contain;padding:20px;background:#fff">'}</div><div class="news-body"><div class="news-date">${FCK.fmtDate(n.published_at)}</div><h3>${FCK.esc(n.title)}</h3><p>${FCK.esc(n.summary||'Lire la publication complète')}</p></div></a>`).join('');
    }catch(e){document.getElementById('newsGrid').innerHTML=`<div class="empty-state" style="grid-column:1/-1">${FCK.esc(e.message)}</div>`}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();
