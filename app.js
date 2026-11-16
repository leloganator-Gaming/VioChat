(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = s => { const el=$('toast'); el.textContent=s; el.classList.add('show'); clearTimeout(window.__wolfToast); window.__wolfToast=setTimeout(()=>el.classList.remove('show'),4200); };
  const cfg=window.WOLFANATOR_CONFIG||{}, configured=!!(cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase);
  const sb=configured?window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey):null;
  let currentRoom=null,channel=null,profileName='',currentUserId='',refreshing=false,isAlpha=false,isAdmin=false,adminPanel=null;
  const roleCatalog=[["wolf","Loup-garou","🐺","loups","La meute choisit une cible chaque nuit."],["black_wolf","Loup Noir","🌑","loups","Peut infecter une cible une fois."],["talkative_wolf","Loup Bavard","🐺","loups","Doit placer un mot secret dans ses messages."],["white_wolf","Loup Blanc","🐺","solitaire","Joue avec les loups mais poursuit une victoire solitaire."],["mercenary","Mercenaire","🎯","solitaire","Reçoit une cible et vise une victoire individuelle."],["rumplestiltskin","Nain Tracassin","🧩","solitaire","Devine le rôle d'un joueur chaque nuit."],["sick_rat","Rat Malade","🐀","solitaire","Propage une contamination."],["villager","Simple Villageois","🏡","village","Débat et vote avec le village."],["seer","Voyante","🔮","village","Découvre le rôle d'un joueur chaque nuit."],["witch","Sorcière","🧙","village","Possède une potion de vie et une potion de mort."],["little_girl","Petite Fille","👧","village","Peut espionner les échanges nocturnes des loups."],["hunter","Chasseur","🏹","village","Peut entraîner un joueur dans son élimination."],["guard","Garde","🛡️","village","Protège un joueur chaque nuit sans répéter la cible."],["cupid","Cupidon","💘","village","Lie deux joueurs au début de la partie."],["mentalist","Mentaliste","🧠","village","Reçoit un indice sur le camp visé par le vote."],["necromancer","Nécromancien","💀","village","Accède aux échanges des joueurs éliminés."],["gravedigger","Fossoyeur","⚰️","village","Déclenche une information à son élimination."],["dictator","Dictateur","👑","village","Peut une fois déclencher un vote décisif."],["red_riding_hood","Chaperon Rouge","🧺","village","Protégé des loups tant que le Chasseur vit."],["pyromaniac","Pyromancien","🔥","village","Prépare une attaque spéciale."],["heir","Héritier","🧬","village","Peut hériter du rôle de son modèle éliminé."],["blue_hood","Chaperon Bleu","🩵","village","Protégé tant qu'un Villageois est en vie."],["pink_hood","Chaperon Rose","🩷","village","Protégé tant que les amoureux sont en vie."],["wolf_hood","Chaperon Loup","🐺","loups","Rejoint la meute."],["raider","Pillard","🗡️","village","Hérite du rôle du premier joueur éliminé."],["literate_wolf","Loup Lettré","📖","loups","Respecte une contrainte de lettre dans ses messages."],["healer","Guérisseuse","💚","village","Dispose d'une potion de soin à usage unique."],["poisoner","Empoisonneuse","☠️","village","Dispose d'une potion de poison à usage unique."],["chatty_seer","Voyante Bavarde","🔮","village","Révèle publiquement son résultat au matin."],["aura_seer","Voyante d'Aura","✨","village","Découvre si l'aura est claire ou obscure."],["ancient","Ancien","🧓","village","Résiste à la première attaque des loups."]].map(([key,name,icon,camp,description])=>({key,name,icon,camp,description}));
  const roles=Object.fromEntries(roleCatalog.map(r=>[r.key,r.name]));
  const icons=Object.fromEntries(roleCatalog.map(r=>[r.key,r.icon]));
  const descriptions=Object.fromEntries(roleCatalog.map(r=>[r.key,r.description]));
  const roleKeys=roleCatalog.map(r=>r.key);

  const auth=document.createElement('div'); auth.className='panel account-panel';
  auth.innerHTML='<div class="auth-tabs"><button type="button" class="auth-tab active" id="wolf-tab-login">Connexion</button><button type="button" class="auth-tab" id="wolf-tab-signup">Créer un compte</button></div><h3 id="wolf-auth-title">Ravi de vous revoir</h3><div class="field-grid auth-fields"><input id="wolf-email" type="email" autocomplete="email" placeholder="Adresse e-mail"><input id="wolf-password" type="password" autocomplete="current-password" placeholder="Mot de passe (6 caractères minimum)"><input id="wolf-pseudo" maxlength="20" minlength="3" placeholder="Pseudo (3 à 20 caractères)" hidden></div><div class="button-row"><button class="primary wide" id="wolf-login">Se connecter</button><button class="primary wide" id="wolf-signup" hidden>Créer mon compte</button><button class="ghost" id="wolf-logout" hidden>Déconnexion</button></div><small id="wolf-auth-status">Connectez-vous pour créer ou rejoindre un salon.</small>';
  $('auth-mount').appendChild(auth);
  const profile=document.createElement('div'); profile.className='panel profile-panel';
  profile.innerHTML='<p class="eyebrow">VOTRE IDENTITÉ</p><h3>Mon profil joueur</h3><div class="field-grid"><input id="wolf-profile-name" maxlength="20" minlength="3" placeholder="Votre pseudo"><select id="wolf-avatar" aria-label="Avatar"><option value="🐺">🐺 Loup</option><option value="🦊">🦊 Renard</option><option value="🦉">🦉 Hibou</option><option value="🐱">🐱 Chat</option><option value="🐻">🐻 Ours</option><option value="🦇">🦇 Chauve-souris</option><option value="👻">👻 Fantôme</option><option value="🧙">🧙 Mage</option></select><button class="secondary" id="wolf-save-profile">Enregistrer le profil</button></div><div class="profile-preview" id="wolf-profile-preview"><span>🐺</span><strong>Votre profil</strong></div><small>Votre pseudo et votre avatar seront affichés dans les salons.</small><div id="wolf-wallet" class="wallet-card"><strong>🌙 Chargement des Lunes…</strong></div><div id="wolf-stats" class="stats-panel"><small>Chargement des statistiques…</small></div><div id="wolf-leaderboard" class="leaderboard-panel"><small>Chargement du classement…</small></div>';
  $('lobby').appendChild(profile);
  const premium=document.createElement('div');premium.className='panel premium-panel';
  premium.innerHTML='<p class="eyebrow">STATUT PREMIUM</p><h3>🐺 Loup Alpha</h3><div class="premium-price">10 🌙 <small>/ 30 jours</small></div><p>Les avantages Alpha de Wolfanator :</p><ul class="alpha-benefits"><li>Badge Loup Alpha sur votre profil</li><li>Statut Alpha et date d’expiration visibles</li><li>Avantages et options Alpha ajoutés progressivement dans Wolfanator</li></ul><div id="wolf-premium-status" class="premium-status">Vérification de votre accès…</div>';
  $('lobby').appendChild(premium);
  const panel=document.createElement('div'); panel.className='panel room-panel';
  panel.innerHTML='<p class="eyebrow">SALONS EN LIGNE</p><h3>Salons disponibles</h3><div class="field-grid room-fields"><input id="wolf-room-name" maxlength="40" placeholder="Nom du salon"><select id="wolf-room-max"><option value="5">5 joueurs</option><option value="8">8 joueurs</option><option value="10">10 joueurs</option><option value="12" selected>12 joueurs</option><option value="15">15 joueurs</option><option value="20">20 joueurs</option></select><select id="wolf-room-visibility" aria-label="Visibilité du salon"><option value="public">🌐 Public</option><option value="private">🔒 Privé (code)</option></select></div><div class="composition-editor"><h4>Choisissez les rôles de votre partie</h4><p>Le total des rôles doit correspondre au nombre de places. La composition est enregistrée dans le salon.</p><div class="composition-fields" id="wolf-composition-fields"></div><div class="composition-total" id="wolf-comp-total">Total : 12 / 12 joueurs</div></div><div class="button-row"><button class="primary" id="wolf-create">Créer le salon avec cette composition</button></div><div class="field-grid room-fields"><input id="wolf-room-code" maxlength="8" placeholder="Code du salon" autocomplete="off"><button class="secondary" id="wolf-join">Rejoindre avec un code</button></div><div id="wolf-rooms" class="room-list"><small>Les salons apparaîtront ici.</small></div><div id="wolf-current-room" class="current-room"></div>';
  $('lobby').appendChild(panel);
  function renderCompositionFields(comp={}){const box=$('wolf-composition-fields');if(!box)return;box.innerHTML=roleCatalog.map(r=>'<label>'+r.icon+' '+esc(r.name)+'<input type="number" id="wolf-comp-'+r.key+'" min="0" max="19" step="1" value="'+Number(comp[r.key]||0)+'" data-role-count="'+r.key+'"></label>').join('');box.querySelectorAll('[data-role-count]').forEach(input=>input.addEventListener('input',updateCompositionTotal));}
  renderCompositionFields({wolf:3,seer:1,healer:1,villager:7});
  const status=s=>$('wolf-auth-status').textContent=s;
  const pseudo=()=>($('wolf-profile-name').value||$('wolf-pseudo').value||profileName||'Joueur').trim();
  const needClient=()=>{if(!sb){toast('Connexion Supabase indisponible. Vérifiez config.js.');return false;}return true;};
  async function user(){if(!needClient())return null;const r=await sb.auth.getUser();if(r.error||!r.data.user){toast('Connectez-vous pour continuer.');return null;}return r.data.user;}
  async function loadProfile(u){
    const r=await sb.from('profiles').select('username,avatar,moon_balance').eq('id',u.id).maybeSingle();
    if(r.error){status('Connecté. Profil non chargé : '+r.error.message);return;}
    if(r.data&&r.data.username){profileName=r.data.username;}
    else{let n=String(u.user_metadata?.username||u.email?.split('@')[0]||'Joueur').slice(0,20);if(n.length<3)n='Joueur';const w=await sb.from('profiles').upsert({id:u.id,username:n},{onConflict:'id'});if(!w.error)profileName=n;}
    $('wolf-wallet').innerHTML='<strong>🌙 '+Number(r.data?.moon_balance||0)+' Lunes</strong><small>Vous gagnez 1 Lune à chaque victoire.</small>';
    $('wolf-profile-name').value=profileName;$('wolf-pseudo').value=profileName;$('wolf-avatar').value=r.data?.avatar?.emoji||'🐺';$('wolf-profile-preview').innerHTML='<span>'+esc($('wolf-avatar').value)+'</span><strong>'+esc(profileName)+'</strong>';await loadStats();await loadLeaderboard();
  }
  async function refreshAuth(){
    if(!sb)return;const r=await sb.auth.getSession(),session=r.data.session;
    $('wolf-logout').hidden=!session;$('wolf-logout-lobby').hidden=!session;$('wolf-login').hidden=!!session;$('wolf-signup').hidden=!!session;$('wolf-pseudo').hidden=!!session;
    profile.hidden=!session;panel.hidden=!session;premium.hidden=!session;
    if(session){currentUserId=session.user.id;$('auth-screen').classList.add('hidden');$('lobby').classList.remove('hidden');status('Connecté : '+(session.user.email||'joueur'));await loadProfile(session.user);await loadPremium();await loadRooms();await renderAdminPanel();}
    else{currentUserId='';profileName='';isAdmin=false;if(adminPanel)adminPanel.hidden=true;status('Non connecté.');$('wolf-rooms').innerHTML='<small>Connectez-vous pour afficher les salons.</small>';}
  }
  async function loadPremium(){
    isAdmin=false;const box=$('wolf-premium-status');if(!box)return;
    const r=await sb.from('user_entitlements').select('entitlement_key,expires_at,source').eq('user_id',currentUserId).eq('entitlement_key','wolf_alpha').maybeSingle();
    if(r.error){box.textContent='Statut indisponible.';return;}
    const active=!!r.data&&(!r.data.expires_at||new Date(r.data.expires_at)>new Date());isAlpha=active;isAdmin=active&&r.data.source==='admin'&&!r.data.expires_at;
    const preview=$('wolf-profile-preview');if(preview){const old=preview.querySelector('.alpha-badge');if(old)old.remove();if(active)preview.insertAdjacentHTML('beforeend','<small class="alpha-badge">🐺 LOUP ALPHA</small>');}
    box.innerHTML=active?'<strong class="premium-active">✓ Loup Alpha activé sur ce compte</strong><small>'+(r.data.expires_at?'Valable jusqu’au '+new Date(r.data.expires_at).toLocaleDateString('fr-FR'):'Accès administrateur permanent')+'</small>':'<strong>Débloquez les avantages Alpha</strong><button class="secondary wide" id="wolf-buy-alpha">Activer pour 10 Lunes</button><small>10 Lunes sont déduites de votre solde pour 30 jours.</small>';
    const buy=$('wolf-buy-alpha');if(buy)buy.addEventListener('click',async()=>{buy.disabled=true;const a=await sb.rpc('buy_wolf_alpha_with_moons');if(a.error){toast(a.error.message);buy.disabled=false;return;}toast('Loup Alpha activé pour 30 jours !');await loadProfile({id:currentUserId});await loadPremium();});
  }
  async function renderAdminPanel(){
    if(!isAdmin){if(adminPanel)adminPanel.hidden=true;return;}
    if(!adminPanel){adminPanel=document.createElement('section');adminPanel.className='panel admin-panel';adminPanel.id='wolf-admin-panel';$('lobby').appendChild(adminPanel);}
    adminPanel.hidden=false;
    adminPanel.innerHTML='<p class="eyebrow">CONSOLE PRIVILÉGIÉE</p><h3>🛠️ Administration Wolfanator</h3><p class="muted-note">Outils réservés au compte administrateur permanent.</p><div class="admin-actions"><button class="secondary" id="admin-refresh">Actualiser les données</button><button class="secondary" id="admin-test-hub">🧪 Tester le hub</button><button class="ghost" id="admin-cleanup">Nettoyer les salons en attente de plus de 24 h</button></div><div id="admin-stats" class="admin-stats">Chargement des indicateurs…</div><h4>Gestion de tous les salons</h4><div id="admin-room-list" class="admin-room-list">Chargement…</div><div id="admin-diagnostics" class="admin-diagnostics"></div><h4>Journal des actions administrateur</h4><div id="admin-audit-list" class="admin-audit-list">Chargement…</div><h4>Signalements des joueurs</h4><div id="admin-report-list" class="admin-audit-list">Chargement…</div>';
    $('admin-refresh').addEventListener('click',loadAdminData);
    $('admin-test-hub').addEventListener('click',async()=>{
      const b=$('admin-test-hub');b.disabled=true;
      const comp={wolf:1,seer:1,healer:1,villager:2};
      const r=await sb.rpc('create_game_room',{p_name:'[TEST ADMIN] Hub Wolfanator',p_max_players:5,p_display_name:pseudo(),p_composition:comp,p_visibility:'private'});
      b.disabled=false;
      if(r.error){toast('Création du salon de test impossible : '+r.error.message);return;}
      toast('Salon de test créé. Vous pouvez inspecter le hub et ses réglages.');
      await openRoom(r.data[0].room_id,r.data[0].room_code);
      await loadAdminData();
    });
    $('admin-cleanup').addEventListener('click',async()=>{
      if(!confirm('Supprimer définitivement tous les salons EN ATTENTE créés il y a plus de 24 heures ? Les parties en cours ne seront pas touchées.'))return;
      const b=$('admin-cleanup');b.disabled=true;const r=await sb.rpc('admin_cleanup_stale_rooms',{p_hours:24});b.disabled=false;
      if(r.error){toast(r.error.message);return;}toast(Number(r.data)+' salon(s) ancien(s) supprimé(s).');await loadAdminData();await loadRooms();
    });
    await loadAdminData();
  }
  async function loadAdminData(){
    if(!isAdmin||!adminPanel)return;
    const [stats,rooms,audit]=await Promise.all([sb.rpc('admin_dashboard_stats'),sb.rpc('admin_list_rooms'),sb.rpc('admin_get_audit_log')]);
    if(stats.error||rooms.error||audit.error){$('admin-diagnostics').textContent='Erreur admin : '+(stats.error||rooms.error||audit.error).message;return;}
    const s=stats.data||{};
    $('admin-stats').innerHTML='<div class="admin-stat-grid">'+[['Salons',s.rooms_total],['En attente',s.rooms_waiting],['Parties en cours',s.rooms_playing],['Terminées',s.rooms_finished],['Joueurs présents',s.players_online],['Messages',s.messages_total],['Parties enregistrées',s.games_total],['Lunes en circulation',s.lunes_in_circulation]].map(x=>'<div><strong>'+Number(x[1]||0).toLocaleString('fr-FR')+'</strong><small>'+x[0]+'</small></div>').join('')+'</div>';
    const list=Array.isArray(rooms.data)?rooms.data:[];
    $('admin-room-list').innerHTML=list.length?list.map(r=>'<article class="admin-room-card"><div><strong>'+esc(r.name)+'</strong><small>'+esc(r.room_code)+' · '+esc(r.status)+' · '+Number(r.player_count)+'/'+Number(r.max_players)+' joueurs · '+(r.visibility==='private'?'Privé':'Public')+'</small><small>Hôte : '+esc(r.host_name)+' · '+new Date(r.created_at).toLocaleString('fr-FR')+'</small><small>'+((r.players||[]).map(p=>esc(p.name)+(p.is_alive?'':' (éliminé)')).join(' · ')||'Aucun joueur')+'</small></div><button class="danger" data-admin-delete="'+r.id+'">Supprimer</button></article>').join(''):'<p class="muted-note">Aucun salon enregistré.</p>';
    $('admin-room-list').querySelectorAll('[data-admin-delete]').forEach(b=>b.addEventListener('click',async()=>{
      const room=list.find(x=>x.id===b.dataset.adminDelete);if(!room)return;
      if(!confirm('Supprimer définitivement le salon « '+room.name+' » ('+room.room_code+') et ses données associées ?'))return;
      b.disabled=true;const d=await sb.rpc('admin_delete_room',{p_room_id:room.id,p_reason:'Suppression manuelle depuis la console admin'});
      if(d.error){toast(d.error.message);b.disabled=false;return;}
      if(currentRoom===room.id)closeRoom();toast('Salon supprimé.');await loadAdminData();await loadRooms();
    }));
    const auditRows=Array.isArray(audit.data)?audit.data:[];
    $('admin-audit-list').innerHTML=auditRows.length?auditRows.map(x=>'<div class="admin-audit-row"><strong>'+esc(x.action)+'</strong><small>'+esc(x.admin_name)+' · '+new Date(x.created_at).toLocaleString('fr-FR')+'</small><small>'+esc(x.details?.room_name||x.details?.room_code||'Action administrateur')+'</small></div>').join(''):'<small>Aucune action enregistrée pour le moment.</small>';
    $('admin-diagnostics').innerHTML='<strong>Diagnostic rapide</strong><p>Connexion Supabase : OK · Accès administrateur : OK · Lecture des salons : OK · Outils de suppression : disponibles.</p><small>Les salons en cours ne sont pas supprimés par le nettoyage automatique.</small>';
    await loadAdminReports();
  }
  async function loadAdminReports(){
    const box=$('admin-report-list');if(!box||!isAdmin)return;
    const r=await sb.rpc('admin_list_wolfanator_reports');
    if(r.error){box.textContent='Signalements indisponibles : '+r.error.message;return;}
    const rows=Array.isArray(r.data)?r.data:[];
    box.innerHTML=rows.length?rows.map(x=>'<article class="admin-room-card"><div><strong>'+esc(x.reported)+' · '+esc(x.reason)+'</strong><small>Signalé par '+esc(x.reporter)+' · '+new Date(x.created_at).toLocaleString('fr-FR')+'</small><small>'+esc(x.details||'Aucun détail fourni')+'</small><small>Statut : '+esc(x.status)+'</small></div><div class="admin-actions"><button class="secondary" data-report-status="reviewing" data-report-id="'+x.id+'">En cours</button><button class="secondary" data-report-status="resolved" data-report-id="'+x.id+'">Résolu</button><button class="ghost" data-report-status="dismissed" data-report-id="'+x.id+'">Classer</button></div></article>').join(''):'<small>Aucun signalement en attente.</small>';
    box.querySelectorAll('[data-report-status]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const u=await sb.rpc('admin_update_wolfanator_report',{p_report_id:b.dataset.reportId,p_status:b.dataset.reportStatus});if(u.error){toast(u.error.message);b.disabled=false;return;}toast('Signalement mis à jour.');await loadAdminReports();}));
  }
  async function loadStats(){
    const box=$('wolf-stats');if(!box)return;
    const r=await sb.from('game_history').select('room_name,role_key,won,rounds,finished_at').eq('user_id',currentUserId).order('finished_at',{ascending:false}).limit(1000);
    if(r.error){box.innerHTML='<small>Statistiques indisponibles : '+esc(r.error.message)+'</small>';return;}
    const rows=r.data||[],wins=rows.filter(x=>x.won).length,losses=rows.length-wins,rate=rows.length?Math.round(wins/rows.length*100):0;
    box.innerHTML='<h4>Statistiques</h4><div class="stats-grid"><div><strong>'+rows.length+'</strong><small>Parties</small></div><div><strong>'+wins+'</strong><small>Victoires</small></div><div><strong>'+rate+'%</strong><small>Taux de victoire</small></div></div><h4>Dernières parties</h4>'+(rows.length?'<div class="history-list">'+rows.slice(0,10).map(x=>'<div class="history-row"><span><strong>'+esc(x.room_name)+'</strong><small>'+esc(roles[x.role_key]||x.role_key)+' · '+new Date(x.finished_at).toLocaleDateString('fr-FR')+'</small></span><b class="'+(x.won?'win':'loss')+'">'+(x.won?'Victoire':'Défaite')+'</b></div>').join('')+'</div>':'<small>Aucune partie terminée pour le moment.</small>');
  }
  async function loadLeaderboard(){
    const box=$('wolf-leaderboard');if(!box)return;
    const r=await sb.rpc('get_wolfanator_leaderboard');
    if(r.error){box.innerHTML='<small>Classement indisponible : '+esc(r.error.message)+'</small>';return;}
    const rows=Array.isArray(r.data)?r.data:[];
    box.innerHTML='<h4>🏆 Classement Wolfanator</h4>'+(rows.length?'<div class="leaderboard-list">'+rows.map(x=>'<div class="leaderboard-row '+(x.username===profileName?'is-me':'')+'"><b>#'+Number(x.rank)+'</b><strong>'+esc(x.username)+'</strong><small>'+Number(x.laurels||0)+' lauriers · '+Number(x.wins)+' victoires · '+Number(x.win_rate)+'% · '+Number(x.lunes)+' 🌙</small></div>').join('')+'</div>':'<small>Jouez des parties pour apparaître dans le classement.</small>');
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
    if(r.error)return toast(r.error.message);profileName=n;$('wolf-pseudo').value=n;$('wolf-profile-preview').innerHTML='<span>'+esc(emoji)+'</span><strong>'+esc(n)+'</strong>'+(isAlpha?'<small class="alpha-badge">🐺 LOUP ALPHA</small>':'');toast('Profil enregistré.');
  }
  async function loadRooms(){
    const mine=await sb.from('room_players').select('room_id').eq('user_id',currentUserId);
    if(mine.error){$('wolf-rooms').textContent=mine.error.message;return;}
    const ids=(mine.data||[]).map(x=>x.room_id);
    const [waiting,playing]=await Promise.all([
      sb.from('game_rooms').select('id,room_code,name,status,max_players,created_at,settings,room_players(count)').eq('status','waiting').order('created_at',{ascending:false}).limit(30),
      ids.length?sb.from('game_rooms').select('id,room_code,name,status,max_players,created_at,room_players(count)').in('id',ids).eq('status','playing').order('created_at',{ascending:false}):Promise.resolve({data:[],error:null})
    ]);
    if(waiting.error||playing.error){$('wolf-rooms').textContent=(waiting.error||playing.error).message;return;}
    const open=(waiting.data||[]).filter(x=>x.settings?.visibility!=='private'&&(x.room_players?.[0]?.count||0)<x.max_players);
    const active=playing.data||[];
    const cards=[...active,...open].map(x=>{const count=x.room_players?.[0]?.count||0,when=new Date(x.created_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});return '<div class="room-card"><span><strong>'+esc(x.name)+'</strong><small>'+(x.status==='playing'?'🎮 Partie en cours · réservée aux participants':'🏰 Salon ouvert · '+(x.max_players-count)+' place(s) disponible(s)')+' · '+count+'/'+x.max_players+' joueurs · Créé le '+when+'</small><small>Code : '+esc(x.room_code)+'</small></span>'+(x.status==='playing'?'<button class="secondary" data-resume="'+x.id+'" data-code="'+esc(x.room_code)+'">Reprendre</button>':'<button class="secondary" data-enter="'+esc(x.room_code)+'">Rejoindre</button>')+'</div>';}).join('');
    $('wolf-rooms').innerHTML=cards||'<div class="empty-rooms"><strong>Aucune partie à afficher</strong><small>Les salons ouverts apparaîtront ici. Créez-en un pour commencer ou rejoignez un ami avec son code.</small></div>';
    $('wolf-rooms').querySelectorAll('[data-enter]').forEach(b=>b.addEventListener('click',()=>joinRoom(b.dataset.enter)));
    $('wolf-rooms').querySelectorAll('[data-resume]').forEach(b=>b.addEventListener('click',()=>openRoom(b.dataset.resume,b.dataset.code)));
  }
  function getComposition(){return Object.fromEntries(roleKeys.map(k=>[k,Number($('wolf-comp-'+k)?.value||0)]));}
  function updateCompositionTotal(){const c=getComposition(),sum=Object.values(c).reduce((n,v)=>n+v,0),max=Number($('wolf-room-max').value),valid=Object.values(c).every(n=>Number.isInteger(n)&&n>=0)&&c.wolf>=1&&sum===max;$('wolf-comp-total').textContent='Total : '+sum+' / '+max+' joueurs'+(valid?' · Composition valide':' · Ajustez les rôles');$('wolf-create').disabled=!valid;}

  async function createRoom(){
    const u=await user();if(!u)return;const comp=getComposition(),max=Number($('wolf-room-max').value),sum=Object.values(comp).reduce((a,b)=>a+b,0);
    if(comp.wolf<1||sum!==max)return toast('La composition doit contenir au moins un loup et totaliser exactement '+max+' rôles.');
    const r=await sb.rpc('create_game_room',{p_name:$('wolf-room-name').value.trim()||'Salon Wolfanator',p_max_players:max,p_display_name:pseudo(),p_composition:comp,p_visibility:$('wolf-room-visibility').value});
    if(r.error)return toast(r.error.message);await openRoom(r.data[0].room_id,r.data[0].room_code);
  }
  async function joinRoom(code){
    const u=await user();if(!u)return;const c=String(code||'').trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(c))return toast('Le code doit contenir 8 caractères.');
    const r=await sb.rpc('join_game_room',{p_room_code:c,p_display_name:pseudo()});if(r.error)return toast(r.error.message);await openRoom(r.data,c);
  }
  async function openRoom(id,code){
    currentRoom=id;if(channel)await sb.removeChannel(channel);
    channel=sb.channel('wolf-room-'+id).on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:'room_id=eq.'+id},refreshRoom).on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_rooms',filter:'id=eq.'+id},refreshRoom).on('postgres_changes',{event:'INSERT',schema:'public',table:'room_messages',filter:'room_id=eq.'+id},loadChat).subscribe();
    $('wolf-current-room').innerHTML='<div class="room-heading"><h3>Salon '+esc(code)+'</h3><div class="button-row"><button class="secondary" id="wolf-copy-code">Copier le code</button><button class="ghost" id="wolf-close-room">Fermer</button></div></div><div id="wolf-room-detail">Chargement…</div>';
    $('wolf-close-room').addEventListener('click',closeRoom);$('wolf-copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(code));toast('Code du salon copié.');}catch(e){toast('Copie automatique indisponible : '+code);}});await refreshRoom();
  }
  function closeRoom(){currentRoom=null;if(channel&&sb)sb.removeChannel(channel);channel=null;$('wolf-current-room').innerHTML='';loadRooms();}
  function waitingHTML(room,players,u){
    const me=players.find(p=>p.user_id===u.id),comp=room.settings?.composition||{};
    const compTotal=Object.values(comp).reduce((n,v)=>n+Number(v||0),0);
    const allReady=players.every(p=>p.user_id===room.host_id||p.is_ready);
    const full=players.length===room.max_players,valid=compTotal===players.length;
    const canStart=full&&valid&&allReady;
    const reason=!full?'Il manque '+(room.max_players-players.length)+' joueur(s).':!valid?'La composition ne correspond pas au nombre de joueurs.':!allReady?'En attente des joueurs qui ne sont pas prêts.':'Tous les joueurs sont prêts.';
    return '<div class="game-status"><span class="phase-chip">🏰 Salon en attente</span><span>'+players.length+'/'+room.max_players+' joueurs</span></div><p>'+esc(room.name)+' · Code à partager : <strong class="room-code">'+esc(room.room_code)+'</strong></p><div class="player-grid">'+players.map(p=>'<div class="player-chip"><span>'+esc(p.display_name)+'</span><small>'+(p.user_id===room.host_id?'👑 Hôte':p.is_ready?'✓ Prêt':'En attente')+'</small>'+(room.host_id===u.id&&p.user_id!==u.id?'<button type="button" class="kick-player" data-kick="'+p.user_id+'">Retirer</button>':'')+'</div>').join('')+'</div><div class="lobby-start-state">'+(canStart?'✓ Tous les joueurs peuvent commencer.':esc(reason))+'</div><div class="button-row"><button class="secondary" id="wolf-ready">'+(me?.is_ready?'Annuler prêt':'Je suis prêt')+'</button>'+(room.host_id===u.id?'<button class="primary" id="wolf-start" '+(canStart?'':'disabled')+'>Lancer la partie</button>':'')+'<button class="ghost" id="wolf-leave">Quitter le salon</button></div><small>Le créateur lance la partie quand toutes les places sont occupées, que la composition est valide et que les autres joueurs sont prêts.</small>';
  }
  function gameHTML(s){
    const players=s.players||[],alive=players.filter(p=>p.is_alive),role=s.my_role,night=s.phase==='night',day=s.phase==='day',done=s.status==='finished'||s.phase==='finished';
    let desc=night?({wolf:'Choisissez une cible avec les autres loups.',seer:'Choisissez un joueur à examiner.',healer:'Choisissez une personne à protéger.',guard:'Choisissez une personne à protéger (pas la même deux nuits de suite).',witch:'Vous pouvez sauver la cible des loups ou empoisonner un joueur. Chaque potion ne s’utilise qu’une fois.',ancient:'Vous avez deux vies. La première attaque des loups vous blesse ; la seconde peut vous éliminer.',villager:'Vous êtes à l’abri cette nuit. Attendez le matin.'}[role]):'Le village débat. Votez pour la personne que vous pensez être un loup.';
    const canAct=!done&&s.my_alive&&(night&&['wolf','seer','healer','guard'].includes(role)||day),witchTurn=!done&&s.my_alive&&night&&role==='witch';
    const targets=alive.filter(p=>p.user_id!==(day||role==='seer'||role==='wolf'||role==='witch'?currentUserId:''));
    const label=night?({wolf:'Désigner la cible',seer:'Examiner ce joueur',healer:'Protéger ce joueur',guard:'Protéger ce joueur'}[role]||''):'Voter contre ce joueur';
    const targetHTML=canAct?'<div class="target-grid">'+targets.map(p=>'<button class="target-button" data-target="'+p.user_id+'"><strong>'+esc(p.display_name)+'</strong><small>'+(p.is_host?'👑 Hôte':'Joueur')+' · '+label+'</small></button>').join('')+'</div>':'';
    const rows=players.map(p=>'<div class="player-chip '+(p.is_alive?'':'is-out')+'"><span>'+esc(p.display_name)+(p.is_host?' 👑':'')+'</span><small>'+(p.is_alive?'En jeu':'Éliminé'+(p.revealed_role?' · '+esc(roles[p.revealed_role]||p.revealed_role):''))+'</small></div>').join('');
    const winner=s.winner==='village'?'Le village a gagné !':s.winner==='loups'?'Les loups-garous ont gagné !':'Partie terminée',personalWin=(role==='wolf'&&s.winner==='loups')||(role!=='wolf'&&s.winner==='village');
    let html='<div class="game-status"><span class="phase-chip">'+(done?'🏁 Partie terminée':night?'🌙 Nuit':'☀️ Jour')+' · Manche '+s.round+'</span><span>'+alive.length+'/'+players.length+' encore en jeu</span></div>';
    html+='<div class="role-card"><div class="role-icon">'+(icons[role]||'🎭')+'</div><div><small>VOTRE RÔLE SECRET</small><h3>'+esc(roles[role]||'En attente')+'</h3><p>'+esc(descriptions[role]||'')+'</p></div></div>';
    if(role==='wolf'&&s.wolf_team?.length)html+='<p class="team-note">Vos alliés : '+s.wolf_team.map(esc).join(', ')+'</p>';
    if(s.last_event)html+='<div class="story-event">'+esc(s.last_event)+'</div>';
    if(role==='seer'&&s.seer_result)html+='<div class="seer-result">🔮 Votre vision : '+esc(s.seer_result.name)+' est '+esc(roles[s.seer_result.role]||s.seer_result.role)+'.</div>';if(role==='ancient'&&s.my_alive)html+='<div class="seer-result">🧓 Vies restantes : '+Number(s.ancient_state?.lives_remaining||1)+'/2</div>';
    if(done)html+='<div class="winner-card"><h3>'+winner+'</h3><p>Les rôles de tous les joueurs sont révélés.</p>'+(personalWin?'<strong class="win">🌙 Vous gagnez 1 Lune !</strong>':'<small>Pas de Lune cette fois. Une victoire vous rapporte 1 Lune.</small>')+'</div>';
    else{html+='<div class="action-area"><h3>'+(night?'Actions de la nuit':'Vote du village')+'</h3><p>'+esc(desc)+'</p>';
      if(canAct)html+='<p class="action-state">'+(s.my_action_submitted?'Votre choix est enregistré. Vous pouvez le modifier avant la fin de la phase.':'Vous n’avez pas encore envoyé votre choix.')+'</p>'+targetHTML;
      if(witchTurn){html+='<div class="witch-actions"><h4>🧪 Vos potions</h4>'+(s.witch_state.heal_available?'<button class="secondary" data-witch-action="heal">🧪 Utiliser la potion de vie (sauver la cible des loups)</button>':'<small>🧪 Potion de vie déjà utilisée</small>')+(s.witch_state.poison_available?'<p>☠️ Choisissez une cible pour la potion de mort :</p><div class="target-grid">'+targets.map(p=>'<button class="target-button" data-witch-poison="'+p.user_id+'">☠️ Empoisonner '+esc(p.display_name)+'</button>').join('')+'</div>':'<small>☠️ Potion de mort déjà utilisée</small>')+'<button class="ghost" data-witch-action="skip">Passer cette nuit</button></div>';}
      else if(night&&role==='witch'&&s.my_alive)html+='<p class="waiting-note">Vos deux potions ont été utilisées. Vous n’avez plus d’action nocturne.</p>';
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
  async function loadWolfChat(){
    const box=$('wolf-private-chat-messages');if(!currentRoom||!sb||!box)return;
    const r=await sb.rpc('get_wolf_chat',{p_room_id:currentRoom});
    if(r.error){box.innerHTML='<small>Discussion secrète indisponible : '+esc(r.error.message)+'</small>';return;}
    box.innerHTML=(r.data||[]).map(m=>'<div class="chat-message"><div><strong>'+esc(m.display_name)+'</strong><small>'+new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</small></div><p>'+esc(m.body)+'</p></div>').join('')||'<small>Aucun message des loups pour le moment.</small>';
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
        if(context.state?.my_role==='wolf'&&context.state?.my_alive){
          content.insertAdjacentHTML('beforeend','<section class="wolf-private-chat"><div class="chat-heading"><div><p class="eyebrow">CANAL CONFIDENTIEL</p><h3>🐺 Discussion des loups</h3></div><button type="button" class="ghost" id="wolf-private-refresh">Actualiser</button></div><div class="chat-messages private-messages" id="wolf-private-chat-messages"><small>Chargement…</small></div><form class="chat-form" id="wolf-private-chat-form"><input id="wolf-private-chat-input" maxlength="500" autocomplete="off" placeholder="Message réservé aux loups…" aria-label="Message privé aux loups" required><button class="primary" type="submit">Envoyer</button></form><small>Seuls les loups encore en jeu peuvent lire et envoyer ces messages.</small></section>');
          loadWolfChat();
          $('wolf-private-refresh').addEventListener('click',loadWolfChat);
          $('wolf-private-chat-form').addEventListener('submit',sendWolfChat);
        }
      }else if(key==='composition'){
        if(context.waiting){
          const comp=context.room.settings?.composition||{},host=context.room.host_id===currentUserId;
          content.innerHTML='<p class="eyebrow">COMPOSITION DU SALON</p><h3>Préparation de la partie</h3><div class="hub-info-row"><span>Joueurs présents</span><strong>'+context.players.length+'/'+context.room.max_players+'</strong></div><div class="hub-info-row"><span>Salon</span><strong>'+esc(context.room.name)+'</strong></div><div class="hub-info-row"><span>Accès</span><strong>'+(context.room.settings?.visibility==='private'?'🔒 Privé':'🌐 Public')+'</strong></div><h4>Rôles prévus</h4><div class="hub-role-line">🐺 Loups-garous <span>'+Number(comp.wolf||0)+'</span></div><div class="hub-role-line">🔮 Voyante <span>'+Number(comp.seer||0)+'</span></div><div class="hub-role-line">🛡️ Protecteur <span>'+Number(comp.healer||0)+'</span></div><div class="hub-role-line">🧙 Sorcière <span>'+Number(comp.witch||0)+'</span></div><div class="hub-role-line">🧓 Ancien <span>'+Number(comp.ancient||0)+'</span></div><div class="hub-role-line">🏡 Villageois <span>'+Number(comp.villager||0)+'</span></div>'+(host?'<div class="hub-editor"><h4>⚙️ Paramètres du créateur</h4><label>Nom du salon<input id="hub-edit-name" maxlength="40" value="'+esc(context.room.name)+'"></label><label>Nombre de places<select id="hub-edit-max">'+[5,8,10,12,15,20].map(n=>'<option value="'+n+'" '+(n===context.room.max_players?'selected':'')+'>'+n+' joueurs</option>').join('')+'</select></label><label>Visibilité<select id="hub-edit-visibility"><option value="public" '+(context.room.settings?.visibility!=='private'?'selected':'')+'>Public</option><option value="private" '+(context.room.settings?.visibility==='private'?'selected':'')+'>Privé (code uniquement)</option></select></label><div class="composition-fields"><label>🐺 Loups<input type="number" id="hub-comp-wolf" min="1" max="19" value="'+Number(comp.wolf||0)+'"></label><label>🔮 Voyantes<input type="number" id="hub-comp-seer" min="0" max="19" value="'+Number(comp.seer||0)+'"></label><label>🛡️ Protecteurs<input type="number" id="hub-comp-healer" min="0" max="19" value="'+Number(comp.healer||0)+'"></label><label>🧙 Sorcières<input type="number" id="hub-comp-witch" min="0" max="19" value="'+Number(comp.witch||0)+'"></label><label>🧓 Anciens<input type="number" id="hub-comp-ancient" min="0" max="19" value="'+Number(comp.ancient||0)+'"></label><label>🏡 Villageois<input type="number" id="hub-comp-villager" min="0" max="19" value="'+Number(comp.villager||0)+'"></label></div><div id="hub-comp-total" class="composition-total"></div><button type="button" class="primary wide" id="hub-save-settings">Enregistrer les paramètres</button></div>':'<p class="muted-note">Seul le créateur peut modifier la composition et les paramètres du salon. La partie démarre lorsque le nombre de joueurs correspond aux rôles choisis.</p>');
          if(host){const total=()=>{const max=Number($('hub-edit-max').value),sum=['wolf','seer','healer','witch','ancient','villager'].reduce((v,k)=>v+Number($('hub-comp-'+k).value||0),0);$('hub-comp-total').textContent='Total : '+sum+' / '+max+' joueurs'+(sum===max?' · Composition valide':' · Total à corriger');$('hub-save-settings').disabled=sum!==max||Number($('hub-comp-wolf').value)<1||max<context.players.length;};['wolf','seer','healer','witch','ancient','villager'].forEach(k=>$('hub-comp-'+k).addEventListener('input',total));$('hub-edit-max').addEventListener('change',total);total();$('hub-save-settings').addEventListener('click',async()=>{const button=$('hub-save-settings');button.disabled=true;const composition={wolf:Number($('hub-comp-wolf').value),seer:Number($('hub-comp-seer').value),healer:Number($('hub-comp-healer').value),witch:Number($('hub-comp-witch').value),ancient:Number($('hub-comp-ancient').value),villager:Number($('hub-comp-villager').value)};const result=await sb.rpc('update_game_room_settings',{p_room_id:currentRoom,p_name:$('hub-edit-name').value.trim(),p_max_players:Number($('hub-edit-max').value),p_composition:composition,p_visibility:$('hub-edit-visibility').value});if(result.error){toast(result.error.message);button.disabled=false;}else{toast('Paramètres du salon enregistrés. Les joueurs doivent se remettre prêts.');await refreshRoom();}});}
        }else{
          const s=context.state||{},ps=s.players||[],alive=ps.filter(p=>p.is_alive).length,comp=s.composition||{};const wolves=Number(comp.wolf||0),seer=Number(comp.seer||0),healer=Number(comp.healer||0),witch=Number(comp.witch||0),ancient=Number(comp.ancient||0),villagers=Number(comp.villager||0);
          content.innerHTML='<p class="eyebrow">COMPOSITION DE LA PARTIE</p><h3>Rôles distribués</h3><div class="hub-info-row"><span>Manche</span><strong>'+Number(s.round||1)+'</strong></div><div class="hub-info-row"><span>Phase</span><strong>'+(s.phase==='night'?'Nuit':'Jour')+'</strong></div><div class="hub-info-row"><span>Joueurs en vie</span><strong>'+alive+'/'+ps.length+'</strong></div><div class="hub-role-line">🐺 Loup-garou <span>'+wolves+' · Camp des loups</span></div><div class="hub-role-line">🔮 Voyante <span>'+seer+' · Camp du village</span></div><div class="hub-role-line">🛡️ Protecteur <span>'+healer+' · Camp du village</span></div><div class="hub-role-line">🧙 Sorcière <span>'+witch+' · Camp du village</span></div><div class="hub-role-line">🧓 Ancien <span>'+ancient+' · Camp du village</span></div><div class="hub-role-line">🏡 Villageois <span>'+villagers+' · Camp du village</span></div><p class="muted-note">Les rôles secrets des autres joueurs restent masqués jusqu’à leur élimination ou à la fin de la partie.</p>';
        }
      }else{
        const s=context.state||{},role=s.my_role;
        content.innerHTML='<p class="eyebrow">AIDE DE PARTIE</p><h3>'+(context.waiting?'Comment jouer':'Votre rôle : '+esc(roles[role]||'Inconnu'))+'</h3><p class="hub-rule">🌙 <strong>La nuit</strong><br>Les rôles qui possèdent un pouvoir agissent secrètement.</p><p class="hub-rule">☀️ <strong>Le jour</strong><br>Les joueurs discutent puis votent pour tenter d’éliminer un loup.</p><p class="hub-rule">🏆 <strong>Victoire</strong><br>Le village gagne lorsque tous les loups sont éliminés. Les loups gagnent lorsqu’ils sont au moins aussi nombreux que les autres joueurs vivants.</p><h4>📚 Rôles disponibles dans Wolfanator</h4>'+Object.keys(roles).map(k=>'<div class="role-library-row"><span>'+icons[k]+' <strong>'+esc(roles[k])+'</strong></span><small>'+esc(descriptions[k])+'</small></div>').join('')+(role?'<div class="hub-own-role"><strong>Votre rôle secret</strong><p>'+esc(descriptions[role]||'')+'</p></div>':'');
      }
    };
    const sendWolfChat=async e=>{
      e.preventDefault();const input=$('wolf-private-chat-input'),body=input?.value.trim();if(!body||!currentRoom)return;
      input.disabled=true;const r=await sb.rpc('send_wolf_chat',{p_room_id:currentRoom,p_body:body});input.disabled=false;
      if(r.error){toast(r.error.message);return;}input.value='';await loadWolfChat();input.focus();
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
        box.querySelectorAll('[data-kick]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Retirer ce joueur du salon ?'))return;b.disabled=true;const k=await sb.rpc('kick_room_player',{p_room_id:id,p_target_user_id:b.dataset.kick});if(k.error){toast(k.error.message);b.disabled=false;}else{toast('Joueur retiré du salon.');await refreshRoom();}}));
        $('wolf-ready')?.addEventListener('click',async()=>{const me=players.find(p=>p.user_id===u.id);const r=await sb.rpc('set_room_ready',{p_room_id:id,p_ready:!me?.is_ready});if(r.error)toast(r.error.message);else await refreshRoom();});
        $('wolf-start')?.addEventListener('click',async()=>{const r=await sb.rpc('start_game_room',{p_room_id:id});if(r.error)toast(r.error.message);else{toast('La partie commence. Les rôles ont été distribués.');await refreshRoom();}});
        $('wolf-leave')?.addEventListener('click',async()=>{const r=await sb.rpc('leave_game_room',{p_room_id:id});if(r.error)toast(r.error.message);else closeRoom();});
      }else{
        const r=await sb.rpc('get_my_game_state',{p_room_id:id});if(r.error){box.textContent=r.error.message;return;}if(r.data.my_role==='witch'){const w=await sb.rpc('get_my_witch_state',{p_room_id:id});if(w.error){box.textContent=w.error.message;return;}r.data.witch_state=w.data||{};}if(r.data.my_role==='ancient'){const an=await sb.rpc('get_my_ancient_state',{p_room_id:id});if(an.error){box.textContent=an.error.message;return;}r.data.ancient_state=an.data||{};}
        box.innerHTML='<div class="wolf-hub"><section class="hub-scene">'+gameHTML(r.data)+'</section><aside class="hub-panel" id="wolf-hub-panel"></aside></div>';attachChat($('wolf-hub-panel'),{waiting:false,state:r.data});if(r.data.status==='finished')await loadProfile(u);
        box.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const a=await sb.rpc('submit_game_action',{p_room_id:id,p_target_id:b.dataset.target});if(a.error)toast(a.error.message);else{toast('Choix enregistré.');await refreshRoom();}}));
        box.querySelectorAll('[data-witch-action]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const a=await sb.rpc('submit_witch_action',{p_room_id:id,p_action:b.dataset.witchAction,p_target_id:null});if(a.error){toast(a.error.message);b.disabled=false;}else{toast(b.dataset.witchAction==='skip'?'Vous passez cette nuit.':'Potion utilisée.');await refreshRoom();}}));
        box.querySelectorAll('[data-witch-poison]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const a=await sb.rpc('submit_witch_action',{p_room_id:id,p_action:'poison',p_target_id:b.dataset.witchPoison});if(a.error){toast(a.error.message);b.disabled=false;}else{toast('Potion de mort utilisée.');await refreshRoom();}}));
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
  $('wolf-room-max').addEventListener('change',()=>{const max=Number($('wolf-room-max').value),wolves=Math.max(1,Math.ceil(max/4));renderCompositionFields({wolf:wolves,seer:1,healer:1,villager:Math.max(0,max-wolves-2)});updateCompositionTotal();});updateCompositionTotal();
  $('play-now').addEventListener('click',async()=>{const session=sb?await sb.auth.getSession():{data:{session:null}};if(session.data.session)showLobby();else showAuth();});
  $('back-home').addEventListener('click',()=>{$('lobby').classList.add('hidden');$('home').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});});
  $('auth-back').addEventListener('click',()=>{$('auth-screen').classList.add('hidden');$('home').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});});
  $('wolf-avatar').addEventListener('change',()=>{$('wolf-profile-preview').querySelector('span').textContent=$('wolf-avatar').value;});
  $('quick-join').addEventListener('click',async()=>{const u=await user();if(!u)return;const r=await sb.from('game_rooms').select('room_code,max_players,settings,room_players(count)').eq('status','waiting').order('created_at',{ascending:true}).limit(30);if(r.error){toast(r.error.message);return;}const room=(r.data||[]).find(x=>x.settings?.visibility!=='private'&&(x.room_players?.[0]?.count||0)<x.max_players);if(room)joinRoom(room.room_code);else toast('Aucun salon avec des places disponibles. Créez le vôtre ou utilisez un code.');});
  $('create-room').addEventListener('click',createRoom);
  $('profile-btn').addEventListener('click',()=>profile.scrollIntoView({behavior:'smooth',block:'center'}));
  if(!configured){status('Configuration Supabase manquante dans config.js.');profile.hidden=true;panel.hidden=true;}
  else{profile.hidden=true;panel.hidden=true;sb.auth.onAuthStateChange(()=>setTimeout(refreshAuth,0));refreshAuth();}
})();