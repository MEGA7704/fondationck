(()=>{
  function init(){
    document.getElementById('forgotPageBtn')?.addEventListener('click',()=>FCK.showForgotModal());
    document.getElementById('loginPageForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),btn=e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;try{const r=await FCK.api('/api/login',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})});sessionStorage.setItem('fckJustLoggedIn','1');const next=new URLSearchParams(location.search).get('next');location.href=r.user.role==='superadmin'?'/superadmin.html':(next||'/index.html');}catch(err){FCK.toast(err.message);btn.disabled=false}});
    document.getElementById('registerForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),btn=e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;try{const r=await FCK.api('/api/register',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});FCK.toast(r.message);setTimeout(()=>location.href='/connexion.html',700);}catch(err){FCK.toast(err.message);btn.disabled=false}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
