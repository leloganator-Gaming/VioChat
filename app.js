(() => {
  const $ = id => document.getElementById(id);
  const toast = message => {
    const el = $('toast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(window.__wolfToast);
    window.__wolfToast = setTimeout(() => el.classList.remove('show'), 4000);
  };
  const cfg = window.WOLFANATOR_CONFIG || {};
  const readyConfig = cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase;
  const sb = readyConfig ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey) : null;
  let currentRoom = null;
  let channel = null;

  const authPanel = document.createElement('div');
  authPanel.className = 'panel';
  authPanel.style.marginBottom = '22px';
  authPanel.innerHTML = `
    <p class="eyebrow">COMPTE JOUEUR</p><h3>Connexion au village</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
      <input id="wolf-email" type="email" autocomplete="email" placeholder="Adresse e-mail" style="padding:13px;border-radius:10px;border:1px solid #51446a;background:#171321;color:white">
      <input id="wolf-password" type="password" autocomplete="current-password" placeholder="Mot de passe" style="padding:13px;border-radius:10px;border:1px solid #51446a;background:#171321;color:white">
      <input id="wolf-pseudo" maxlength="24" placeholder="Ton pseudo" style="padding:13px;border-radius:10px;border:1px solid #51446a;background:#171321;color:white">
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
      <button class="primary" id="wolf-login">Se connecter</button>
      <button class="secondary" id="wolf-signup">Créer un compte</button>
      <button class="ghost" id="wolf-logout" hidden>Déconnexion</button>
    </div><small id="wolf-auth-status">Connecte-toi pour créer ou rejoindre un salon.</small>`;
  $('lobby').insertBefore(authPanel, $('lobby').querySelector('.lobby-grid'));

  const roomPanel = document.createElement('div');
  roomPanel.className = 'panel';
  roomPanel.style.marginTop = '18px';
  roomPanel.innerHTML = `
    <p class="eyebrow">SALONS EN LIGNE</p><h3>Salons disponibles</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
      <input id="wolf-room-name" maxlength="40" placeholder="Nom du salon" style="padding:12px;border-radius:10px;border:1px solid #51446a;background:#171321;color:white">
      <select id="wolf-room-max" style="padding:12px;border-radius:10px;background:#171321;color:white"><option value="8">8 joueurs</option><option value="10">10 joueurs</option><option value="12" selected>12 joueurs</option><option value="15">15 joueurs</option><option value="20">20 joueurs</option></select>
      <button class="secondary" id="wolf-create">Créer un salon</button>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
      <input id="wolf-room-code" maxlength="8" placeholder="Code du salon" style="padding:12px;border-radius:10px;border:1px solid #51446a;background:#171321;color:white;text-transform:uppercase">
      <button class="secondary" id="wolf-join">Rejoindre avec un code</button>
    </div>
    <div id="wolf-rooms" style="display:grid;gap:10px"><small>Les salons apparaîtront ici.</small></div>
    <div id="wolf-current-room" style="margin-top:14px"></div>`;
  $('lobby').appendChild(roomPanel);

  const authStatus = text => { $('wolf-auth-status').textContent = text; };
  const userPseudo = () => $('wolf-pseudo').value.trim() || 'Joueur';
  const requireClient = () => {
    if (!sb) { toast('Configuration Supabase manquante : renseigne l’URL et la clé publishable dans config.js.'); return false; }
    return true;
  };
  const refreshAuth = async () => {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    $('wolf-logout').hidden = !session;
    authStatus(session ? 'Connecté : ' + (session.user.email || 'joueur') : 'Non connecté.');
    $('wolf-login').hidden = !!session;
    $('wolf-signup').hidden = !!session;
    if (session) loadRooms();
  };
  const doAuth = async mode => {
    if (!requireClient()) return;
    const email = $('wolf-email').value.trim(), password = $('wolf-password').value;
    if (!email || password.length < 6) { toast('Indique un e-mail et un mot de passe de 6 caractères minimum.'); return; }
    const result = mode === 'signup'
      ? await sb.auth.signUp({ email, password, options: { data: { username: userPseudo() } } })
      : await sb.auth.signInWithPassword({ email, password });
    if (result.error) { toast(result.error.message); return; }
    if (mode === 'signup' && !result.data.session) authStatus('Compte créé. Vérifie ton e-mail si la confirmation est activée dans Supabase.');
    else { toast(mode === 'signup' ? 'Compte créé.' : 'Connexion réussie.'); await refreshAuth(); }
  };
  $('wolf-login').addEventListener('click', () => doAuth('login'));
  $('wolf-signup').addEventListener('click', () => doAuth('signup'));
  $('wolf-logout').addEventListener('click', async () => { await sb.auth.signOut(); currentRoom = null; if (channel) sb.removeChannel(channel); $('wolf-current-room').innerHTML = ''; await refreshAuth(); });
  const signedUser = async () => {
    if (!requireClient()) return null;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) toast('Connecte-toi d’abord pour continuer.');
    return user;
  };
  const loadRooms = async () => {
    if (!sb) return;
    const { data, error } = await sb.from('game_rooms').select('id,room_code,name,status,max_players,host_id,room_players(count)').eq('status','waiting').order('created_at',{ascending:false}).limit(20);
    if (error) { $('wolf-rooms').textContent = error.message; return; }
    $('wolf-rooms').innerHTML = data.length ? data.map(r => `
      <div style="padding:13px;border:1px solid #51446a;border-radius:12px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <span><strong>${escapeHtml(r.name)}</strong><br><small>Code ${r.room_code} · ${r.room_players?.[0]?.count || 0}/${r.max_players} joueurs</small></span>
        <button class="secondary" data-enter="${r.room_code}">Rejoindre</button>
      </div>`).join('') : '<small>Aucun salon ouvert pour le moment.</small>';
    $('wolf-rooms').querySelectorAll('[data-enter]').forEach(b => b.addEventListener('click', () => joinRoom(b.dataset.enter)));
  };
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const createRoom = async () => {
    const user = await signedUser(); if (!user) return;
    const { data, error } = await sb.rpc('create_game_room', { p_name: $('wolf-room-name').value || 'Salon Wolfanator', p_max_players: Number($('wolf-room-max').value), p_display_name: userPseudo() });
    if (error) { toast(error.message); return; }
    await openRoom(data[0].room_id, data[0].room_code);
  };
  const joinRoom = async code => {
    const user = await signedUser(); if (!user) return;
    const { data, error } = await sb.rpc('join_game_room', { p_room_code: code, p_display_name: userPseudo() });
    if (error) { toast(error.message); return; }
    await openRoom(data, code.toUpperCase());
  };
  const openRoom = async (id, code) => {
    currentRoom = id;
    if (channel) await sb.removeChannel(channel);
    channel = sb.channel('wolf-room-' + id).on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:'room_id=eq.'+id},refreshRoom)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_rooms',filter:'id=eq.'+id},refreshRoom).subscribe();
    $('wolf-current-room').innerHTML = '<h3>Salon ' + escapeHtml(code) + '</h3><div id="wolf-room-detail">Chargement…</div>';
    await refreshRoom();
  };
  const refreshRoom = async () => {
    if (!currentRoom || !sb) return;
    const [{data:room,error:re},{data:players,error:pe},{data:{user}}] = await Promise.all([
      sb.from('game_rooms').select('*').eq('id',currentRoom).single(),
      sb.from('room_players').select('user_id,display_name,is_ready').eq('room_id',currentRoom).order('joined_at'),
      sb.auth.getUser()
    ]);
    const box = $('wolf-room-detail'); if (!box) return;
    if (re || pe) { box.textContent = (re || pe).message; return; }
    const host = room.host_id === user.id;
    box.innerHTML = `<p>État : <strong>${room.status === 'waiting' ? 'En attente' : room.status === 'playing' ? 'Partie lancée' : 'Terminée'}</strong> · ${players.length}/${room.max_players} joueurs</p>
      <ul>${players.map(p=>'<li>'+escapeHtml(p.display_name)+(p.is_ready?' — prêt':' — en attente')+(p.user_id===room.host_id?' ★ Hôte':'')+'</li>').join('')}</ul>
      <div style="display:flex;gap:9px;flex-wrap:wrap">
        ${room.status==='waiting' ? '<button class="secondary" id="wolf-ready">Je suis prêt</button>' : ''}
        ${host && room.status==='waiting' ? '<button class="primary" id="wolf-start">Lancer la partie</button>' : ''}
        ${room.status==='waiting' ? '<button class="ghost" id="wolf-leave">Quitter le salon</button>' : ''}
      </div>`;
    const ready = $('wolf-ready');
    if (ready) ready.addEventListener('click', async () => {
      const me = players.find(p=>p.user_id===user.id);
      const {error} = await sb.rpc('set_room_ready',{p_room_id:currentRoom,p_ready:!me?.is_ready});
      if (error) toast(error.message); else await refreshRoom();
    });
    const start = $('wolf-start');
    if (start) start.addEventListener('click', async () => {
      const {error} = await sb.rpc('start_game_room',{p_room_id:currentRoom});
      if (error) toast(error.message); else toast('La partie est lancée ! Les rôles sont distribués côté serveur.');
      await refreshRoom();
    });
    const leave = $('wolf-leave');
    if (leave) leave.addEventListener('click', async () => {
      const id = currentRoom; const {error} = await sb.rpc('leave_game_room',{p_room_id:id});
      if (error) toast(error.message); else { currentRoom=null; if(channel) sb.removeChannel(channel); $('wolf-current-room').innerHTML=''; await loadRooms(); }
    });
  };
  $('wolf-create').addEventListener('click',createRoom);
  $('wolf-join').addEventListener('click',()=>joinRoom($('wolf-room-code').value.trim()));
  $('play-now').addEventListener('click',()=>{ $('home').classList.add('hidden'); $('lobby').classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); });
  $('back-home').addEventListener('click',()=>{ $('lobby').classList.add('hidden'); $('home').classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); });
  $('quick-join').addEventListener('click',async()=>{
    const user=await signedUser(); if(!user)return;
    const {data,error}=await sb.from('game_rooms').select('room_code').eq('status','waiting').order('created_at',{ascending:true}).limit(1).maybeSingle();
    if(error)toast(error.message); else if(data)joinRoom(data.room_code); else toast('Aucun salon ouvert. Crée le tien ou rejoins un ami avec son code.');
  });
  $('create-room').addEventListener('click',createRoom);
  $('profile-btn').addEventListener('click',()=>toast('La personnalisation du profil arrive dans une prochaine étape.'));
  if (!readyConfig) authStatus('À configurer : URL et clé publishable Supabase dans config.js.');
  else { sb.auth.onAuthStateChange(()=>refreshAuth()); refreshAuth(); }
})();
