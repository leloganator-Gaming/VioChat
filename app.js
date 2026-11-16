(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = s => { const el=$('toast'); el.textContent=s; el.classList.add('show'); clearTimeout(window.__wolfToast); window.__wolfToast=setTimeout(()=>el.classList.remove('show'),4200); };
  const cfg=window.WOLFANATOR_CONFIG||{}, configured=!!(cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase);
  const sb=configured?window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey):null;
  let currentRoom=null,channel=null,profileName='',currentUserId='',refreshing=false;
  const roles={wolf:'Loup-garou',seer:'Voyante',healer:'Protecteur',villager:'Villageois'};
  const icons={wolf:'🐺',seer:'🔮',healer:'🛡️',villager:'🏡'};
  const descriptions={wolf:'Chaque nuit, choisissez une personne à éliminer. Les loups gagnent lorsqu’ils sont aussi nombreux que les autres joueurs encore en vie.',seer:'Chaque nuit, examinez un joueur pour découvrir secrètement son rôle. Aidez le village à trouver les loups.',healer:'Chaque nuit, choisissez une personne à protéger. Si les loups la ciblent, elle survit.',villager:'Vous n’avez pas de pouvoir nocturne. Le jour, discutez et votez pour éliminer les loups.'};

  const auth=document.createElement('div'); auth.className='panel account-panel';
  auth.innerHTML='<div class="auth-tabs"><button type="button" class="auth-tab active" id="wolf-tab-login">Connexion</button><button type="button" class="auth-tab" id="wolf-tab-signup">Créer un compte</button></div><h3 id="wolf-auth-title">Ravi de vous revoir</h3><div class="field-grid auth-fields"><input id="wolf-email" type="email" autocomplete="email" placeholder="Adresse e-mail"><input id="wolf-password" type="password" autocomplete="current-password" placeholder="Mot de passe (6 caractères minimum)"><input id="wolf-pseudo" maxlength="20" minlength="3" placeholder="Pseudo (3 à 20 caractères)" hidden></div><div class="button-row"><button class="primary wide" id="wolf-login">Se connecter</button><button class="primary wide" id="wolf-signup" hidden>Créer mon compte</button><button class="ghost" id="wolf-logout" hidden>Déconnexion</button></div><small id="wolf-auth-status">Connectez-vous pour créer ou rejoindre un salon.</small>';
  $('auth-mount').appendChild(auth);
  const profile=document.createElement('div'); profile.className='panel profile-panel';
  profile.innerHTML='<p class="eyebrow">VOTRE IDENTITÉ</p><h3>Mon profil joueur</h3><div class="field-grid"><input id="wolf-profile-name" maxlength="20" minlength="3" placeholder="Votre pseudo"><select id="wolf-avatar" aria-label="Avatar"><option value="🐺">🐺 Loup</option><option value="🦊">🦊 Renard</option><option value="🦉">🦉 Hibou</option><option value="🐱">🐱 Chat</option><option value="🐻">🐻 Ours</option><option value="🦇">🦇 Chauve-souris</option><option value="👻">👻 Fantôme</option><option value="🧙">🧙 Mage</option></select><button class="secondary" id="wolf-save-profile">Enregistrer le profil</button></div><div class="profile-preview" id="wolf-profile-preview"><span>🐺</span><strong>Votre profil</strong></div><small>Votre pseudo et votre avatar seront affichés dans les salons.</small><div id="wolf-stats" class="stats-panel"><small>Chargement des statistiques…</small></div>';
  $('lobby').appendChild(profile);
  const premium=document.createElement('div');premium.className='panel premium-panel';
  premium.innerHTML='<p class="eyebrow">ABONNEMENT PREMIUM</p><h3>🐺 Loup Alpha</h3><div class="premium-price">10 € <small>/ mois</small></div><p>Un statut premium avec accès au rôle spécial Loup Alpha dans les parties compatibles.</p><div id="wolf-premium-status" class="premium-status">Vérification de votre accès…</div>';
  $('lobby').appendChild(premium);
  const panel=document.createElement('div'); panel.className='panel room-panel';
  panel.innerHTML='<p class="eyebrow">SALONS EN LIGNE</p><h3>Salons disponibles</h3><div class="field-grid room-fields"><input id="wolf-room-name" maxlength="40" placeholder="Nom du salon"><select id="wolf-room-max"><option value="5">5 joueurs</option><option value="8">8 joueurs</option><option value="10">10 joueurs</option><option value="12" selected>12 joueurs</option><option value="15">15 joueurs</option><option value="20">20 joueurs</option></select><button class="secondary" id="wolf-create">Créer un salon</button></div><div class="field-grid room-fields"><input id="wolf-room-code" maxlength="8" placeholder="Code du salon" autocomplete="off"><button class="secondary" id="wolf-join">Rejoindre avec un code</button></div><div id="wolf-rooms" class="room-list"><small>Les salons apparaîtront ici.</small></div><div id="wolf-current-room" class="current-room"></div>';
  $('lobby').appendChild(panel);
  const status=s=>$('wolf-auth-status').textContent=s;
  const pseudo=()=>($('wolf-profile-name').value||$('wolf-pseudo').value||profileName||'Joueur').trim();
  const needClient=()=>{if(!sb){toast('Connexion Supabase indisponible. Vérifiez config.js.');return false;}return true;};
  async function user(){if(!needClient())return null;const r=await sb.auth.getUser();if(r.error||!r.data.user){toast('Connectez-vous pour continuer.');return null;}return r.data.user;}
  async function loadProfile(u){
    const r=await sb.from('profiles').select('username,avatar').eq('id',u.id).maybeSingle();
    if(r.error){status('Connecté. Profil non chargé : '+r.error.message);return;}
    if(r.data&&r.data.username)profileName=r.data.username;
    else{let n=String(u.user_metadata?.username||u.email?.split('@')[0]||'Joueur').slice(0,20);if(n.length<3)n='Joueur';const w=await sb.from('profiles').upsert({id:u.id,username:n},{onConflict:'id'});if(!w.error)profileName=n;}
    $('wolf-profile-name').value=profileName;$('wolf-pseudo').value=profileName;$('wolf-avatar').value=r.data?.avatar?.emoji||'🐺';$('wolf-profile-preview').innerHTML='<span>'+esc($('wolf-avatar').value)+'</span><strong>'+esc(profileName)+'</strong>';await loadStats();
  }
  async function refreshAuth(){
    if(!sb)return;const r=await sb.auth.getSession(),session=r.data.session;
    $('wolf-logout').hidden=!session;$('wolf-logout-lobby').hidden=!session;$('wolf-login').hidden=!!session;$('wolf-signup').hidden=!!session;$('wolf-pseudo').hidden=!!session;
    profile.hidden=!session;panel.hidden=!session;premium.hidden=!session;
    if(session){$('auth-screen').classList.add('hidden');$('lobby').classList.remove('hidden');status('Connecté : '+(session.user.email||'joueur'));await loadProfile(session.user);await loadPremium();await loadRooms();}
    else{profileName='';status('Non connecté.');$('wolf-rooms').innerHTML='<small>Connectez-vous pour afficher les salons.</small>';}
  }
  async function loadPremium(){
    const box=$('wolf-premium-status');if(!box)return;
    const r=await sb.from('user_entitlements').select('entitlement_key,expires_at').eq('entitlement_key','wolf_alpha').maybeSingle();
    if(r.error){box.textContent='Statut indisponible.';return;}
    const active=!!r.data&&(!r.data.expires_at||new Date(r.data.expires_at)>new Date());
    box.innerHTML=active?'<strong class="premium-active">✓ Loup Alpha activé sur ce compte</strong>':'<strong>Préparation en cours</strong><small>Le paiement sécurisé et l’activation automatique seront ajoutés avant l’ouverture des abonnements.</small>';
  }
  async function loadStats(){
    const box=$('wolf-stats');if(!box)return;
    const r=await sb.from('game_history').select('room_name,role_key,won,rounds,finished_at').order('finished_at',{ascending:false}).limit(1000);
    if(r.error){box.innerHTML='<small>Statistiques indisponibles : '+esc(r.error.message)+'</small>';return;}
    const rows=r.data||[],wins=rows.filter(x=>x.won).length,losses=rows.length-wins,rate=rows.length?Math.round(wins/rows.length*100):0;
    box.innerHTML='<h4>Statistiques</h4><div class="stats-grid"><div><strong>'+rows.length+'</strong><small>Parties</small></div><div><strong>'+wins+'</strong><small>Victoires</small></div><div><strong>'+rate+'%</strong><small>Taux de victoire</small></div></div><h4>Dernières parties</h4>'+(rows.length?'<div class="history-list">'+rows.slice(0,10).map(x=>'<div class="history-row"><span><strong>'+esc(x.room_name)+'</strong><small>'+esc(roles[x.role_key]||x.role_key)+' · '+new Date(x.finished_at).toLocaleDateString('fr-FR')+'</small></span><b class="'+(x.won?'win':'loss')+'">'+(x.won?'Victoire':'Défaite')+'</b></div>').join('')+'</div>':'<small>Aucune partie terminée pour le moment.</small>');
  }
  async function authAction(mode){
    if(!needClient())return;const email=$('wolf-email').value.trim(),password=$('wolf-password').value,p=$('wolf-pseudo').value.trim();
    if(!email||password.length<6)return toast('Indiquez un e-mail et un mot de passe de 6 caractères minimum.');
    if(mode==='signup'&&(p.length<3||p.length>20))return toast('Le pseudo doit contenir entre 3 et 20 caractères.');
    const r=mode==='signup'?await sb.auth.signUp({email,password,options:{data:{username:p}}}):await sb.auth.signInWithPassword({email,password});
    if(r.error)return toast(r.error.message);
    if(mode==='signup'&&!r.data.session){status('Compte créé. Une confirmation par e-mail peut être nécessaire avant la première connexion.');return;}
    toast(mode==='signup'?'Compte créé.':'Connexion réussie.');await refreshAuth();
  }
  async function saveProfile(){
    const u=await user();if(!u)return;const n=$('wolf-profile-name').value.trim();
    if(n.length<3||n.length>20)return toast('Le pseudo doit contenir entre 3 et 20 caractères.');
    const emoji=$('wolf-avatar').value;const r=await sb.from('profiles').upsert({id:u.id,username:n,avatar:{emoji}},{onConflict:'id'});
    if(r.error)return toast(r.error.message);profileName=n;$('wolf-pseudo').value=n;$('wolf-profile-preview').innerHTML='<span>'+esc(emoji)+'</span><strong>'+esc(n)+'</strong>';toast('Profil enregistré.');
  }
  async function loadRooms(){
    const r=await sb.from('game_rooms').select('id,room_code,name,status,max_players,room_players(count)').in('status',['waiting','playing']).order('created_at',{ascending:false}).limit(30);
    if(r.error){$('wolf-rooms').textContent=r.error.message;return;}
    $('wolf-rooms').innerHTML=r.data.length?r.data.map(x=>'<div class="room-card"><span><strong>'+esc(x.name)+'</strong><small>'+(x.status==='playing'?'🎮 Partie en cours':'🏰 En attente')+' · Code '+esc(x.room_code)+' · '+(x.room_players?.[0]?.count||0)+'/'+x.max_players+' joueurs</small></span>'+(x.status==='playing'?'<button class="secondary" data-resume="'+x.id+'" data-code="'+esc(x.room_code)+'">Reprendre</button>':'<button class="secondary" data-enter="'+esc(x.room_code)+'">Rejoindre</button>')+'</div>').join(''):'<small>Aucun salon disponible. Créez-en un ou utilisez un code.</small>';
    $('wolf-rooms').querySelectorAll('[data-enter]').forEach(b=>b.addEventListener('click',()=>joinRoom(b.dataset.enter)));
    $('wolf-rooms').querySelectorAll('[data-resume]').forEach(b=>b.addEventListener('click',()=>openRoom(b.dataset.resume,b.dataset.code)));
  }
  async function createRoom(){
    const u=await user();if(!u)return;const r=await sb.rpc('create_game_room',{p_name:$('wolf-room-name').value.trim()||'Salon Wolfanator',p_max_players:Number($('wolf-room-max').value),p_display_name:pseudo()});
    if(r.error)return toast(r.error.message);await openRoom(r.data[0].room_id,r.data[0].room_code);
  }
  async function joinRoom(code){
    const u=await user();if(!u)return;const c=String(code||'').trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(c))return toast('Le code doit contenir 8 caractères.');
    const r=await sb.rpc('join_game_room',{p_room_code:c,p_display_name:pseudo()});if(r.error)return toast(r.error.message);await openRoom(r.data,c);
  }
  async function openRoom(id,code){
    currentRoom=id;if(channel)await sb.removeChannel(channel);
    channel=sb.channel('wolf-room-'+id).on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:'room_id=eq.'+id},refreshRoom).on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_rooms',filter:'id=eq.'+id},refreshRoom).on('postgres_changes',{event:'INSERT',schema:'public',table:'room_messages',filter:'room_id=eq.'+id},loadChat).subscribe();
    $('wolf-current-room').innerHTML='<div class="room-heading"><h3>Salon '+esc(code)+'</h3><button class="ghost" id="wolf-close-room">Fermer</button></div><div id="wolf-room-detail">Chargement…</div>';
    $('wolf-close-room').addEventListener('click',closeRoom);await refreshRoom();
  }
  function closeRoom(){currentRoom=null;if(channel&&sb)sb.removeChannel(channel);channel=null;$('wolf-current-room').innerHTML='';loadRooms();}
  function waitingHTML(room,players,u){
    const me=players.find(p=>p.user_id===u.id);
    return '<div class="game-status"><span class="phase-chip">🏰 Salon en attente</span><span>'+players.length+'/'+room.max_players+' joueurs</span></div><p>'+esc(room.name)+' · Code à partager : <strong class="room-code">'+esc(room.room_code)+'</strong></p><div class="player-grid">'+players.map(p=>'<div class="player-chip"><span>'+esc(p.display_name)+'</span><small>'+(p.user_id===room.host_id?'👑 Hôte':p.is_ready?'✓ Prêt':'En attente')+'</small></div>').join('')+'</div><div class="button-row"><button class="secondary" id="wolf-ready">'+(me?.is_ready?'Annuler prêt':'Je suis prêt')+'</button>'+(room.host_id===u.id?'<button class="primary" id="wolf-start">Lancer la partie</button>':'')+'<button class="ghost" id="wolf-leave">Quitter le salon</button></div><small>Il faut au moins 5 joueurs et que tout le monde soit prêt.</small>';
  }
  function gameHTML(s){
    const players=s.players||[],alive=players.filter(p=>p.is_alive),role=s.my_role,night=s.phase==='night',day=s.phase==='day',done=s.status==='finished'||s.phase==='finished';
    let desc=night?({wolf:'Choisissez une cible avec les autres loups.',seer:'Choisissez un joueur à examiner.',healer:'Choisissez une personne à protéger.',villager:'Vous êtes à l’abri cette nuit. Attendez le matin.'}[role]):'Le village débat. Votez pour la personne que vous pensez être un loup.';
    const canAct=!done&&s.my_alive&&(night&&['wolf','seer','healer'].includes(role)||day);
    const targets=alive.filter(p=>p.user_id!==(day||role==='seer'||role==='wolf'?currentUserId:''));
    const label=night?({wolf:'Désigner la cible',seer:'Examiner ce joueur',healer:'Protéger ce joueur'}[role]||''):'Voter contre ce joueur';
    const targetHTML=canAct?'<div class="target-grid">'+targets.map(p=>'<button class="target-button" data-target="'+p.user_id+'"><strong>'+esc(p.display_name)+'</strong><small>'+(p.is_host?'👑 Hôte':'Joueur')+' · '+label+'</small></button>').join('')+'</div>':'';
    const rows=players.map(p=>'<div class="player-chip '+(p.is_alive?'':'is-out')+'"><span>'+esc(p.display_name)+(p.is_host?' 👑':'')+'</span><small>'+(p.is_alive?'En jeu':'Éliminé'+(p.revealed_role?' · '+esc(roles[p.revealed_role]||p.revealed_role):''))+'</small></div>').join('');
    const winner=s.winner==='village'?'Le village a gagné !':s.winner==='loups'?'Les loups-garous ont gagné !':'Partie terminée';
    let html='<div class="game-status"><span class="phase-chip">'+(done?'🏁 Partie terminée':night?'🌙 Nuit':'☀️ Jour')+' · Manche '+s.round+'</span><span>'+alive.length+'/'+players.length+' encore en jeu</span></div>';
    html+='<div class="role-card"><div class="role-icon">'+(icons[role]||'🎭')+'</div><div><small>VOTRE RÔLE SECRET</small><h3>'+esc(roles[role]||'En attente')+'</h3><p>'+esc(descriptions[role]||'')+'</p></div></div>';
    if(role==='wolf'&&s.wolf_team?.length)html+='<p class="team-note">Vos alliés : '+s.wolf_team.map(esc).join(', ')+'</p>';
    if(s.last_event)html+='<div class="story-event">'+esc(s.last_event)+'</div>';
    if(role==='seer'&&s.seer_result)html+='<div class="seer-result">🔮 Votre vision : '+esc(s.seer_result.name)+' est '+esc(roles[s.seer_result.role]||s.seer_result.role)+'.</div>';
    if(done)html+='<div class="winner-card"><h3>'+winner+'</h3><p>Les rôles de tous les joueurs sont révélés.</p></div>';
    else{html+='<div class="action-area"><h3>'+(night?'Actions de la nuit':'Vote du village')+'</h3><p>'+esc(desc)+'</p>';
      if(canAct)html+='<p class="action-state">'+(s.my_action_submitted?'Votre choix est enregistré. Vous pouvez le modifier avant la fin de la phase.':'Vous n’avez pas encore envoyé votre choix.')+'</p>'+targetHTML;
      if(night&&role==='villager')html+='<p class="waiting-note">Attendez le passage au jour.</p>';
      if(!s.my_alive)html+='<p class="waiting-note">Vous êtes éliminé. Vous pouvez observer la suite de la partie.</p>';
      html+='</div>';}
    html+='<h3 class="subheading">Joueurs</h3><div class="player-grid">'+rows+'</div>';
    if(!done&&s.is_host)html+='<div class="button-row host-controls"><button class="primary" id="wolf-resolve">'+(night?'Terminer la nuit':'Clôturer le vote')+'</button></div><small>L’hôte termine la phase lorsque tous les joueurs concernés ont agi.</small>';
    if(done)html+='<div class="button-row"><button class="secondary" id="wolf-finish-close">Retour aux salons</button></div>';
    return html;
  }
  async function loadChat(){
    if(!currentRoom||!sb)return;const box=$('wolf-chat-messages');if(!box)return;
    const r=await sb.from('room_messages').select('id,user_id,display_name,body,created_at').eq('room_id',currentRoom).order('created_at',{ascending:true}).limit(60);
    if(r.error){box.innerHTML='<small>Chat indisponible : '+esc(r.error.message)+'</small>';return;}
    box.innerHTML=(r.data||[]).map(m=>'<div class="chat-message '+(m.user_id===currentUserId?'mine':'')+'"><div><strong>'+esc(m.display_name)+'</strong><small>'+new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</small></div><p>'+esc(m.body)+'</p></div>').join('')||'<small>La conversation est vide. Envoyez le premier message.</small>';
    box.scrollTop=box.scrollHeight;
  }
  function attachChat(box,context={}){
    const wrap=document.createElement('section');wrap.className='hub-chat';
    wrap.innerHTML='<div class="hub-tabs"><button class="hub-tab active" data-hub-tab="discussion">💬 Discussion</button><button class="hub-tab" data-hub-tab="composition">📜 Composition</button><button class="hub-tab" data-hub-tab="rules">❔ Règles</button></div><div class="hub-tab-content" id="wolf-hub-tab-content"></div>';
    box.appendChild(wrap);
    const content=$('wolf-hub-tab-content'),tabs=wrap.querySelectorAll('[data-hub-tab]');
    const showTab=key=>{
      tabs.forEach(t=>t.classList.toggle('active',t.dataset.hubTab===key));
      if(key==='discussion'){
        content.innerHTML='<div class="chat-heading"><div><p class="eyebrow">VILLAGE EN DIRECT</p><h3>Discussion de la partie</h3></div><small>Messages du salon</small></div><div class="chat-messages" id="wolf-chat-messages" aria-live="polite"><small>Chargement…</small></div><form class="chat-form" id="wolf-chat-form"><input id="wolf-chat-input" maxlength="500" autocomplete="off" placeholder="Écrire un message…" aria-label="Votre message" required><button class="primary" type="submit">Envoyer</button></form>';
        loadChat();$('wolf-chat-form').addEventListener('submit',sendChat);
      }else if(key==='composition'){
        if(context.waiting){
          content.innerHTML='<p class="eyebrow">COMPOSITION DU SALON</p><h3>Préparation de la partie</h3><div class="hub-info-row"><span>Joueurs présents</span><strong>'+context.players.length+'/'+context.room.max_players+'</strong></div><div class="hub-info-row"><span>Salon</span><strong>'+esc(context.room.name)+'</strong></div><div class="hub-info-row"><span>Accès</span><strong>Avec code d’invitation</strong></div><p class="muted-note">La partie démarre lorsque l’hôte lance le salon et que les conditions sont remplies.</p>';
        }else{
          const s=context.state||{},ps=s.players||[],alive=ps.filter(p=>p.is_alive).length;
          content.innerHTML='<p class="eyebrow">COMPOSITION DE LA PARTIE</p><h3>État du village</h3><div class="hub-info-row"><span>Manche</span><strong>'+Number(s.round||1)+'</strong></div><div class="hub-info-row"><span>Phase</span><strong>'+(s.phase==='night'?'Nuit':'Jour')+'</strong></div><div class="hub-info-row"><span>Joueurs en vie</span><strong>'+alive+'/'+ps.length+'</strong></div><div class="hub-role-line">🐺 Loup-garou <span>Camp des loups</span></div><div class="hub-role-line">🔮 Voyante <span>Camp du village</span></div><div class="hub-role-line">🛡️ Protecteur <span>Camp du village</span></div><div class="hub-role-line">🏡 Villageois <span>Camp du village</span></div><p class="muted-note">Les rôles secrets des autres joueurs restent masqués jusqu’à leur élimination ou à la fin de la partie.</p>';
        }
      }else{
        const s=context.state||{},role=s.my_role;
        content.innerHTML='<p class="eyebrow">AIDE DE PARTIE</p><h3>'+(context.waiting?'Comment jouer':'Votre rôle : '+esc(roles[role]||'Inconnu'))+'</h3><p class="hub-rule">🌙 <strong>La nuit</strong><br>Les rôles qui possèdent un pouvoir agissent secrètement.</p><p class="hub-rule">☀️ <strong>Le jour</strong><br>Les joueurs discutent puis votent pour tenter d’éliminer un loup.</p><p class="hub-rule">🏆 <strong>Victoire</strong><br>Le village gagne lorsque tous les loups sont éliminés. Les loups gagnent lorsqu’ils sont au moins aussi nombreux que les autres joueurs vivants.</p>'+(role?'<div class="hub-own-role"><strong>Votre rôle secret</strong><p>'+esc(descriptions[role]||'')+'</p></div>':'');
      }
    };
    const sendChat=async e=>{
      e.preventDefault();const input=$('wolf-chat-input'),body=input?.value.trim();if(!body||!currentRoom)return;
      const roomId=currentRoom;input.disabled=true;
      const r=await sb.from('room_messages').insert({room_id:roomId,user_id:currentUserId,display_name:(profileName||'Joueur').slice(0,24),body});
      input.disabled=false;if(r.error){toast(r.error.message);return;}input.value='';await loadChat();input.focus();
    };
    tabs.forEach(t=>t.addEventListener('click',()=>showTab(t.dataset.hubTab)));
    showTab('discussion');
  }
  async function refreshRoom(){
    if(!currentRoom||!sb||refreshing)return;refreshing=true;const id=currentRoom;
    try{
      const values=await Promise.all([sb.from('game_rooms').select('*').eq('id',id).single(),sb.from('room_players').select('user_id,display_name,is_ready,is_alive,revealed_role').eq('room_id',id).order('joined_at'),sb.auth.getUser()]);
      if(currentRoom!==id)return;const box=$('wolf-room-detail');if(!box)return;
      const room=values[0].data,players=values[1].data,u=values[2].data.user;
      if(values[0].error||values[1].error){box.textContent=(values[0].error||values[1].error).message;return;}
      currentUserId=u.id;
      if(room.status==='waiting'){
        box.innerHTML='<div class="wolf-hub"><section class="hub-scene">'+waitingHTML(room,players,u)+'</section><aside class="hub-panel" id="wolf-hub-panel"></aside></div>';attachChat($('wolf-hub-panel'),{waiting:true,room,players});
        $('wolf-ready')?.addEventListener('click',async()=>{const me=players.find(p=>p.user_id===u.id);const r=await sb.rpc('set_room_ready',{p_room_id:id,p_ready:!me?.is_ready});if(r.error)toast(r.error.message);else await refreshRoom();});
        $('wolf-start')?.addEventListener('click',async()=>{const r=await sb.rpc('start_game_room',{p_room_id:id});if(r.error)toast(r.error.message);else{toast('La partie commence. Les rôles ont été distribués.');await refreshRoom();}});
        $('wolf-leave')?.addEventListener('click',async()=>{const r=await sb.rpc('leave_game_room',{p_room_id:id});if(r.error)toast(r.error.message);else closeRoom();});
      }else{
        const r=await sb.rpc('get_my_game_state',{p_room_id:id});if(r.error){box.textContent=r.error.message;return;}
        box.innerHTML='<div class="wolf-hub"><section class="hub-scene">'+gameHTML(r.data)+'</section><aside class="hub-panel" id="wolf-hub-panel"></aside></div>';attachChat($('wolf-hub-panel'),{waiting:false,state:r.data});
        box.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const a=await sb.rpc('submit_game_action',{p_room_id:id,p_target_id:b.dataset.target});if(a.error)toast(a.error.message);else{toast('Choix enregistré.');await refreshRoom();}}));
        $('wolf-resolve')?.addEventListener('click',async()=>{const b=$('wolf-resolve');b.disabled=true;const a=await sb.rpc('resolve_game_phase',{p_room_id:id});if(a.error){toast(a.error.message);b.disabled=false;}else{toast(a.data?.message||'Phase terminée.');await refreshRoom();}});
        $('wolf-finish-close')?.addEventListener('click',closeRoom);
      }
    }finally{refreshing=false;}
  }
  let authMode='login';
  function setAuthMode(mode){
    authMode=mode;const signup=mode==='signup';
    $('wolf-pseudo').hidden=!signup;$('wolf-login').hidden=signup;$('wolf-signup').hidden=!signup;
    $('wolf-tab-login').classList.toggle('active',!signup);$('wolf-tab-signup').classList.toggle('active',signup);
    $('wolf-auth-title').textContent=signup?'Créer votre compte':'Ravi de vous revoir';
  }
  function showAuth(){ $('home').classList.add('hidden');$('lobby').classList.add('hidden');$('auth-screen').classList.remove('hidden');setAuthMode('login');window.scrollTo({top:0,behavior:'smooth'}); }
  function showLobby(){ $('home').classList.add('hidden');$('auth-screen').classList.add('hidden');$('lobby').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'}); }

  $('wolf-tab-login').addEventListener('click',()=>setAuthMode('login'));
  $('wolf-tab-signup').addEventListener('click',()=>setAuthMode('signup'));
  $('wolf-login').addEventListener('click',()=>authAction('login'));
  $('wolf-signup').addEventListener('click',()=>authAction('signup'));
  const logout=async()=>{await sb.auth.signOut();closeRoom();await refreshAuth();showAuth();};
  $('wolf-logout').addEventListener('click',logout);
  $('wolf-logout-lobby').addEventListener('click',logout);
  $('wolf-save-profile').addEventListener('click',saveProfile);
  $('wolf-create').addEventListener('click',createRoom);
  $('wolf-join').addEventListener('click',()=>joinRoom($('wolf-room-code').value));
  $('wolf-room-code').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);});
  $('play-now').addEventListener('click',async()=>{const session=sb?await sb.auth.getSession():{data:{session:null}};if(session.data.session)showLobby();else showAuth();});
  $('back-home').addEventListener('click',()=>{$('lobby').classList.add('hidden');$('home').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});});
  $('auth-back').addEventListener('click',()=>{$('auth-screen').classList.add('hidden');$('home').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});});
  $('wolf-avatar').addEventListener('change',()=>{$('wolf-profile-preview').querySelector('span').textContent=$('wolf-avatar').value;});
  $('quick-join').addEventListener('click',async()=>{const u=await user();if(!u)return;const r=await sb.from('game_rooms').select('room_code,max_players,room_players(count)').eq('status','waiting').order('created_at',{ascending:true}).limit(30);if(r.error){toast(r.error.message);return;}const room=(r.data||[]).find(x=>(x.room_players?.[0]?.count||0)<x.max_players);if(room)joinRoom(room.room_code);else toast('Aucun salon avec des places disponibles. Créez le vôtre ou utilisez un code.');});
  $('create-room').addEventListener('click',createRoom);
  $('profile-btn').addEventListener('click',()=>profile.scrollIntoView({behavior:'smooth',block:'center'}));
  if(!configured){status('Configuration Supabase manquante dans config.js.');profile.hidden=true;panel.hidden=true;}
  else{profile.hidden=true;panel.hidden=true;sb.auth.onAuthStateChange(()=>setTimeout(refreshAuth,0));refreshAuth();}
})();