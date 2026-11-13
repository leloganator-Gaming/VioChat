(() => {
  const config = window.VIOCHAT_CONFIG || {};
  const authView = document.getElementById("auth-view");
  const appView = document.getElementById("app-view");
  const feedback = document.getElementById("feedback");
  const form = document.getElementById("auth-form");
  const signupTab = document.getElementById("signup-tab");
  const loginTab = document.getElementById("login-tab");
  const usernameField = document.getElementById("username-field");
  const usernameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitBtn = document.getElementById("submit-btn");
  let mode = "signup", supabase = null, currentUser = null, activeChat = null, messageChannel = null;
  let avatarConfig = { skin:"#d99a70", hair:"#51302a", shirt:"#8d45df", style:"short" };
  const profileAvatars = {};

  const $ = id => document.getElementById(id);
  function message(text, type="") { feedback.textContent=text; feedback.className="feedback "+type; }
  function authMode(next) {
    mode=next; const signup=mode==="signup";
    signupTab.classList.toggle("active",signup); loginTab.classList.toggle("active",!signup);
    usernameField.classList.toggle("hidden",!signup); usernameInput.required=signup; usernameInput.disabled=!signup;
    $("form-title").textContent=signup?"Créer un compte":"Content de te revoir";
    $("form-subtitle").textContent=signup?"Rejoins la communauté, c'est gratuit.":"Connecte-toi pour retrouver tes conversations.";
    submitBtn.querySelector("span").textContent=signup?"Créer mon compte":"Me connecter"; message("");
  }
  function showAuth(){ appView.classList.add("hidden"); authView.classList.remove("hidden"); }
  function showApp(user){
    currentUser=user; authView.classList.add("hidden"); appView.classList.remove("hidden");
    const pseudo=user.user_metadata?.username || user.email?.split("@")[0] || "Membre";
    $("user-pseudo").textContent=pseudo; $("welcome-name").textContent=pseudo;
    $("user-email").textContent=user.email||""; $("avatar-letter").textContent=pseudo[0].toUpperCase();
    loadProfile();
  }
  signupTab.addEventListener("click",()=>authMode("signup"));
  loginTab.addEventListener("click",()=>authMode("login"));

  if(!config.SUPABASE_URL || !/^sb_publishable_|^eyJ/.test(config.SUPABASE_ANON_KEY||"")){
    message("Configuration Supabase absente ou incomplète. Vérifie config.js.","error"); return;
  }
  if(!window.supabase?.createClient){ message("La bibliothèque Supabase n'a pas pu être chargée.","error"); return; }
  supabase=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY);

  form.addEventListener("submit",async e=>{
    e.preventDefault(); message(""); submitBtn.disabled=true;
    submitBtn.querySelector("span").textContent="Patiente…";
    try{
      const email=emailInput.value.trim(), password=passwordInput.value;
      if(mode==="signup"){
        const username=usernameInput.value.trim();
        if(!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error("Le pseudo doit contenir 3 à 20 lettres, chiffres ou _.");
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username},emailRedirectTo:location.origin+location.pathname}});
        if(error) throw error;
        if(data.session) showApp(data.user); else message("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse.","success");
      }else{
        const {data,error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error; showApp(data.user);
      }
    }catch(err){message(err.message||"Une erreur est survenue.","error");}
    finally{submitBtn.disabled=false;submitBtn.querySelector("span").textContent=mode==="signup"?"Créer mon compte":"Me connecter";}
  });

  async function loadProfile(){
    const {data}=await supabase.from("profiles").select("username,avatar_config").eq("id",currentUser.id).maybeSingle();
    if(data?.avatar_config){avatarConfig={...avatarConfig,...data.avatar_config};}
    profileAvatars[currentUser.id] = avatarConfig;
    $("avatar-name").textContent=data?.username||currentUser.user_metadata?.username||"Membre";
    syncAvatarControls(); drawAvatar();
    await loadChats();
  }

  // Avatar 3D cartoon construit avec des formes Three.js personnalisables.
  let scene,camera,renderer,avatarRoot,avatarReady=false;
  function drawAvatar(){
    const host=$("avatar-canvas"); if(!host || !window.THREE) return;
    const T=window.THREE;
    if(!renderer){
      scene=new T.Scene(); scene.background=new T.Color("#171020");
      camera=new T.PerspectiveCamera(35,1,.1,100); camera.position.set(0,1.35,5.8);
      renderer=new T.WebGLRenderer({antialias:true,alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); host.innerHTML=""; host.appendChild(renderer.domElement);
      scene.add(new T.HemisphereLight(0xffffff,0x554066,2));
      const light=new T.DirectionalLight(0xffffff,2.2); light.position.set(-3,5,5); scene.add(light);
      avatarRoot=new T.Group(); scene.add(avatarRoot);
      const resize=()=>{const w=host.clientWidth||300,h=host.clientHeight||300;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);};
      new ResizeObserver(resize).observe(host); resize();
      let dragging=false,lastX=0;
      renderer.domElement.addEventListener("pointerdown",e=>{dragging=true;lastX=e.clientX;});
      renderer.domElement.addEventListener("pointerup",()=>dragging=false);
      renderer.domElement.addEventListener("pointerleave",()=>dragging=false);
      renderer.domElement.addEventListener("pointermove",e=>{if(dragging){avatarRoot.rotation.y+=(e.clientX-lastX)*.012;lastX=e.clientX;renderer.render(scene,camera);}});
      avatarReady=true;
    }
    while(avatarRoot.children.length) {const obj=avatarRoot.children.pop();obj.traverse?.(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});}
    const mat=(color,roughness=.78)=>new T.MeshStandardMaterial({color,roughness});
    const sphere=(x,y,z,sx,sy,sz,color)=>{const m=new T.Mesh(new T.SphereGeometry(1,32,24),mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);avatarRoot.add(m);return m;};
    const cylinder=(x,y,z,rt,rb,h,color)=>{const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,32),mat(color));m.position.set(x,y,z);avatarRoot.add(m);return m;};
    const skin=avatarConfig.skin,hair=avatarConfig.hair,shirt=avatarConfig.shirt;
    cylinder(0,-.78,0,.67,.76,.9,shirt); sphere(0,-.27,.02,.48,.18,.42,skin);
    cylinder(0,-.12,0,.18,.2,.35,skin);
    sphere(0,.65,0,.72,.83,.62,skin);
    sphere(-.72,.62,0,.13,.2,.12,skin); sphere(.72,.62,0,.13,.2,.12,skin);
    // Hair cap and selectable silhouette.
    sphere(0,1.18,-.03,.74,.42,.65,hair);
    if(avatarConfig.style==="curly"){
      for(let i=0;i<9;i++){const a=i*Math.PI*2/9;sphere(Math.cos(a)*.55,1.28+Math.sin(a)*.12,-.02,.22,.23,.22,hair);}
    }else if(avatarConfig.style==="long"){
      sphere(-.57,.55,-.18,.2,.72,.25,hair);sphere(.57,.55,-.18,.2,.72,.25,hair);
    }else{sphere(0,1.34,.3,.5,.2,.34,hair);}
    const eyeMat=mat("#241927",.35);
    for(const x of [-.25,.25]){const eye=new T.Mesh(new T.SphereGeometry(.055,16,12),eyeMat);eye.position.set(x,.68,.565);avatarRoot.add(eye);}
    const smile=new T.Mesh(new T.TorusGeometry(.13,.018,8,24,Math.PI),mat("#8b4853"));smile.position.set(0,.38,.57);smile.rotation.z=Math.PI;avatarRoot.add(smile);
    renderer.render(scene,camera);
  }
  function syncAvatarControls(){
    if($("skin-color")) $("skin-color").value=avatarConfig.skin;
    if($("hair-color")) $("hair-color").value=avatarConfig.hair;
    if($("shirt-color")) $("shirt-color").value=avatarConfig.shirt;
    if($("hair-style")) $("hair-style").value=avatarConfig.style;
  }
  ["skin-color","hair-color","shirt-color","hair-style"].forEach(id=>{
    $(id)?.addEventListener("input",()=>{avatarConfig={...avatarConfig,skin:$("skin-color").value,hair:$("hair-color").value,shirt:$("shirt-color").value,style:$("hair-style").value};drawAvatar();});
  });
  $("save-avatar")?.addEventListener("click",async()=>{
    const {error}=await supabase.from("profiles").update({avatar_config:avatarConfig}).eq("id",currentUser.id);
    $("avatar-save-status").textContent=error?("Erreur : "+error.message):"Avatar enregistré !";
  });

  // Petit rendu 3D du même avatar, utilisé dans les conversations et près des messages.
  function drawMiniAvatar(host, config){
    if(!host || !window.THREE) return;
    const T=window.THREE, c={skin:"#d99a70",hair:"#51302a",shirt:"#8d45df",style:"short",...(config||{})};
    host.innerHTML="";
    const scene=new T.Scene();
    const camera=new T.PerspectiveCamera(35,1,.1,30);camera.position.set(0,0,4.2);
    const renderer=new T.WebGLRenderer({antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setSize(48,48,false);host.appendChild(renderer.domElement);
    scene.add(new T.HemisphereLight(0xffffff,0x554066,2));
    const light=new T.DirectionalLight(0xffffff,2);light.position.set(-2,3,4);scene.add(light);
    const root=new T.Group();scene.add(root);
    const mat=color=>new T.MeshStandardMaterial({color,roughness:.78});
    const head=new T.Mesh(new T.SphereGeometry(.78,24,18),mat(c.skin));head.position.y=.25;root.add(head);
    const hair=new T.Mesh(new T.SphereGeometry(.8,24,18),mat(c.hair));hair.scale.set(1,.48,.9);hair.position.set(0,.78,-.02);root.add(hair);
    if(c.style==="long"){
      for(const x of [-.58,.58]){const side=new T.Mesh(new T.SphereGeometry(.22,16,12),mat(c.hair));side.scale.set(1,2.1,1);side.position.set(x,-.05,-.08);root.add(side);}
    }else if(c.style==="curly"){
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const curl=new T.Mesh(new T.SphereGeometry(.24,14,10),mat(c.hair));curl.position.set(Math.cos(a)*.53,.88+Math.sin(a)*.1,0);root.add(curl);}
    }
    const shirt=new T.Mesh(new T.CylinderGeometry(.62,.8,.72,24),mat(c.shirt));shirt.position.y=-.95;root.add(shirt);
    const eyeMat=mat("#241927");
    for(const x of [-.25,.25]){const eye=new T.Mesh(new T.SphereGeometry(.055,12,10),eyeMat);eye.position.set(x,.28,.69);root.add(eye);}
    renderer.render(scene,camera);
    host._avatarRenderer=renderer;
  }

  async function loadChats(){
    const list=$("chat-list"); list.innerHTML="<p class='muted'>Chargement des conversations…</p>";
    const {data:chats,error}=await supabase.from("direct_chats").select("id,user_a,user_b").or("user_a.eq."+currentUser.id+",user_b.eq."+currentUser.id).order("created_at",{ascending:false});
    if(error){list.innerHTML="<p class='muted'>La messagerie doit être activée avec le script SQL indiqué dans le dépôt.</p>";return;}
    if(!chats?.length){list.innerHTML="<p class='muted'>Aucune conversation. Recherche un pseudo pour commencer.</p>";return;}
    const otherIds=chats.map(c=>c.user_a===currentUser.id?c.user_b:c.user_a);
    const {data:profiles}=await supabase.from("profiles").select("id,username,avatar_config").in("id",otherIds);
    list.innerHTML="";
    chats.forEach(chat=>{
      const otherId=chat.user_a===currentUser.id?chat.user_b:chat.user_a;
      const profile=profiles?.find(p=>p.id===otherId);
      const btn=document.createElement("button");btn.className="chat-item";
      const face=document.createElement("span");face.className="mini-avatar list-avatar";drawMiniAvatar(face,profile?.avatar_config);
      const name=document.createElement("span");name.className="chat-item-name";name.textContent=profile?.username||"Membre";
      btn.append(face,name);btn.addEventListener("click",()=>openChat(chat,profile));list.appendChild(btn);
    });
  }
  $("find-user")?.addEventListener("submit",async e=>{
    e.preventDefault();const username=$("find-username").value.trim();
    $("find-status").textContent="Recherche…";
    const {data:user,error}=await supabase.from("profiles").select("id,username").ilike("username",username).neq("id",currentUser.id).maybeSingle();
    if(error||!user){$("find-status").textContent="Pseudo introuvable.";return;}
    const [a,b]=[currentUser.id,user.id].sort();
    const {data:existing}=await supabase.from("direct_chats").select("id,user_a,user_b").eq("user_a",a).eq("user_b",b).maybeSingle();
    let chat=existing;
    if(!chat){const {data,error:createError}=await supabase.from("direct_chats").insert({user_a:a,user_b:b}).select().single();if(createError){$("find-status").textContent="Impossible de créer la conversation : "+createError.message;return;}chat=data;}
    $("find-status").textContent="Conversation ouverte avec "+user.username;
    await loadChats();openChat(chat,user);
  });

  async function openChat(chat,profile){
    activeChat=chat;
    const otherId=chat.user_a===currentUser.id?chat.user_b:chat.user_a;
    const {data:members}=await supabase.from("profiles").select("id,username,avatar_config").in("id",[currentUser.id,otherId]);
    (members||[]).forEach(member=>{profileAvatars[member.id]=member.avatar_config||{skin:"#d99a70",hair:"#51302a",shirt:"#8d45df",style:"short"};});
    const otherProfile=members?.find(member=>member.id===otherId)||profile;
    $("active-chat-name").textContent=otherProfile?.username||"Conversation";
    drawMiniAvatar($("chat-avatar"),otherProfile?.avatar_config);
    $("chat-empty").classList.add("hidden");$("chat-room").classList.remove("hidden");
    if(messageChannel) await supabase.removeChannel(messageChannel);
    await loadMessages();
    messageChannel=supabase.channel("chat-"+chat.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages",filter:"chat_id=eq."+chat.id},payload=>{
      if(payload.new.sender_id!==currentUser.id) appendMessage(payload.new);
    }).subscribe();
  }
  function appendMessage(msg){
    const mine=msg.sender_id===currentUser.id;
    const row=document.createElement("div");row.className="message-row "+(mine?"mine":"theirs");
    const face=document.createElement("div");face.className="mini-avatar message-avatar";
    drawMiniAvatar(face,profileAvatars[msg.sender_id]);
    const bubble=document.createElement("div");bubble.className="bubble "+(mine?"mine":"theirs");
    bubble.textContent=msg.content;
    if(mine) row.append(bubble,face); else row.append(face,bubble);
    $("messages").appendChild(row);$("messages").scrollTop=$("messages").scrollHeight;
  }
  async function loadMessages(){
    $("messages").innerHTML="";
    const {data,error}=await supabase.from("chat_messages").select("*").eq("chat_id",activeChat.id).order("created_at",{ascending:true}).limit(100);
    if(error){$("messages").textContent="Erreur de chargement : "+error.message;return;}
    (data||[]).forEach(appendMessage);
  }
  $("send-message")?.addEventListener("submit",async e=>{
    e.preventDefault();if(!activeChat)return;const input=$("message-input"),content=input.value.trim();if(!content)return;
    input.value="";
    const {data,error}=await supabase.from("chat_messages").insert({chat_id:activeChat.id,sender_id:currentUser.id,content}).select().single();
    if(error){$("chat-status").textContent="Erreur : "+error.message;input.value=content;return;}
    appendMessage(data);$("chat-status").textContent="";
  });
  $("logout-btn").addEventListener("click",async()=>{if(messageChannel)await supabase.removeChannel(messageChannel);await supabase.auth.signOut();currentUser=null;activeChat=null;showAuth();authMode("login");});
  supabase.auth.getSession().then(({data})=>{if(data.session?.user)showApp(data.session.user);});
  supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user)showApp(session.user);else{currentUser=null;showAuth();}});
})();