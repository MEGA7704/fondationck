(()=>{
  let timer=null;
  let activeIndex=0;
  const ROTATE_MS=6000;

  function safeImageUrl(value){
    if(!value) return '';
    try{
      const u=new URL(value,location.origin);
      if(u.protocol==='http:'||u.protocol==='https:') return u.href;
    }catch{}
    return '';
  }

  function renderCarousel(news){
    const carousel=document.getElementById('heroNewsCarousel');
    if(!carousel) return;
    if(!Array.isArray(news)||!news.length){
      carousel.innerHTML='<div class="hero-news-empty"><strong>Aucune nouvelle publiée pour le moment.</strong><span>Les prochaines actualités apparaîtront ici.</span></div>';
      return;
    }

    const items=news.slice(0,8);
    carousel.innerHTML='';
    const stage=document.createElement('div');
    stage.className='hero-news-stage';
    const dots=document.createElement('div');
    dots.className='hero-news-dots';
    dots.setAttribute('aria-label','Choisir une actualité');

    items.forEach((n,i)=>{
      const link=document.createElement('a');
      link.className='hero-news-slide'+(i===0?' active':'');
      link.href='/actualite.html?id='+encodeURIComponent(n.id);
      link.setAttribute('aria-hidden',i===0?'false':'true');
      link.setAttribute('aria-label','Lire : '+(n.title||'Actualité'));

      const image=safeImageUrl(n.image_url);
      if(image){
        const img=document.createElement('img');
        img.src=image;
        img.alt=n.title||'Actualité LA FONDATION CK';
        img.loading=i===0?'eager':'lazy';
        img.decoding='async';
        link.appendChild(img);
      }else{
        const fallback=document.createElement('div');
        fallback.className='hero-news-fallback';
        fallback.textContent='LA FONDATION CK';
        link.appendChild(fallback);
      }

      const shade=document.createElement('div');
      shade.className='hero-news-shade';
      const caption=document.createElement('div');
      caption.className='hero-news-caption';
      const date=document.createElement('div');
      date.className='hero-news-date';
      date.textContent=FCK.fmtDate(n.published_at);
      const title=document.createElement('h2');
      title.textContent=n.title||'Nouvelle du jour';
      const summary=document.createElement('p');
      summary.textContent=n.summary||'Cliquez pour lire la publication complète.';
      const cta=document.createElement('span');
      cta.className='hero-news-cta';
      cta.textContent='Lire la suite →';
      caption.append(date,title,summary,cta);
      link.append(shade,caption);
      stage.appendChild(link);

      const dot=document.createElement('button');
      dot.type='button';
      dot.className='hero-news-dot'+(i===0?' active':'');
      dot.setAttribute('aria-label','Actualité '+(i+1));
      dot.addEventListener('click',()=>show(i,true));
      dots.appendChild(dot);
    });

    carousel.append(stage,dots);
    activeIndex=0;

    function show(index,userAction=false){
      const slides=[...stage.querySelectorAll('.hero-news-slide')];
      const dotEls=[...dots.querySelectorAll('.hero-news-dot')];
      if(!slides.length) return;
      activeIndex=(index+slides.length)%slides.length;
      slides.forEach((slide,i)=>{
        const on=i===activeIndex;
        slide.classList.toggle('active',on);
        slide.setAttribute('aria-hidden',on?'false':'true');
        slide.tabIndex=on?0:-1;
      });
      dotEls.forEach((dot,i)=>dot.classList.toggle('active',i===activeIndex));
      if(userAction) restart();
    }

    function start(){
      if(items.length<2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      stop();
      timer=setInterval(()=>show(activeIndex+1),ROTATE_MS);
    }
    function stop(){ if(timer){clearInterval(timer);timer=null;} }
    function restart(){ stop(); start(); }

    carousel.addEventListener('mouseenter',stop);
    carousel.addEventListener('mouseleave',start);
    carousel.addEventListener('focusin',stop);
    carousel.addEventListener('focusout',start);
    document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
    start();
  }

  async function render(){
    const carousel=document.getElementById('heroNewsCarousel');
    try{
      const r=await fetch('/api/public-home',{credentials:'same-origin'});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||'Erreur');
      const c=d.content||{};
      document.getElementById('heroPresentation').textContent=c.presentation||'LA FONDATION CK agit au service de la solidarité, de la cohésion sociale et du développement humain.';
      document.getElementById('missionText').textContent=c.mission||'Créer des actions utiles, inclusives et durables.';
      document.getElementById('visionText').textContent=c.vision||'Construire une communauté solidaire.';
      document.getElementById('perspectivesText').textContent=c.perspectives||'Étendre progressivement les secteurs d’intervention.';
      renderCarousel(d.news||[]);
    }catch(e){
      if(carousel) carousel.innerHTML=`<div class="hero-news-empty"><strong>Actualités momentanément indisponibles.</strong><span>${FCK.esc(e.message)}</span></div>`;
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',render);
  else render();
})();
