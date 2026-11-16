(() => {
  'use strict';
  const cfg=window.WOLFANATOR_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
  const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let user=null,profile=null,active='home',mounted=false;
  const notify=m=>{const el=$('#toast');if(el){el.textContent=m;el.classList.add('show');clearTimeout(window.__wolfExtraToast);window.__wolfExtraToast=setTimeout(()=>el.classList.remove('show'),3500);}else alert(m);};
  const shell=()=>`
    <section class="wx-shell" id="wolf-extra-app">
      <div class="wx-heading"><div><p class="eyebrow">LE VILLAGE WOLFANATOR</p><h2>Communauté <em>& progression</em></h2></div><div class="wx-balance" id="wx-balance">🌙 … Lunes</div></div>
      <nav class="wx-nav" aria-label="Navigation du village">
        <button data-wx-tab="home" class="active">🏡 Vue d'ensemble</button>
        <button data-wx-tab="roles">🎭 Rôles</button>
        <button data-wx-tab="ranking">🏆 Classement</button>
        <button data-wx-tab="friends">👥 Amis</button>
        <button data-wx-tab="shop">🛍️ Boutique</button>
        <button data-wx-tab="profile">🪪 Mon profil</button>
        <button data-wx-tab="report">🚩 Signaler</button>
      </nav>
      <div class="wx-content" id="wx-content"><p>Chargement du village…</p></div>
    </section>`;
  function mount(){
    const lobby=$('#lobby');if(!lobby||mounted||lobby.classList.contains('hidden'))return;
    const grid=$('.lobby-grid',lobby);if(!grid)return;
    grid.insertAdjacentHTML('afterend',shell());mounted=true;
    $('#wolf-extra-app').addEventListener('click',e=>{
      const tab=e.target.closest('[data-wx-tab]');if(tab){active=tab.dataset.wxTab;render();}
      const action=e.target.closest('[data-wx-action]');if(action)handleAction(action.dataset.wxAction,action.dataset);
    });
    $('#wolf-extra-app').addEventListener('submit',e=>{if(e.target.matches('[data-wx-form]')){e.preventDefault();if(e.target.dataset.wxForm==='report')handleReport(e.target);else handleForm(e.target);}});
    const syncSession=async(nextUser)=>{user=nextUser||null;profile=null;if(user){await loadProfile();await render();}else{profile=null;const balance=$('#wx-balance');if(balance)balance.textContent='🌙 Connectez-vous';const pane=$('#wx-content');if(pane)pane.innerHTML='<p>Connectez-vous pour accéder aux fonctions communautaires.</p>';}};db.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>syncSession(session?.user||null),0);});db.auth.getUser().then(({data})=>syncSession(data.user));
  }
  async function loadProfile(){
    const {data,error}=await db.from('profiles').select('username,avatar,moon_balance,xp,level,laurel_count,bio').eq('id',user.id).maybeSingle();
    if(error){console.warn(error);return;}profile=data;
    $('#wx-balance').textContent='🌙 '+(profile?.moon_balance??0)+' Lunes';
  }
  function nav(){document.querySelectorAll('[data-wx-tab]').forEach(b=>b.classList.toggle('active',b.dataset.wxTab===active));}
  async function render(){
    if(!user){$('#wx-content').innerHTML='<p>Connectez-vous pour continuer.</p>';return;}
    nav();await loadProfile();
    const pane=$('#wx-content');pane.innerHTML='<p>Chargement…</p>';
    if(active==='home')pane.innerHTML=home();
    if(active==='roles')await rolesPane(pane);
    if(active==='ranking')await rankingPane(pane);
    if(active==='friends')await friendsPane(pane);
    if(active==='shop')await shopPane(pane);
    if(active==='profile')await profilePane(pane);
    if(active==='report')reportPane(pane);
  }
  function home(){
    const xp=profile?.xp||0,level=profile?.level||1,next=level*level*100;
    return `<div class="wx-welcome"><div><p class="eyebrow">TON AVENTURE CONTINUE</p><h3>Bienvenue, ${esc(profile?.username||'joueur')} !</h3><p>Retrouve les rôles, ton classement, tes amis et les objets à collectionner.</p></div><div class="wx-level"><strong>Niv. ${level}</strong><span>${xp} XP</span><div class="wx-progress"><i style="width:${Math.min(100,Math.round((xp%Math.max(1,next))/Math.max(1,next)*100))}%"></i></div></div></div>
    <div class="wx-tiles">
      <button data-wx-tab="roles"><b>🎭</b><strong>21 rôles principaux · 9 variantes</strong><small>Consulter le guide du jeu</small></button>
      <button data-wx-tab="ranking"><b>🏆</b><strong>Classement</strong><small>Comparer les performances</small></button>
      <button data-wx-tab="friends"><b>👥</b><strong>Amis</strong><small>Retrouver les joueurs</small></button>
      <button data-wx-tab="shop"><b>🛍️</b><strong>Boutique</strong><small>Personnaliser ton avatar</small></button>
    </div><p class="wx-note">Les rôles affichés dans le guide constituent le catalogue prévu. Tous leurs pouvoirs ne sont pas encore activés dans le moteur de partie.</p>`;
  }
  async function rolesPane(pane){
    const {data,error}=await db.from('wolfanator_roles').select('*').order('sort_order');
    if(error){pane.innerHTML='<p>Catalogue indisponible : '+esc(error.message)+'</p>';return;}
    const draw=(rows)=>pane.querySelector('.wx-role-list').innerHTML=rows.map(r=>`<article class="wx-role"><div class="wx-role-icon">${r.camp==='loups'?'🐺':r.camp==='solitaire'?'🌘':'🏡'}</div><div><strong>${esc(r.role_name)} ${r.is_variant?'<small>VARIANTE</small>':''}</strong><p>${esc(r.description)}</p><span>${r.camp==='loups'?'Camp des loups':r.camp==='solitaire'?'Camp solitaire':'Camp du village'} ${r.alpha_only?' · Alpha':''}</span></div></article>`).join('')||'<p>Aucun rôle trouvé.</p>';
    pane.innerHTML=`<div class="wx-section-title"><div><h3>Encyclopédie des rôles</h3><p>Les rôles et variantes disponibles dans le catalogue Wolfanator.</p></div><input class="wx-search" id="wx-role-search" placeholder="Rechercher un rôle…"></div><div class="wx-role-list"></div>`;
    draw(data||[]);$('#wx-role-search',pane).addEventListener('input',e=>{const q=e.target.value.toLocaleLowerCase('fr');draw((data||[]).filter(r=>(r.role_name+' '+r.description+' '+r.camp).toLocaleLowerCase('fr').includes(q)));});
  }
  async function rankingPane(pane){
    const {data,error}=await db.rpc('get_wolfanator_leaderboard');
    if(error){pane.innerHTML='<p>Classement indisponible : '+esc(error.message)+'</p>';return;}
    const rows=Array.isArray(data)?data:[];
    pane.innerHTML='<div class="wx-section-title"><div><h3>Classement Wolfanator</h3><p>Les performances sont calculées à partir des parties terminées.</p></div></div>'+
      (rows.length?'<div class="wx-table">'+rows.map((p,i)=>`<div class="wx-rank-row"><b>#${p.rank||i+1}</b><strong>${esc(p.username)}</strong><span>${p.laurels||0} lauriers · ${p.wins||0} victoires / ${p.games||0} parties</span><em>🌙 ${p.lunes||0}</em></div>`).join('')+'</div>':'<div class="wx-empty">Le classement apparaîtra après les premières parties terminées.</div>');
  }
  async function friendsPane(pane){
    const {data,error}=await db.from('wolfanator_friendships').select('id,requester_id,addressee_id,status,created_at').or('requester_id.eq.'+user.id+',addressee_id.eq.'+user.id).order('created_at',{ascending:false});
    if(error){pane.innerHTML='<p>Liste des amis indisponible : '+esc(error.message)+'</p>';return;}
    const rows=data||[],ids=[...new Set(rows.flatMap(x=>[x.requester_id,x.addressee_id]).filter(x=>x!==user.id))];
    let people={};if(ids.length){const p=await db.from('profiles').select('id,username,level').in('id',ids);(p.data||[]).forEach(x=>people[x.id]=x);}
    pane.innerHTML=`<div class="wx-section-title"><div><h3>Amis du village</h3><p>Ajoute des joueurs avec leur pseudo Wolfanator.</p></div></div>
      <form class="wx-form" data-wx-form="friend"><input name="username" minlength="3" maxlength="20" placeholder="Pseudo du joueur" required><button class="wx-primary">Envoyer une demande</button></form>
      <div class="wx-friend-list">${rows.length?rows.map(x=>{const incoming=x.addressee_id===user.id&&x.status==='pending',other=x.requester_id===user.id?x.addressee_id:x.requester_id,p=people[other]||{};return `<div class="wx-friend"><div><strong>${esc(p.username||'Joueur')}</strong><small>Niveau ${p.level||1} · ${x.status==='accepted'?'Ami':incoming?'Demande reçue':'Demande envoyée'}</small></div>${incoming?`<div class="wx-actions"><button data-wx-action="friend-accept" data-id="${x.id}" class="wx-primary">Accepter</button><button data-wx-action="friend-decline" data-id="${x.id}" class="wx-secondary">Refuser</button></div>`:''}</div>`}).join(''):'<div class="wx-empty">Tu n’as pas encore d’amis. Envoie ta première demande !</div>'}</div>`;
  }
  function reportPane(pane){
    pane.innerHTML='<div class="wx-section-title"><div><h3>Signaler un comportement</h3><p>Transmets un signalement à l’administration Wolfanator.</p></div></div><form class="wx-form wx-bio-form" data-wx-form="report"><label for="wx-report-user">Pseudo du joueur</label><input id="wx-report-user" name="username" minlength="3" maxlength="20" placeholder="Pseudo exact" required><label for="wx-report-reason">Motif</label><select id="wx-report-reason" name="reason"><option value="harassment">Harcèlement</option><option value="spam">Spam</option><option value="cheating">Triche</option><option value="inappropriate_name">Pseudo inapproprié</option><option value="other">Autre</option></select><label for="wx-report-details">Détails (facultatif)</label><textarea id="wx-report-details" name="details" maxlength="1000" placeholder="Explique brièvement ce qui s’est passé…"></textarea><button class="wx-primary">Envoyer le signalement</button></form>';
  }
  async function handleReport(form){
    const fd=new FormData(form),username=String(fd.get('username')||'').trim();
    const found=await db.from('profiles').select('id').ilike('username',username).maybeSingle();
    if(found.error||!found.data)return notify('Joueur introuvable.');
    if(found.data.id===user.id)return notify('Vous ne pouvez pas vous signaler vous-même.');
    const result=await db.from('wolfanator_reports').insert({reporter_id:user.id,reported_user_id:found.data.id,reason:String(fd.get('reason')||'other'),details:String(fd.get('details')||'').trim()});
    if(result.error)return notify(result.error.message);
    notify('Signalement transmis à la modération.');
    form.reset();
  }
  async function shopPane(pane){
    const [{data:items,error},{data:owned}]=await Promise.all([
      db.from('wolfanator_cosmetics').select('*').eq('active',true).order('price_lunes'),
      db.from('wolfanator_user_cosmetics').select('cosmetic_id,equipped').eq('user_id',user.id)
    ]);
    if(error){pane.innerHTML='<p>Boutique indisponible : '+esc(error.message)+'</p>';return;}
    const inventory=new Map((owned||[]).map(x=>[x.cosmetic_id,x]));
    pane.innerHTML='<div class="wx-section-title"><div><h3>Boutique du village</h3><p>Achète directement des objets cosmétiques avec tes Lunes. Aucun tirage aléatoire.</p></div></div><div class="wx-shop-grid">'+(items||[]).map(x=>{const inv=inventory.get(x.id);return `<article class="wx-item"><div class="wx-item-icon">${esc(x.emoji)}</div><strong>${esc(x.name)}</strong><small>${esc(x.rarity)} · ${esc(x.slot)}</small><p>${esc(x.description)}</p><div class="wx-item-foot"><b>${inv?'Possédé':x.price_lunes+' 🌙'}</b>${inv?`<button class="wx-secondary" data-wx-action="equip" data-slug="${esc(x.slug)}">${inv.equipped?'Équipé':'Équiper'}</button>`: `<button class="wx-primary" data-wx-action="buy" data-slug="${esc(x.slug)}">Acheter</button>`}</div></article>`}).join('')+'</div>';
  }
  async function profilePane(pane){
    const [{data:history,error}, {data:inv}]=await Promise.all([
      db.from('game_history').select('won,role_key,rounds,finished_at').eq('user_id',user.id).order('finished_at',{ascending:false}).limit(500),
      db.from('wolfanator_user_cosmetics').select('cosmetic_id,equipped').eq('user_id',user.id)
    ]);
    if(error){pane.innerHTML='<p>Profil indisponible : '+esc(error.message)+'</p>';return;}
    const rows=history||[],wins=rows.filter(x=>x.won).length,rate=rows.length?Math.round(wins/rows.length*100):0;
    pane.innerHTML=`<div class="wx-section-title"><div><h3>Mon profil joueur</h3><p>Ta progression et tes statistiques de partie.</p></div></div>
      <div class="wx-stats"><div><b>${rows.length}</b><small>Parties</small></div><div><b>${wins}</b><small>Victoires</small></div><div><b>${rate}%</b><small>Taux de victoire</small></div><div><b>${profile?.laurel_count||0}</b><small>Lauriers</small></div></div>
      <div class="wx-profile-card"><div><strong>${esc(profile?.username||'Joueur')}</strong><small>Niveau ${profile?.level||1} · ${profile?.xp||0} XP · ${inv?.length||0} objets</small></div></div>
      <form class="wx-form wx-bio-form" data-wx-form="bio"><label for="wx-bio">Présentation</label><textarea id="wx-bio" name="bio" maxlength="180" placeholder="Présente-toi au village…">${esc(profile?.bio||'')}</textarea><button class="wx-primary">Enregistrer ma présentation</button></form>
      <h4>Parties récentes</h4><div class="wx-table">${rows.slice(0,8).map(x=>`<div class="wx-rank-row"><strong>${esc(x.role_key)}</strong><span>${new Date(x.finished_at).toLocaleDateString('fr-FR')}</span><em class="${x.won?'wx-win':'wx-loss'}">${x.won?'Victoire':'Défaite'}</em></div>`).join('')||'<div class="wx-empty">Aucune partie terminée pour le moment.</div>'}</div>`;
  }
  async function handleForm(form){
    const fd=new FormData(form),kind=form.dataset.wxForm;
    if(kind==='friend'){const {error}=await db.rpc('request_wolfanator_friend',{p_username:String(fd.get('username')||'').trim()});if(error)return notify(error.message);notify('Demande envoyée.');}
    if(kind==='bio'){const bio=String(fd.get('bio')||'').trim();const {error}=await db.from('profiles').update({bio}).eq('id',user.id);if(error)return notify(error.message);notify('Présentation enregistrée.');}
    await render();
  }
  async function handleAction(action,data){
    let result;
    if(action==='friend-accept'||action==='friend-decline'){
      result=await db.from('wolfanator_friendships').update({status:action==='friend-accept'?'accepted':'declined'}).eq('id',data.id);
    }else if(action==='buy'){
      result=await db.rpc('buy_wolfanator_cosmetic',{p_slug:data.slug});
    }else if(action==='equip'){
      result=await db.rpc('equip_wolfanator_cosmetic',{p_slug:data.slug});
    }
    if(result?.error)return notify(result.error.message);
    notify(action==='buy'?'Objet ajouté à ton inventaire.':action==='equip'?'Objet équipé.':'Demande mise à jour.');
    await render();
  }
  function observe(){
    const lobby=$('#lobby');if(!lobby)return;
    new MutationObserver(()=>mount()).observe(lobby,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    mount();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();