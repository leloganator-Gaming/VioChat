(() => {
  const $ = id => document.getElementById(id);
  const toast = text => { const el=$('toast'); el.textContent=text; el.classList.add('show'); clearTimeout(window.__wolfToast); window.__wolfToast=setTimeout(()=>el.classList.remove('show'),3500); };
  $('play-now').addEventListener('click',()=>{ $('home').classList.add('hidden'); $('lobby').classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); });
  $('back-home').addEventListener('click',()=>{ $('lobby').classList.add('hidden'); $('home').classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); });
  $('quick-join').addEventListener('click',()=>toast('Les parties en ligne seront activées après la configuration de Supabase.'));
  $('create-room').addEventListener('click',()=>toast('La création de salons sera disponible avec le serveur multijoueur.'));
  $('profile-btn').addEventListener('click',()=>toast('Les profils joueurs arrivent dans une prochaine étape.'));
})();