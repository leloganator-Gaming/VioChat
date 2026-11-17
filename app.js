(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = s => { const el=$('toast'); el.textContent=s; el.classList.add('show'); clearTimeout(window.__wolfToast); window.__wolfToast=setTimeout(()=>el.classList.remove('show'),4200); };
  const cfg=window.WOLFANATOR_CONFIG||{}, configured=!!(cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase);
  const sb=configured?window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey):null;
  let currentRoom=null,channel=null,profileName='',currentUserId='',refreshing=false,isAlpha=false,isAdmin=false,adminPanel=null,autoBotPhaseKey='',isRoomHost=false,ambientLupixAt=0;
  let autoPhaseKey='',phaseResolveBusy=false;
  setInterval(()=>{const el=$('wolf-phase-timer');if(!el||!currentRoom||!sb)return;const phase=el.dataset.phase,start=Date.parse(el.dataset.startedAt),duration=phase==='day'?90:45,remaining=Math.max(0,duration-Math.floor((Date.now()-start)/1000));el.textContent='⏱️ '+Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');if(remaining===0&&el.dataset.host==='true'&&!phaseResolveBusy){const key=currentRoom+':'+phase+':'+el.dataset.startedAt;if(autoPhaseKey!==key){autoPhaseKey=key;phaseResolveBusy=true;const roomId=currentRoom;sb.rpc('resolve_game_phase',{p_room_id:roomId}).then(async result=>{if(result.error){console.warn('Fin automatique de phase :',result.error.message);autoPhaseKey='';}else if(currentRoom===roomId){toast('Temps écoulé : passage à la phase suivante.');await refreshRoom();}}).finally(()=>{phaseResolveBusy=false;});}}},1000);
  const ambientLupixTimer=setInterval(()=>{if(!currentRoom||!isRoomHost||!sb||Date.now()-ambientLupixAt<35000)return;ambientLupixAt=Date.now();const roomId=currentRoom;sb.functions.invoke('lupix-turn',{body:{room_id:roomId,mode:'ambient'}}).then(x=>{if(x.error)console.warn('Discussion spontanée Lupix indisponible :',x.error.message);else if(x.data?.spoke)console.info('Prise de parole de',x.data.player);}).catch(e=>console.warn('Discussion spontanée Lupix indisponible :',e));},15000);
  const lupixChatRefreshTimer=setInterval(()=>{if(currentRoom&&$('wolf-chat-messages'))loadChat();},2500);
  const roleCatalog=[["wolf","Loup-garou","🐺","loups","La meute choisit une cible chaque nuit."],["black_wolf","Loup Noir","🌑","loups","Peut infecter une cible une fois."],["talkative_wolf","Loup Bavard","🐺","loups","Doit placer un mot secret dans ses messages."],["white_wolf","Loup Blanc","🐺","solitaire","Joue avec les loups mais poursuit une victoire solitaire."],["mercenary","Mercenaire","🎯","solitaire","Reçoit une cible et vise une victoire individuelle."],["rumplestiltskin","Nain Tracassin","🧩","solitaire","Devine le rôle d'un joueur chaque nuit."],["sick_rat","Rat Malade","🐀","solitaire","Propage une contamination."],["villager","Simple Villageois","🏡","village","Débat et vote avec le village."],["seer","Voyante","🔮","village","Découvre le rôle d'un joueur chaque nuit."],["witch","Sorcière","🧙","village","Possède une potion de vie et une potion de mort."],["little_girl","Petite Fille","👧","village","Peut espionner les échanges nocturnes des loups."],["hunter","Chasseur","🏹","village","Peut entraîner un joueur dans son élimination."],["guard","Garde","🛡️","village","Protège un joueur chaque nuit sans répéter la cible."],["cupid","Cupidon","💘","village","Lie deux joueurs au début de la partie."],["mentalist","Mentaliste","🧠","village","Reçoit un indice sur le camp visé par le vote."],["necromancer","Nécromancien","💀","village","Accède aux échanges des joueurs éliminés."],["gravedigger","Fossoyeur","⚰️","village","Déclenche une information à son élimination."],["dictator","Dictateur","👑","village","Peut une fois déclencher un vote décisif."],["red_riding_hood","Chaperon Rouge","🧺","village","Protégé des loups tant que le Chasseur vit."],["pyromaniac","Pyromancien","🔥","village","Prépare une attaque spéciale."],["heir","Héritier","🧬","village","Peut hériter du rôle de son modèle éliminé."],["blue_hood","Chaperon Bleu","🩵","village","Protégé tant qu'un Villageois est en vie."],["pink_hood","Chaperon Rose","🩷","village","Protégé tant que les amoureux sont en vie."],["wolf_hood","Chaperon Loup","🐺","loups","Rejoint la meute."],["raider","Pillard","🗡️","village","Hérite du rôle du premier joueur éliminé."],["literate_wolf","Loup Lettré","📖","loups","Respecte une contrainte de lettre dans ses messages."],["healer","Guérisseuse","💚","village","Dispose d'une potion de soin à usage unique."],["poisoner","Empoisonneuse","☠️","village","Dispose d'une potion de poison à usage unique."],["chatty_seer","Voyante Bavarde","🔮","village","Révèle publiquement son résultat au matin."],["aura_seer","Voyante d'Aura","✨","village","Découvre si l'aura est claire ou obscure."],["ancient","Ancien","🧓","village","Résiste à la première attaque des loups."],["protector","Protecteur","🛡️","village","Protège une personne chaque nuit contre l’attaque des loups, sans répéter la cible deux nuits de suite."]].map(([key,name,icon,camp,description])=>({key,name,icon,camp,description}));
  const roles=Object.fromEntries(roleCatalog.map(r=>[r.key,r.name]));
  const icons=Object.fromEntries(roleCatalog.map(r=>[r.key,r.icon]));
  const descriptions=Object.fromEntries(roleCatalog.map(r=>[r.key,r.description]));
  const roleKeys=roleCatalog.map(r=>r.key);
  const alphaRoleKeys=['mercenary','sick_rat','raider'];
  roleCatalog.forEach(r=>{r.alphaOnly=alphaRoleKeys.includes(r.key);});
  const wolfCount=c=>wolfRoleKeys.reduce((n,k)=>n+Number(c[k]||0),0);
  const wolfRoleKeys=['wolf','black_wolf','talkative_wolf','white_wolf','wolf_hood','literate_wolf'];
  const seerRoleKeys=['seer','chatty_seer','aura_seer'];
  const protectorRoleKeys=['protector','guard'];

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
  panel.innerHTML='<p class="eyebrow">SALONS EN LIGNE</p><h3>Salons disponibles</h3><div class="field-grid room-fields"><input id="wolf-room-name" maxlength="40" placeholder="Nom du salon"><select id="wolf-room-max"><option value="5">5 joueurs</option><option value="8">8 joueurs</option><option value="10">10 joueurs</option><option value="12" selected>12 joueurs</option><option value="15">15 joueurs</option><option value="20">20 joueurs</option></select><select id="wolf-room-visibility" aria-label="Visibilité du salon"><option value="public">🌐 Public</option><option value="private">🔒 Privé (code)</option></select><label>Ajouter Lupix à la partie<select id="wolf-lupix-count" aria-label="Nombre de Lupix"><option value="0">Non</option><option value="1">1 Lupix</option><option value="2">2 Lupix</option><option value="3">3 Lupix maximum</option></select></label></div><div class="composition-editor"><h4>Choisissez les rôles de votre partie</h4><p>Le total des rôles doit correspondre au nombre de places. Les Lupix occupent chacun une place et reçoivent un rôle au hasard au lancement.</p><div class="composition-fields" id="wolf-composition-fields"></div><div class="composition-total" id="wolf-comp-total">Total : 12 / 12 joueurs</div></div><div class="button-row"><button class="primary" id="wolf-create">Créer le salon avec cette composition</button></div><div class="button-row"><button class="secondary wide" id="wolf-solo-create">🐺 Jouer seul contre les Lupix</button></div><div class="field-grid room-fields"><input id="wolf-room-code" maxlength="8" placeholder="Code du salon" autocomplete="off"><button class="secondary" id="wolf-join">Rejoindre avec un code</button></div><div id="wolf-rooms" class="room-list"><small>Les salons apparaîtront ici.</small></div><div id="wolf-current-room" class="current-room"></div>';
  $('lobby').appendChild(panel);
  function renderCompositionFields(comp={}){
    const box=$('wolf-composition-fields');if(!box)return;
    const classic=['villager','wolf'];
    const groups=[['Rôles classiques',classic],['Rôles spéciaux',roleKeys.filter(k=>!classic.includes(k))]];
    box.innerHTML=groups.map(([heading,keys])=>'<div class="composition-group"><h5>'+heading+'</h5><div class="composition-icon-grid">'+keys.map(key=>{
      const r=roleCatalog.find(x=>x.key===key),count=Math.max(0,Number(comp[key]||0)),multiple=key==='wolf'||key==='villager';
      return '<div class="composition-icon-card" title="'+esc(r.name)+'"><span class="composition-role-icon">'+r.icon+'</span><strong>'+esc(r.name)+'</strong>'+(r.alphaOnly?'<small>🔒 Alpha</small>':'')+'<div class="composition-stepper"><button type="button" data-role-minus="'+key+'" aria-label="Retirer '+esc(r.name)+'" '+(count===0?'disabled':'')+'>−</button><output id="wolf-comp-value-'+key+'">'+count+'</output><button type="button" data-role-plus="'+key+'" aria-label="Ajouter '+esc(r.name)+'" '+((multiple?count>=20:count>=1)?'disabled':'')+'>+</button></div><input type="hidden" id="wolf-comp-'+key+'" value="'+count+'" data-role-count="'+key+'"></div>';
    }).join('')+'</div></div>').join('');
    box.querySelectorAll('[data-role-minus]').forEach(btn=>btn.addEventListener('click',()=>changeCompositionCount(btn.dataset.roleMinus,-1)));
    box.querySelectorAll('[data-role-plus]').forEach(btn=>btn.addEventListener('click',()=>changeCompositionCount(btn.dataset.rolePlus,1)));
  }
  function changeCompositionCount(key,delta){
    const input=$('wolf-comp-'+key);if(!input)return;
    const multiple=key==='wolf'||key==='villager',max=multiple?20:1;
    input.value=String(Math.max(0,Math.min(max,Number(input.value||0)+delta)));
    const value=$('wolf-comp-value-'+key);if(value)value.textContent=input.value;
    const minus=document.querySelector('[data-role-minus="'+key+'"]'),plus=document.querySelector('[data-role-plus="'+key+'"]');
    if(minus)minus.disabled=Number(input.value)===0;
    if(plus)plus.disabled=Number(input.value)>=max;
    updateCompositionTotal();
  }
  renderCompositionFields({wolf:3,seer:1,protector:1,villager:7});
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
      const comp={wolf:1,seer:1,protector:1,villager:2};
      const r=await sb.rpc('create_game_room',{p_name:'[TEST ADMIN] Hub Wolfanator',p_max_players:5,p_display_name:pseudo(),p_composition:comp,p_visibility:'private'});
      if(r.error){b.disabled=false;toast('Création du salon de test impossible : '+r.error.message);return;}
      const bots=await sb.rpc('admin_fill_wolfanator_test_bots',{p_room_id:r.data[0].room_id});
      b.disabled=false;
      if(bots.error){toast('Salon créé, mais ajout des Lupix impossible : '+bots.error.message);await openRoom(r.data[0].room_id,r.data[0].room_code);return;}
      if(Number(bots.data||0)<4){toast('Attention : seuls '+Number(bots.data||0)+' bots ont été ajoutés. Actualise le salon avant de lancer.');}
      else toast('4 Lupix ajoutés et automatiquement prêts. Tu peux démarrer la partie.');
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
    const open=(waiting.data||[]).filter(x=>(x.settings?.visibility!=='private'||ids.includes(x.id))&&(x.room_players?.[0]?.count||0)<x.max_players);
    const active=playing.data||[];
    const cards=[...active,...open].map(x=>{const count=x.room_players?.[0]?.count||0,when=new Date(x.created_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});return '<div class="room-card"><span><strong>'+esc(x.name)+'</strong><small>'+(x.status==='playing'?'🎮 Partie en cours · réservée aux participants':'🏰 Salon ouvert · '+(x.max_players-count)+' place(s) disponible(s)')+' · '+count+'/'+x.max_players+' joueurs · Créé le '+when+'</small><small>Code : '+esc(x.room_code)+'</small></span>'+(x.status==='playing'?'<button class="secondary" data-resume="'+x.id+'" data-code="'+esc(x.room_code)+'">Reprendre</button>':'<button class="secondary" data-enter="'+esc(x.room_code)+'">Rejoindre</button>')+'</div>';}).join('');
    $('wolf-rooms').innerHTML=cards||'<div class="empty-rooms"><strong>Aucune partie à afficher</strong><small>Les salons ouverts apparaîtront ici. Créez-en un pour commencer ou rejoignez un ami avec son code.</small></div>';
    $('wolf-rooms').querySelectorAll('[data-enter]').forEach(b=>b.addEventListener('click',()=>joinRoom(b.dataset.enter)));
    $('wolf-rooms').querySelectorAll('[data-resume]').forEach(b=>b.addEventListener('click',()=>openRoom(b.dataset.resume,b.dataset.code)));
  }
  function getComposition(){return Object.fromEntries(roleKeys.map(k=>[k,Number($('wolf-comp-'+k)?.value||0)]));}
  function updateCompositionTotal(){const c=getComposition(),sum=Object.values(c).reduce((n,v)=>n+v,0),max=Number($('wolf-room-max').value),valid=Object.values(c).every(n=>Number.isInteger(n)&&n>=0)&&wolfCount(c)>=1&&sum===max;$('wolf-comp-total').textContent='Total : '+sum+' / '+max+' joueurs'+(valid?' · Composition valide':' · Ajustez les rôles');$('wolf-create').disabled=!valid;if($('wolf-solo-create'))$('wolf-solo-create').disabled=!valid;}

  async function createRoom(){
    const u=await user();if(!u)return;const comp=getComposition(),max=Number($('wolf-room-max').value),sum=Object.values(comp).reduce((a,b)=>a+b,0);
    if(wolfCount(comp)<1||sum!==max)return toast('La composition doit contenir au moins un rôle du camp des loups et totaliser exactement '+max+' rôles.');
    comp.lupix_count=Number($('wolf-lupix-count')?.value||0);const r=await sb.rpc('create_game_room',{p_name:$('wolf-room-name').value.trim()||'Salon Wolfanator',p_max_players:max,p_display_name:pseudo(),p_composition:comp,p_visibility:$('wolf-room-visibility').value});
    if(r.error)return toast(r.error.message);await openRoom(r.data[0].room_id,r.data[0].room_code);
  }
  async function createSoloRoom(){
    const u=await user();if(!u)return;const comp=getComposition(),max=Number($('wolf-room-max').value),sum=Object.values(comp).reduce((a,b)=>a+b,0);
    if(wolfCount(comp)<1||sum!==max)return toast('La composition doit contenir au moins un rôle de loup et totaliser exactement '+max+' rôles.');
    const b=$('wolf-solo-create');if(b)b.disabled=true;
    const r=await sb.rpc('create_solo_game_room',{p_max_players:max,p_display_name:pseudo(),p_composition:comp});
    if(b)b.disabled=false;if(r.error)return toast('Impossible de créer la partie solo : '+r.error.message);
    autoBotPhaseKey='';toast('Partie solo créée : les Lupix sont prêts.');await openRoom(r.data[0].room_id,r.data[0].room_code);
  }
  async function joinRoom(code){
    const u=await user();if(!u)return;const c=String(code||'').trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(c))return toast('Le code doit contenir 8 caractères.');
    const r=await sb.rpc('join_game_room',{p_room_code:c,p_display_name:pseudo()});if(r.error)return toast(r.error.message);await openRoom(r.data,c);
  }
  async function openRoom(id,code){
    currentRoom=id;isRoomHost=false;ambientLupixAt=0;if(channel)await sb.removeChannel(channel);
    channel=sb.channel('wolf-room-'+id).on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:'room_id=eq.'+id},refreshRoom).on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_rooms',filter:'id=eq.'+id},refreshRoom).on('postgres_changes',{event:'INSERT',schema:'public',table:'room_messages',filter:'room_id=eq.'+id},loadChat).subscribe();
    $('wolf-current-room').innerHTML='<div class="room-heading"><h3>Salon '+esc(code)+'</h3><div class="button-row"><button class="secondary" id="wolf-copy-code">Copier le code</button><button class="ghost" id="wolf-close-room">Fermer</button></div></div><div id="wolf-room-detail">Chargement…</div>';
    $('wolf-close-room').addEventListener('click',closeRoom);$('wolf-copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(code));toast('Code du salon copié.');}catch(e){toast('Copie automatique indisponible : '+code);}});await refreshRoom();
  }
  function closeRoom(){currentRoom=null;isRoomHost=false;ambientLupixAt=0;if(channel&&sb)sb.removeChannel(channel);channel=null;$('wolf-current-room').innerHTML='';loadRooms();}
  function waitingHTML(room,players,u){
    const me=players.find(p=>p.user_id===u.id),comp=room.settings?.composition||{};
    const compTotal=Object.values(comp).reduce((n,v)=>n+Number(v||0),0);
    const isTestRoom=String(room.name||'').startsWith('[TEST ADMIN]');
    const isReadyPlayer=p=>p.user_id===room.host_id||p.is_ready||((isTestRoom||isAdmin)&&String(p.display_name||'').startsWith('Bot '));
    const allReady=players.every(isReadyPlayer);
    const full=players.length===room.max_players,valid=compTotal===players.length;
    const canStart=full&&valid&&allReady;
    const reason=!full?'En attente de '+(room.max_players-players.length)+' joueur(s)…':!valid?'La composition doit correspondre au nombre de joueurs.':!allReady?'Certains joueurs ne sont pas encore prêts.':'Tout le monde est prêt : vous pouvez lancer la partie !';
    const avatars=['🧑🏽‍🌾','🧝🏻‍♀️','🧔🏽','👩🏼‍🦰','🧙🏻‍♂️','🧑🏻‍🚀','👩🏽‍🌾','🧑🏼‍🎤','🧑🏿‍🦱','👨🏻‍🌾','🧑🏻‍🦰','👩🏾‍🦱'];
    const seats=Array.from({length:room.max_players},(_,i)=>{
      const p=players[i],host=p?.user_id===room.host_id,ready=!!p&&isReadyPlayer(p);
      if(!p)return '<div class="wolf-scene-player empty"><span class="scene-avatar">＋</span><span class="scene-name">Place libre</span></div>';
      return '<div class="wolf-scene-player '+(ready?'ready':'')+'"><span class="scene-name">'+esc(p.display_name)+(host?' 👑':'')+'</span><span class="scene-avatar">'+avatars[i%avatars.length]+'</span><small>'+(host?'Créateur':ready?'Prêt':'En attente')+'</small>'+(room.host_id===u.id&&!host?'<button type="button" class="kick-player" data-kick="'+p.user_id+'">Retirer</button>':'')+'</div>';
    }).join('');
    const roles=roleCatalog.filter(r=>Number(comp[r.key]||0)>0).map(r=>'<span class="wolf-role-pill">'+r.icon+' '+esc(r.name)+' <b>×'+Number(comp[r.key])+'</b></span>').join('');
    return '<div class="wolf-waiting-room wolf-landscape"><div class="wolf-config-top"><div class="wolf-config-title"><button type="button" class="wolf-config-exit" id="wolf-leave-top">× Quitter</button><div><small>Configuration</small><strong>'+esc(room.name)+'</strong></div><b>'+players.length+' / '+room.max_players+' ◷</b></div><p>Préparez votre partie et retrouvez les autres joueurs dans le village.</p><div class="wolf-config-actions"><button type="button" id="wolf-open-composition">▤ Réglages</button><button type="button" id="wolf-copy-code">➤ Inviter</button></div></div><div class="wolf-landscape-scene"><div class="scene-mountains"></div><div class="scene-lake"></div><div class="scene-village">⌂</div><div class="scene-clearing"><div class="scene-campfire">🔥</div></div><div class="wolf-scene-players">'+seats+'</div></div><div class="wolf-scene-bottom"><div class="wolf-scene-status"><span>🐺</span><div><strong>Bienvenue '+esc(me?.display_name||'joueur')+' !</strong><small>'+esc(reason)+'</small></div></div><div class="wolf-scene-buttons"><button class="secondary" id="wolf-ready">'+(me?.is_ready?'Annuler ma préparation':'✓ Je suis prêt')+'</button>'+(room.host_id===u.id?'<button class="primary" id="wolf-start" '+(canStart?'':'disabled')+'>Lancer la partie →</button>':'')+'<button class="ghost" id="wolf-leave">Quitter le salon</button></div><div class="wolf-scene-invite">Code : <strong>'+esc(room.room_code)+'</strong> · '+players.length+'/'+room.max_players+' joueurs · '+(room.settings?.visibility==='private'?'🔒 Privé':'🌐 Public')+'</div><div class="wolf-scene-roles">'+(roles||'<small>Aucun rôle sélectionné</small>')+'</div></div></div>';
  }
  function gameHTML(s){
    const players=s.players||[],alive=players.filter(p=>p.is_alive),role=s.my_role,night=s.phase==='night',day=s.phase==='day',done=s.status==='finished'||s.phase==='finished';
    let desc=night?({wolf:'Choisissez une cible avec les autres loups.',seer:'Choisissez un joueur à examiner.',protector:'Choisissez une personne à protéger.',guard:'Choisissez une personne à protéger (pas la même deux nuits de suite).',witch:'Vous pouvez sauver la cible des loups ou empoisonner un joueur. Chaque potion ne s’utilise qu’une fois.',ancient:'Vous avez deux vies. La première attaque des loups vous blesse ; la seconde peut vous éliminer.',villager:'Vous êtes à l’abri cette nuit. Attendez le matin.'}[role]||descriptions[role]||'Votre rôle attend la prochaine phase.'):'Le village débat. Votez pour la personne que vous pensez être un loup.';
    const canAct=!done&&s.my_alive&&(night&&[...wolfRoleKeys,...seerRoleKeys,...protectorRoleKeys].includes(role)||day),potionTurn=!done&&s.my_alive&&night&&['witch','healer','poisoner'].includes(role),cupidTurn=!done&&s.my_alive&&night&&role==='cupid'&&Number(s.round)===1&&!s.cupid_state?.linked_players?.length,hunterTurn=!done&&role==='hunter'&&s.phase==='hunter'&&!s.my_alive,rumpleTurn=!done&&s.my_alive&&night&&role==='rumplestiltskin',sickRatTurn=!done&&s.my_alive&&night&&role==='sick_rat',dictatorTurn=!done&&s.my_alive&&day&&role==='dictator'&&s.dictator_state?.available,whiteWolfTurn=!done&&s.my_alive&&night&&role==='white_wolf'&&s.white_wolf_state?.attack_available,pyromaniacTurn=!done&&s.my_alive&&night&&role==='pyromaniac'&&s.pyromaniac_state?.attack_available;
    const targets=alive.filter(p=>p.user_id!==(day||seerRoleKeys.includes(role)||wolfRoleKeys.includes(role)||['witch','healer','poisoner','rumplestiltskin','sick_rat'].includes(role)?currentUserId:''));
    const label=night?({wolf:'Désigner la cible',seer:'Examiner ce joueur',protector:'Protéger ce joueur',guard:'Protéger ce joueur'}[role]||''):'Voter contre ce joueur';
    const targetHTML=canAct?'<div class="target-grid">'+targets.map(p=>'<button class="target-button" data-target="'+p.user_id+'"><strong>'+esc(p.display_name)+'</strong><small>'+(p.is_host?'👑 Hôte':'Joueur')+' · '+label+'</small></button>').join('')+'</div>':'';
    const rows=players.map((p,i)=>'<div class="player-chip '+(p.is_alive?'':'is-out')+(p.user_id===currentUserId?' is-me':'')+'" style="--seat:'+i+'"><div class="player-avatar">'+(p.is_alive?'🧑':'⚰️')+'</div><div class="player-chip-info"><strong>'+esc(p.display_name)+(p.is_host?' 👑':'')+(p.user_id===currentUserId?' <em>Vous</em>':'')+'</strong><small>'+(p.is_alive?'● En jeu':'Éliminé'+(p.revealed_role?' · '+esc(roles[p.revealed_role]||p.revealed_role):''))+'</small></div></div>').join('');
    const winner=s.winner==='village'?'Le village a gagné !':s.winner==='loups'?'Les loups-garous ont gagné !':s.winner==='mercenary'?'Le Mercenaire a gagné seul !':s.winner==='rumplestiltskin'?'Le Nain Tracassin a gagné seul !':s.winner==='white_wolf'?'Le Loup Blanc a gagné seul !':s.winner==='sick_rat'?'Le Rat Malade a contaminé les survivants !':s.winner==='lovers'?'Les amoureux ont gagné ensemble !':'Partie terminée',personalWin=(wolfRoleKeys.includes(role)&&s.winner==='loups')||(['mercenary','rumplestiltskin','white_wolf','sick_rat'].includes(role)&&s.winner===role)||(s.winner==='lovers'&&s.cupid_state?.linked_players?.includes(currentUserId))||(!wolfRoleKeys.includes(role)&&!['mercenary','rumplestiltskin','white_wolf'].includes(role)&&s.winner==='village');
    let html='<div class="game-status"><div><span class="eyebrow">WOLFANATOR · PARTIE EN COURS</span><strong class="phase-chip">'+(done?'🏁 Partie terminée':night?'🌙 Phase de nuit':s.phase==='hunter'?'🏹 Tour du Chasseur':'☀️ Phase de jour')+'</strong></div><div class="game-status-right">'+(!done?'<strong id="wolf-phase-timer" style="font-size:1.15rem;font-variant-numeric:tabular-nums" data-phase="'+esc(s.phase)+'" data-started-at="'+esc(s.phase_started_at||new Date().toISOString())+'" data-host="'+(s.is_host?'true':'false')+'">⏱️ --:--</strong>':'')+'<b>Manche '+s.round+'</b><span>'+alive.length+'/'+players.length+' joueurs en vie</span></div></div>';
    html+='<div class="role-card"><div class="role-icon">'+(icons[role]||'🎭')+'</div><div><small>VOTRE RÔLE SECRET</small><h3>'+esc(roles[role]||'En attente')+'</h3><p>'+esc(descriptions[role]||'')+'</p></div></div>';
    if(wolfRoleKeys.includes(role)&&s.wolf_team?.length)html+='<p class="team-note">Vos alliés : '+s.wolf_team.map(esc).join(', ')+'</p>';
    if(s.last_event)html+='<div class="story-event">'+esc(s.last_event)+'</div>';if(role==='mentalist'&&s.mentalist_state)html+='<div class="seer-result">🧠 Indice du Mentaliste : le vote vise actuellement '+esc(s.mentalist_state.target_name)+', du camp '+esc(s.mentalist_state.camp)+'.</div>';if(role==='mercenary'&&s.mercenary_state?.target_name)html+='<div class="seer-result">🎯 Votre cible : '+esc(s.mercenary_state.target_name)+(s.mercenary_state.target_alive?' est encore en jeu.':' a été éliminée.')+' Vous devez la faire éliminer au premier jour.</div>';if(role==='heir'&&s.heir_state?.target_name)html+='<div class="seer-result">🧬 Votre modèle : '+esc(s.heir_state.target_name)+(s.heir_state.target_alive?' est encore en jeu.':' a été éliminé : vous héritez de son rôle.')+'</div>';if(role==='dictator'&&s.dictator_state&&!s.dictator_state.available)html+='<div class="seer-result">👑 Votre pouvoir a déjà été utilisé.</div>';if(role==='talkative_wolf'&&s.talkative_wolf_state?.required_word)html+='<div class="seer-result">🐺 Mot secret du jour : <strong>'+esc(s.talkative_wolf_state.required_word)+'</strong> · '+(s.talkative_wolf_state.has_spoken?'Défi réussi':'À placer dans le chat public')+'</div>';if(role==='literate_wolf'&&s.literate_wolf_state?.forbidden_letter)html+='<div class="seer-result">📖 Lettre interdite aujourd’hui : <strong>'+esc(s.literate_wolf_state.forbidden_letter.toUpperCase())+'</strong> · '+(s.literate_wolf_state.has_used_letter?'Attention : lettre utilisée':'Défi respecté pour le moment')+'</div>';if(s.cupid_state?.linked_players?.length){const linked=players.filter(p=>s.cupid_state.linked_players.includes(p.user_id));if(linked.length)html+='<div class="seer-result">💘 Vous êtes liés : '+linked.map(p=>esc(p.display_name)).join(' et ')+'. Si l’un est éliminé, l’autre le sera aussi.</div>';}
    if(seerRoleKeys.includes(role)&&s.seer_result)html+='<div class="seer-result">🔮 Votre vision : '+esc(s.seer_result.name)+(role==='aura_seer'?' possède une aura '+esc(s.seer_result.aura)+'.':' est '+esc(roles[s.seer_result.role]||s.seer_result.role)+'.')+'</div>';if(role==='ancient'&&s.my_alive)html+='<div class="seer-result">🧓 Vies restantes : '+Number(s.ancient_state?.lives_remaining||1)+'/2</div>';
    if(done)html+='<div class="winner-card"><h3>'+winner+'</h3><p>Les rôles de tous les joueurs sont révélés.</p>'+(personalWin?'<strong class="win">🌙 Vous gagnez 1 Lune !</strong>':'<small>Pas de Lune cette fois. Une victoire vous rapporte 1 Lune.</small>')+'</div>';
    else{html+='<div class="action-area"><h3>'+(night?'Actions de la nuit':'Vote du village')+'</h3><p>'+esc(desc)+'</p>';
      if(canAct)html+='<p class="action-state">'+(s.my_action_submitted?'Votre choix est enregistré. Vous pouvez le modifier avant la fin de la phase.':'Vous n’avez pas encore envoyé votre choix.')+'</p>'+targetHTML;
      if(role==='black_wolf'&&s.black_wolf_state?.infection_available){html+='<button class="secondary" data-black-wolf-infect>🌑 Infecter la cible choisie par la meute (une fois)</button>';}
      if(cupidTurn){const options=alive.map(p=>'<option value="'+p.user_id+'">'+esc(p.display_name)+'</option>').join('');html+='<div class="witch-actions"><h4>💘 Cupidon : lier deux joueurs</h4><label>Premier amoureux<select id="cupid-first">'+options+'</select></label><label>Second amoureux<select id="cupid-second">'+options+'</select></label><button class="primary" data-cupid-link>Confirmer les amoureux</button></div>';}
      if(pyromaniacTurn){html+='<div class="witch-actions"><h4>🔥 Attaque du Pyromancien</h4><p>Vous disposez d’une attaque unique. Choisissez votre cible.</p><div class="target-grid">'+alive.filter(p=>p.user_id!==currentUserId).map(p=>'<button class="target-button" data-pyromaniac-target="'+p.user_id+'">🔥 Enflammer '+esc(p.display_name)+'</button>').join('')+'</div></div>';}
      if(whiteWolfTurn){html+='<div class="witch-actions"><h4>🌕 Attaque solitaire du Loup Blanc</h4><p>Vous pouvez choisir une cible supplémentaire cette nuit.</p><div class="target-grid">'+alive.filter(p=>p.user_id!==currentUserId).map(p=>'<button class="target-button" data-white-wolf-target="'+p.user_id+'">🌕 Attaquer '+esc(p.display_name)+'</button>').join('')+'</div></div>';}
      if(dictatorTurn){html+='<div class="witch-actions"><h4>👑 Pouvoir du Dictateur</h4><p>Vous pouvez une seule fois imposer une exécution immédiate. Le vote collectif sera ignoré.</p><div class="target-grid">'+alive.filter(p=>p.user_id!==currentUserId).map(p=>'<button class="target-button" data-dictator-target="'+p.user_id+'">👑 Exécuter '+esc(p.display_name)+'</button>').join('')+'</div></div>';}
      if(sickRatTurn){html+='<div class="witch-actions"><h4>🐀 Contamination</h4><p>Choisissez une personne encore saine. La contamination progresse chaque nuit.</p><div class="target-grid">'+targets.map(p=>'<button class="target-button" data-sick-rat-target="'+p.user_id+'">🐀 Contaminer '+esc(p.display_name)+'</button>').join('')+'</div><small>Joueurs contaminés : '+Number(s.sick_rat_state?.length||0)+'</small></div>';}
      if(rumpleTurn){html+='<div class="witch-actions"><h4>🧩 Nain Tracassin : devinez un rôle</h4><label>Joueur ciblé<select id="rumple-target">'+targets.map(p=>'<option value="'+p.user_id+'">'+esc(p.display_name)+'</option>').join('')+'</select></label><label>Rôle supposé<select id="rumple-role">'+roleCatalog.map(r=>'<option value="'+r.key+'">'+r.icon+' '+esc(r.name)+'</option>').join('')+'</select></label><button class="primary" data-rumple-guess>Valider ma devinette</button></div>';}
      if(hunterTurn){html+='<p>Avant de quitter la partie, vous pouvez choisir un joueur encore en jeu.</p><div class="target-grid">'+alive.map(p=>'<button class="target-button" data-hunter-shot="'+p.user_id+'">🏹 Viser '+esc(p.display_name)+'</button>').join('')+'</div>';}
      if(potionTurn){html+='<div class="witch-actions"><h4>🧪 Vos potions</h4>'+(['witch','healer'].includes(role)?(s.witch_state?.heal_available?'<button class="secondary" data-witch-action="heal">🧪 Utiliser la potion de vie</button>':'<small>🧪 Potion de vie déjà utilisée</small>'):'')+(['witch','poisoner'].includes(role)?(s.witch_state?.poison_available?'<p>☠️ Choisissez une cible :</p><div class="target-grid">'+targets.map(p=>'<button class="target-button" data-witch-poison="'+p.user_id+'">☠️ Empoisonner '+esc(p.display_name)+'</button>').join('')+'</div>':'<small>☠️ Potion de mort déjà utilisée</small>'):'')+(role==='witch'?'<button class="ghost" data-witch-action="skip">Passer cette nuit</button>':'')+'</div>';}
      else if(night&&['witch','healer','poisoner'].includes(role)&&s.my_alive)html+='<p class="waiting-note">Vos deux potions ont été utilisées. Vous n’avez plus d’action nocturne.</p>';
      if(night&&role==='villager')html+='<p class="waiting-note">Attendez le passage au jour.</p>';
      if(!s.my_alive)html+='<p class="waiting-note">Vous êtes éliminé. Vous pouvez observer la suite de la partie.</p>';
      html+='</div>';}
    html+='<section class="game-table"><div class="game-table-head"><div><span class="eyebrow">LE VILLAGE</span><h3>Joueurs autour de la table</h3></div><span class="game-alive-count">🟢 '+alive.length+' vivants</span></div><div class="game-player-stage"><div class="game-table-art"><span class="table-moon">'+(night?'🌙':'☀️')+'</span><strong>'+ (night?'Le village dort':'Place du village') +'</strong><small>Manche '+s.round+'</small></div><div class="game-seat-grid">'+rows+'</div></div></section>';
    if(!done&&s.is_host)html+='<div class="button-row host-controls">'+(String(s.room_name||'').startsWith('[TEST ADMIN]')?'<button class="secondary" id="wolf-run-bots">🤖 Faire jouer les bots</button>':'')+'<button class="primary" id="wolf-resolve">'+(s.phase==='hunter'?'Résoudre la phase':night?'Terminer la nuit':'Clôturer le vote')+'</button></div><small>'+(String(s.room_name||'').startsWith('[TEST ADMIN]')?'Les bots jouent automatiquement leur choix de phase. Fais ton action si nécessaire, puis termine la phase.':'L’hôte termine la phase lorsque tous les joueurs concernés ont agi.')+'</small>';
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
  async function loadDeadChat(){
    const box=$('wolf-dead-chat-messages');if(!currentRoom||!sb||!box)return;
    const r=await sb.rpc('get_dead_chat',{p_room_id:currentRoom});
    if(r.error){box.innerHTML='<small>Discussion des esprits indisponible : '+esc(r.error.message)+'</small>';return;}
    box.innerHTML=(r.data||[]).map(m=>'<div class="chat-message"><div><strong>'+esc(m.display_name)+'</strong><small>'+new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</small></div><p>'+esc(m.body)+'</p></div>').join('')||'<small>Aucun message des esprits.</small>';
    box.scrollTop=box.scrollHeight;
  }
  async function sendDeadChat(e){
    e.preventDefault();const input=$('wolf-dead-chat-input'),body=input?.value.trim();if(!body||!currentRoom)return;
    input.disabled=true;const r=await sb.rpc('send_dead_chat',{p_room_id:currentRoom,p_body:body});input.disabled=false;
    if(r.error){toast(r.error.message);return;}input.value='';await loadDeadChat();input.focus();
  }

  function attachChat(box,context={}){
    const wrap=document.createElement('section');wrap.className='hub-chat';
    wrap.innerHTML='<div class="hub-tabs"><button class="hub-tab active" data-hub-tab="discussion">💬 Discussion</button><button class="hub-tab" data-hub-tab="composition">📜 Composition</button><button class="hub-tab" data-hub-tab="rules">❔ Règles</button>'+(context.state&&((context.state.my_role==='necromancer'&&context.state.my_alive&&context.state.phase==='night')||!context.state.my_alive)?'<button class="hub-tab" data-hub-tab="dead">💀 Esprits</button>':'')+'</div><div class="hub-tab-content" id="wolf-hub-tab-content"></div>';
    box.appendChild(wrap);
    const content=$('wolf-hub-tab-content'),tabs=wrap.querySelectorAll('[data-hub-tab]');
    const showTab=key=>{
      tabs.forEach(t=>t.classList.toggle('active',t.dataset.hubTab===key));
      if(key==='discussion'){
        content.innerHTML='<div class="chat-heading"><div><p class="eyebrow">VILLAGE EN DIRECT</p><h3>Discussion de la partie</h3></div><small>Messages du salon</small></div><div class="chat-messages" id="wolf-chat-messages" aria-live="polite"><small>Chargement…</small></div><form class="chat-form" id="wolf-chat-form"><input id="wolf-chat-input" maxlength="500" autocomplete="off" placeholder="Écrire un message…" aria-label="Votre message" required><button class="primary" type="submit">Envoyer</button></form>';
        loadChat();$('wolf-chat-form').addEventListener('submit',sendChat);
        if(wolfRoleKeys.includes(context.state?.my_role)&&context.state?.my_alive){
          content.insertAdjacentHTML('beforeend','<section class="wolf-private-chat"><div class="chat-heading"><div><p class="eyebrow">CANAL CONFIDENTIEL</p><h3>🐺 Discussion des loups</h3></div><button type="button" class="ghost" id="wolf-private-refresh">Actualiser</button></div><div class="chat-messages private-messages" id="wolf-private-chat-messages"><small>Chargement…</small></div><form class="chat-form" id="wolf-private-chat-form"><input id="wolf-private-chat-input" maxlength="500" autocomplete="off" placeholder="Message réservé aux loups…" aria-label="Message privé aux loups" required><button class="primary" type="submit">Envoyer</button></form><small>Seuls les loups encore en jeu peuvent lire et envoyer ces messages.</small></section>');
          loadWolfChat();
          $('wolf-private-refresh').addEventListener('click',loadWolfChat);
          $('wolf-private-chat-form').addEventListener('submit',sendWolfChat);
        }else if(context.state?.my_role==='little_girl'&&context.state?.my_alive&&context.state?.phase==='night'){
          content.insertAdjacentHTML('beforeend','<section class="wolf-private-chat"><div class="chat-heading"><div><p class="eyebrow">ESPIONNAGE NOCTURNE</p><h3>👧 Écoute de la meute</h3></div><button type="button" class="ghost" id="wolf-private-refresh">Actualiser</button></div><div class="chat-messages private-messages" id="wolf-private-chat-messages"><small>Chargement…</small></div><small>La Petite Fille peut lire les messages de la meute, mais ne peut pas y participer.</small></section>');
          loadWolfChat();$('wolf-private-refresh').addEventListener('click',loadWolfChat);
        }
      }else if(key==='composition'){
        if(context.waiting){
          const comp=context.room.settings?.composition||{},host=context.room.host_id===currentUserId;
          content.innerHTML='<p class="eyebrow">COMPOSITION DU SALON</p><h3>Préparation de la partie</h3><div class="hub-info-row"><span>Joueurs présents</span><strong>'+context.players.length+'/'+context.room.max_players+'</strong></div><div class="hub-info-row"><span>Salon</span><strong>'+esc(context.room.name)+'</strong></div><div class="hub-info-row"><span>Accès</span><strong>'+(context.room.settings?.visibility==='private'?'🔒 Privé':'🌐 Public')+'</strong></div><div class="hub-info-row"><span>🤖 Lupix dans la partie</span><strong>'+Number(context.room.settings?.lupix_count||0)+'/3</strong></div><h4>Rôles prévus</h4>'+roleCatalog.map(r=>'<div class="hub-role-line">'+r.icon+' '+esc(r.name)+' <span>'+Number(comp[r.key]||0)+'</span></div>').join('')+(host?'<div class="hub-editor"><h4>⚙️ Paramètres du créateur</h4><label>Nom du salon<input id="hub-edit-name" maxlength="40" value="'+esc(context.room.name)+'"></label><label>Nombre de places<select id="hub-edit-max">'+[5,8,10,12,15,20].map(n=>'<option value="'+n+'" '+(n===context.room.max_players?'selected':'')+'>'+n+' joueurs</option>').join('')+'</select></label><label>Visibilité<select id="hub-edit-visibility"><option value="public" '+(context.room.settings?.visibility!=='private'?'selected':'')+'>Public</option><option value="private" '+(context.room.settings?.visibility==='private'?'selected':'')+'>Privé (code uniquement)</option></select></label><div class="composition-fields" id="hub-composition-fields"></div><div id="hub-comp-total" class="composition-total"></div><button type="button" class="primary wide" id="hub-save-settings">Enregistrer les paramètres</button></div>':'<p class="muted-note">Seul le créateur peut modifier la composition et les paramètres du salon. La partie démarre lorsque le nombre de joueurs correspond aux rôles choisis.</p>');
          if(host){const roleBox=$('hub-composition-fields');roleBox.innerHTML=roleCatalog.map(r=>'<label>'+r.icon+' '+esc(r.name)+'<input type="number" id="hub-comp-'+r.key+'" min="0" max="19" step="1" value="'+Number(comp[r.key]||0)+'"></label>').join('');const total=()=>{const max=Number($('hub-edit-max').value),composition=Object.fromEntries(roleKeys.map(k=>[k,Number($('hub-comp-'+k).value||0)])),sum=Object.values(composition).reduce((v,n)=>v+n,0),wolves=['wolf','black_wolf','talkative_wolf','white_wolf','wolf_hood','literate_wolf'].reduce((v,k)=>v+Number(composition[k]||0),0);$('hub-comp-total').textContent='Total : '+sum+' / '+max+' joueurs'+(sum===max&&wolves>0?' · Composition valide':' · Total à corriger');$('hub-save-settings').disabled=sum!==max||wolves<1||max<context.players.length;};roleKeys.forEach(k=>$('hub-comp-'+k).addEventListener('input',total));$('hub-edit-max').addEventListener('change',total);total();$('hub-save-settings').addEventListener('click',async()=>{const button=$('hub-save-settings');button.disabled=true;const composition=Object.fromEntries(roleKeys.map(k=>[k,Number($('hub-comp-'+k).value||0)]));const result=await sb.rpc('update_game_room_settings',{p_room_id:currentRoom,p_name:$('hub-edit-name').value.trim(),p_max_players:Number($('hub-edit-max').value),p_composition:composition,p_visibility:$('hub-edit-visibility').value});if(result.error){toast(result.error.message);button.disabled=false;}else{toast('Paramètres du salon enregistrés. Les joueurs doivent se remettre prêts.');await refreshRoom();}});}
        }else{
          const s=context.state||{},ps=s.players||[],alive=ps.filter(p=>p.is_alive).length,comp=s.composition||{};
          content.innerHTML='<p class="eyebrow">COMPOSITION DE LA PARTIE</p><h3>Rôles distribués</h3><div class="hub-info-row"><span>Manche</span><strong>'+Number(s.round||1)+'</strong></div><div class="hub-info-row"><span>Phase</span><strong>'+(s.phase==='night'?'Nuit':'Jour')+'</strong></div><div class="hub-info-row"><span>Joueurs en vie</span><strong>'+alive+'/'+ps.length+'</strong></div>'+roleCatalog.map(r=>'<div class="hub-role-line">'+r.icon+' '+esc(r.name)+' <span>'+Number(comp[r.key]||0)+' · '+esc(r.camp)+'</span></div>').join('')+'<p class="muted-note">Les rôles secrets des autres joueurs restent masqués jusqu’à leur élimination ou à la fin de la partie.</p>';
        }
      }else if(key==='dead'){
        content.innerHTML='<div class="chat-heading"><div><p class="eyebrow">SALON DES ESPRITS</p><h3>💀 Discussion des éliminés</h3></div><button type="button" class="ghost" id="wolf-dead-refresh">Actualiser</button></div><div class="chat-messages" id="wolf-dead-chat-messages"><small>Chargement…</small></div><form class="chat-form" id="wolf-dead-chat-form"><input id="wolf-dead-chat-input" maxlength="500" autocomplete="off" placeholder="Écrire aux esprits…" required><button class="primary" type="submit">Envoyer</button></form><small>Les joueurs éliminés peuvent discuter ici. Le Nécromancien y accède pendant la nuit.</small>';
        loadDeadChat();$('wolf-dead-refresh').addEventListener('click',loadDeadChat);$('wolf-dead-chat-form').addEventListener('submit',sendDeadChat);
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
      const r=await sb.from('room_messages').insert({room_id:roomId,user_id:currentUserId,display_name:(profileName||'Joueur').slice(0,24),body}).select('id').single();
      input.disabled=false;if(r.error){toast(r.error.message);return;}input.value='';await loadChat();input.focus();
      sb.functions.invoke('lupix-turn',{body:{room_id:roomId,mode:'reply',message_id:r.data.id}})
        .then(x=>{if(x.error)console.warn('Réponse Lupix indisponible :',x.error.message);})
        .catch(e=>console.warn('Réponse Lupix indisponible :',e));
    };
    tabs.forEach(t=>t.addEventListener('click',()=>showTab(t.dataset.hubTab)));
    showTab('discussion');
  }
  async function refreshRoom(){
    if(!currentRoom||!sb||refreshing)return;refreshing=true;const id=currentRoom;
    try{
      const values=await Promise.all([sb.from('game_rooms').select('*').eq('id',id).single(),sb.from('room_players').select('user_id,display_name,is_ready,is_alive,revealed_role').eq('room_id',id).order('joined_at'),sb.auth.getUser()]);
      if(currentRoom!==id)return;const box=$('wolf-room-detail');if(!box)return;
      const room=values[0].data,players=values[1].data,u=values[2].data.user;isRoomHost=!!u?.id&&room?.host_id===u.id;
       if(isRoomHost&&players.some(p=>String(p.display_name||'').startsWith('Bot Lupix'))&&Date.now()-ambientLupixAt>35000){ambientLupixAt=Date.now();sb.functions.invoke('lupix-turn',{body:{room_id:id,mode:'ambient'}}).then(x=>{if(x.error)console.warn('Premier message Lupix indisponible :',x.error.message);}).catch(e=>console.warn('Premier message Lupix indisponible :',e));}
      if(values[0].error||values[1].error){box.textContent=(values[0].error||values[1].error).message;return;}
      currentUserId=u.id;
      if(room.status==='waiting'){
        autoBotPhaseKey='';
        box.innerHTML='<div class="wolf-hub waiting-mode"><section class="hub-scene">'+waitingHTML(room,players,u)+'</section><aside class="hub-panel" id="wolf-hub-panel"></aside></div>';attachChat($('wolf-hub-panel'),{waiting:true,room,players});$('wolf-open-composition')?.addEventListener('click',()=>box.querySelector('[data-hub-tab="composition"]')?.click());$('wolf-copy-code')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(room.room_code));toast('Code du salon copié.');}catch(e){toast('Code du salon : '+room.room_code);}});$('wolf-leave-top')?.addEventListener('click',()=>closeRoom());box.querySelector('.wolf-copy-code-inner')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(room.room_code));toast('Code du salon copié.');}catch(e){toast('Code du salon : '+room.room_code);}});
        box.querySelectorAll('[data-kick]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Retirer ce joueur du salon ?'))return;b.disabled=true;const k=await sb.rpc('kick_room_player',{p_room_id:id,p_target_user_id:b.dataset.kick});if(k.error){toast(k.error.message);b.disabled=false;}else{toast('Joueur retiré du salon.');await refreshRoom();}}));
        $('wolf-ready')?.addEventListener('click',async()=>{const me=players.find(p=>p.user_id===u.id);const r=await sb.rpc('set_room_ready',{p_room_id:id,p_ready:!me?.is_ready});if(r.error)toast(r.error.message);else await refreshRoom();});
        $('wolf-start')?.addEventListener('click',async()=>{const r=await sb.rpc('start_game_room',{p_room_id:id});if(r.error)toast(r.error.message);else{toast('La partie commence. Les rôles ont été distribués.');await refreshRoom();}});
        $('wolf-leave')?.addEventListener('click',async()=>{const r=await sb.rpc('leave_game_room',{p_room_id:id});if(r.error)toast(r.error.message);else closeRoom();});
      }else{
        const r=await sb.rpc('get_my_game_state',{p_room_id:id});if(r.error){box.textContent=r.error.message;return;}
        box.innerHTML='<div class="wolf-hub"><section class="hub-scene">'+gameHTML(r.data)+'</section><aside class="hub-panel" id="wolf-hub-panel"></aside></div>';attachChat($('wolf-hub-panel'),{waiting:false,state:r.data});if(r.data.status==='finished')await loadProfile(u);box.querySelector('#wolf-run-bots')?.addEventListener('click',async()=>{const b=$('wolf-run-bots');b.disabled=true;const result=await sb.rpc('admin_run_wolfanator_test_bots',{p_room_id:id});b.disabled=false;if(result.error){toast('Erreur des bots : '+result.error.message);return;}toast(result.data?.message||'Les Lupix ont joué.');await refreshRoom();});
        const hasLupix=(r.data.players||[]).some(p=>String(p.display_name||'').startsWith('Bot Lupix'));const botMatch=String(r.data.room_name||'').startsWith('[SOLO]')||String(r.data.room_name||'').startsWith('[TEST ADMIN]')||hasLupix;
        const botPhaseKey=id+':'+r.data.phase+':'+r.data.round;
        if(botMatch&&r.data.status==='playing'&&r.data.is_host===true&&autoBotPhaseKey!==botPhaseKey){
          autoBotPhaseKey=botPhaseKey;
          Promise.resolve().then(async()=>{
            const botRun=await sb.rpc('admin_run_wolfanator_test_bots',{p_room_id:id});
            if(botRun.error){autoBotPhaseKey='';toast('Les Lupix n’ont pas pu jouer : '+botRun.error.message);return;}
            const lupixTurn=await sb.functions.invoke('lupix-turn',{body:{room_id:id}});
            if(lupixTurn.error)console.warn('Tour Lupix indisponible :',lupixTurn.error.message);
            await refreshRoom();
          });
        }
        box.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const a=await sb.rpc('submit_game_action',{p_room_id:id,p_target_id:b.dataset.target});if(a.error)toast(a.error.message);else{toast('Choix enregistré.');await refreshRoom();}}));
        box.querySelectorAll('[data-witch-action]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const a=await sb.rpc('submit_witch_action',{p_room_id:id,p_action:b.dataset.witchAction,p_target_id:null});if(a.error){toast(a.error.message);b.disabled=false;}else{toast(b.dataset.witchAction==='skip'?'Vous passez cette nuit.':'Potion utilisée.');await refreshRoom();}}));
        box.querySelectorAll('[data-witch-poison]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const a=await sb.rpc('submit_witch_action',{p_room_id:id,p_action:'poison',p_target_id:b.dataset.witchPoison});if(a.error){toast(a.error.message);b.disabled=false;}else{toast('Potion de mort utilisée.');await refreshRoom();}}));
        box.querySelector('[data-cupid-link]')?.addEventListener('click',async b=>{const first=$('cupid-first')?.value,second=$('cupid-second')?.value;if(!first||!second||first===second){toast('Choisissez deux joueurs différents.');return;}b.currentTarget.disabled=true;const r=await sb.rpc('submit_cupid_links',{p_room_id:id,p_first_id:first,p_second_id:second});if(r.error){toast(r.error.message);b.currentTarget.disabled=false;}else{toast('Les amoureux sont maintenant liés.');await refreshRoom();}});
        box.querySelectorAll('[data-hunter-shot]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const r=await sb.rpc('submit_hunter_shot',{p_room_id:id,p_target_id:b.dataset.hunterShot});if(r.error){toast(r.error.message);b.disabled=false;}else{toast('Votre dernier tir est enregistré.');await refreshRoom();}}));
        box.querySelector('[data-rumple-guess]')?.addEventListener('click',async b=>{const target=$('rumple-target')?.value,guess=$('rumple-role')?.value;if(!target||!guess)return toast('Choisissez un joueur et un rôle.');b.currentTarget.disabled=true;const r=await sb.rpc('submit_rumple_guess',{p_room_id:id,p_target_id:target,p_guess_role:guess});if(r.error){toast(r.error.message);b.currentTarget.disabled=false;}else{toast('Votre devinette est enregistrée.');await refreshRoom();}});
        box.querySelectorAll('[data-sick-rat-target]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const r=await sb.rpc('submit_sick_rat_infection',{p_room_id:id,p_target_id:b.dataset.sickRatTarget});if(r.error){toast(r.error.message);b.disabled=false;}else{toast('La contamination est enregistrée.');await refreshRoom();}}));
        box.querySelectorAll('[data-dictator-target]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const r=await sb.rpc('submit_dictator_execution',{p_room_id:id,p_target_id:b.dataset.dictatorTarget});if(r.error){toast(r.error.message);b.disabled=false;}else{toast('L’exécution du Dictateur est enregistrée.');await refreshRoom();}}));
        box.querySelectorAll('[data-white-wolf-target]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const r=await sb.rpc('submit_white_wolf_attack',{p_room_id:id,p_target_id:b.dataset.whiteWolfTarget});if(r.error){toast(r.error.message);b.disabled=false;}else{toast('Votre attaque solitaire est enregistrée.');await refreshRoom();}}));
        box.querySelectorAll('[data-pyromaniac-target]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const r=await sb.rpc('submit_pyromaniac_attack',{p_room_id:id,p_target_id:b.dataset.pyromaniacTarget});if(r.error){toast(r.error.message);b.disabled=false;}else{toast('Votre attaque unique est enregistrée.');await refreshRoom();}}));
        box.querySelector('[data-black-wolf-infect]')?.addEventListener('click',async b=>{b.currentTarget.disabled=true;const r=await sb.rpc('submit_black_wolf_infection',{p_room_id:id});if(r.error){toast(r.error.message);b.currentTarget.disabled=false;}else{toast('Infection activée : elle s’appliquera à la cible de la meute.');await refreshRoom();}});
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
  $('wolf-solo-create')?.addEventListener('click',createSoloRoom);
  $('wolf-join').addEventListener('click',()=>joinRoom($('wolf-room-code').value));
  $('wolf-room-code').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);});
  $('wolf-room-max').addEventListener('change',()=>{const max=Number($('wolf-room-max').value),wolves=Math.max(1,Math.ceil(max/4));renderCompositionFields({wolf:wolves,seer:1,protector:1,villager:Math.max(0,max-wolves-2)});updateCompositionTotal();});updateCompositionTotal();
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