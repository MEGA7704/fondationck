(async()=>{
  async function init(){
    try{const r=await fetch('/api/public-home');const d=await r.json();const c=d.content||{};document.getElementById('contactInfo').innerHTML=`<h3>LA FONDATION CK</h3><p><strong>Téléphone :</strong> ${FCK.esc(c.contact_phone||'À renseigner')}</p><p><strong>WhatsApp :</strong> ${FCK.esc(c.whatsapp||'À renseigner')}</p><p><strong>E-mail :</strong> ${FCK.esc(c.contact_email||'À renseigner')}</p><p><strong>Adresse :</strong> ${FCK.esc(c.address||'Côte d’Ivoire')}</p>`;}catch{}
    document.getElementById('contactForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),btn=e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;try{const d=await FCK.api('/api/contact',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});FCK.toast(d.message);e.currentTarget.reset();}catch(err){FCK.toast(err.message)}finally{btn.disabled=false}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
