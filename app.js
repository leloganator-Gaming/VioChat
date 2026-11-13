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
  let avatarConfig = {
    skin:"#d99a70", face:"oval", eyes:"round", eyeColor:"#38251f", brows:"natural", nose:"small", mouth:"smile",
    hair:"#51302a", style:"short", shirt:"#8d45df", outfit:"hoodie", pants:"#292b52", pantsStyle:"jeans",
    shoes:"#f2edf8", shoeStyle:"sneakers", glasses:"none", hat:"none", accessory:"none", accessoryColor:"#f4c95d"
  };
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
        // Une inscription doit toujours repartir sans session précédente.
        // Sinon Supabase peut conserver le compte déjà connecté dans ce navigateur.
        const {error:signOutError}=await supabase.auth.signOut({scope:"local"});
        if(signOutError) throw signOutError;
        currentUser=null; activeChat=null;
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
    profileAvatars[currentUser.id] = {...avatarConfig};
    
    syncAvatarControls(); drawAvatar();
    await loadChats();
    await loadNotifications();
  }

  // Créateur d'avatar 3D original : visage, cheveux, tenue et accessoires.
  let scene,camera,renderer,avatarRoot;
  function drawAvatar(){
    const host=$("avatar-canvas"); if(!host || !window.THREE) return;
    const T=window.THREE;
    if(!renderer){
      scene=new T.Scene();scene.background=new T.Color("#171020");
      camera=new T.PerspectiveCamera(35,1,.1,100);camera.position.set(0,1.05,6.5);
      renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.innerHTML="";host.appendChild(renderer.domElement);
      scene.add(new T.HemisphereLight(0xffffff,0x554066,2));
      const light=new T.DirectionalLight(0xffffff,2.4);light.position.set(-3,5,5);scene.add(light);
      avatarRoot=new T.Group();scene.add(avatarRoot);
      const resize=()=>{const w=host.clientWidth||300,h=host.clientHeight||300;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);};
      new ResizeObserver(resize).observe(host);resize();
      let dragging=false,lastX=0;
      renderer.domElement.addEventListener("pointerdown",e=>{dragging=true;lastX=e.clientX;});
      renderer.domElement.addEventListener("pointerup",()=>dragging=false);
      renderer.domElement.addEventListener("pointerleave",()=>dragging=false);
      renderer.domElement.addEventListener("pointermove",e=>{if(dragging){avatarRoot.rotation.y+=(e.clientX-lastX)*.012;lastX=e.clientX;renderer.render(scene,camera);}});
    }
    while(avatarRoot.children.length){const obj=avatarRoot.children.pop();obj.traverse?.(o=>{o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
    const mat=(color,roughness=.78,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
    const sphere=(x,y,z,sx,sy,sz,color,group=avatarRoot)=>{const m=new T.Mesh(new T.SphereGeometry(1,32,24),mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);group.add(m);return m;};
    const box=(x,y,z,sx,sy,sz,color,group=avatarRoot)=>{const m=new T.Mesh(new T.BoxGeometry(sx,sy,sz),mat(color));m.position.set(x,y,z);group.add(m);return m;};
    const cyl=(x,y,z,rt,rb,h,color,group=avatarRoot)=>{const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,32),mat(color));m.position.set(x,y,z);group.add(m);return m;};
    const torus=(x,y,z,r,t,color,group=avatarRoot)=>{const m=new T.Mesh(new T.TorusGeometry(r,t,10,32),mat(color));m.position.set(x,y,z);group.add(m);return m;};
    const c=avatarConfig, skin=c.skin||"#d99a70", hair=c.hair||"#51302a";
    // Corps et vêtements
    cyl(0,-1.02,0,.62,.72,.82,c.shirt||"#8d45df");
    if(c.outfit==="hoodie"){sphere(0,-.72,-.05,.12,.32,.08,shade(c.shirt,-35));}
    if(c.outfit==="jacket"){box(-.3,-.95,.52,.12,.7,.08,shade(c.shirt,-35));box(.3,-.95,.52,.12,.7,.08,shade(c.shirt,-35));}
    if(c.outfit==="shirt"){for(let y=-.72;y>-1.25;y-=.14)sphere(0,y,.58,.025,.025,.02,"#f3edf8");}
    cyl(0,-1.72,0,.34,.34,.58,c.pants||"#292b52");
    if(c.pantsStyle==="shorts"){box(-.18,-1.55,.02,.28,.32,.38,c.pants);box(.18,-1.55,.02,.28,.32,.38,c.pants);}
    if(c.pantsStyle==="skirt"){cyl(0,-1.58,0,.48,.64,.38,c.pants);}
    else {cyl(-.18,-2.05,0,.17,.18,.55,c.pants);cyl(.18,-2.05,0,.17,.18,.55,c.pants);}
    sphere(-.2,-2.43,.12,.2,.12,.34,c.shoes);sphere(.2,-2.43,.12,.2,.12,.34,c.shoes);
    if(c.shoeStyle==="boots"){cyl(-.2,-2.3,.02,.18,.18,.32,c.shoes);cyl(.2,-2.3,.02,.18,.18,.32,c.shoes);}
    // Cou et visage
    cyl(0,-.25,0,.18,.2,.34,skin);
    const head=sphere(0,.62,0,.69,.82,.58,skin);
    if(c.face==="round")head.scale.set(.75,.75,.62);
    if(c.face==="square")head.scale.set(.72,.78,.62);
    if(c.face==="long")head.scale.set(.64,.91,.57);
    sphere(-.69,.57,0,.13,.19,.12,skin);sphere(.69,.57,0,.13,.19,.12,skin);
    // Oreilles/accessoires
    if(c.accessory==="earrings"){for(const x of [-.76,.76])sphere(x,.34,.03,.055,.09,.05,c.accessoryColor);}
    if(c.accessory==="chain"){torus(0,-.43,.32,.28,.035,c.accessoryColor);}
    if(c.accessory==="headphones"){for(const x of [-.75,.75])sphere(x,.82,0,.15,.24,.16,c.accessoryColor);torus(0,.88,-.02,.72,.07,c.accessoryColor);}
    // Coiffures en volumes distincts
    sphere(0,1.18,-.04,.72,.39,.61,hair);
    const strand=(x,y,z,sx,sy,sz)=>sphere(x,y,z,sx,sy,sz,hair);
    if(c.style==="long"||c.style==="bob"){strand(-.57,.48,-.12,.18,.68,.22);strand(.57,.48,-.12,.18,.68,.22);if(c.style==="bob"){strand(0,.34,-.08,.57,.2,.2);}}
    if(c.style==="curly"||c.style==="afro"){const n=c.style==="afro"?18:10;for(let i=0;i<n;i++){const a=i*Math.PI*2/n;strand(Math.cos(a)*.53,1.23+Math.sin(a)*.12,-.03,.22,.23,.22);}if(c.style==="afro")strand(0,1.34,-.03,.65,.38,.58);}
    if(c.style==="ponytail"){strand(.72,.72,-.35,.2,.48,.22);}
    if(c.style==="spiky"){for(let i=0;i<7;i++){const x=(i-3)*.17;const spike=new T.Mesh(new T.ConeGeometry(.13,.48,16),mat(hair));spike.position.set(x,1.48,.02);spike.rotation.z=-x*.5;avatarRoot.add(spike);}}
    if(c.style==="bun")strand(.05,1.52,-.35,.28,.28,.28);
    // Yeux, sourcils, nez, bouche
    const eyeScale=c.eyes==="wide"?[.13,.17,.07]:c.eyes==="narrow"?[.14,.055,.06]:c.eyes==="soft"?[.12,.09,.07]:[.09,.11,.07];
    for(const x of [-.25,.25]){
      sphere(x,.66,.52,...eyeScale,"#fff");
      sphere(x,.65,.585,.045,.06,.025,c.eyeColor||"#38251f");
      sphere(x-.015,.675,.607,.015,.02,.01,"#fff");
      const browH=c.brows==="thick"?.055:c.brows==="thin"?.018:.032;
      box(x,.84,.53,.2,browH,.045,hair);
    }
    if(c.nose==="small")sphere(0,.48,.59,.055,.08,.08,skin);
    if(c.nose==="round")sphere(0,.46,.59,.09,.09,.09,shade(skin,-18));
    if(c.nose==="long")sphere(0,.43,.59,.05,.13,.07,shade(skin,-12));
    if(c.mouth==="smile"){const m=new T.Mesh(new T.TorusGeometry(.13,.022,8,24,Math.PI),mat("#8b4853"));m.position.set(0,.22,.55);m.rotation.z=Math.PI;avatarRoot.add(m);}
    else if(c.mouth==="wide"){sphere(0,.22,.55,.16,.045,.025,"#9e465b");}
    else {box(0,.22,.56,.13,.018,.02,"#9e465b");}
    // Lunettes
    if(c.glasses!=="none"){
      const glassColor=c.glasses==="sunglasses"?"#211b30":"#28202f";
      for(const x of [-.25,.25]){
        if(c.glasses==="round")torus(x,.65,.61,.14,.025,glassColor);
        else box(x,.65,.61,.3,.2,.035,glassColor);
      }
      box(0,.66,.62,.13,.035,.035,glassColor);
    }
    // Chapeaux
    if(c.hat==="cap"){sphere(0,1.42,-.02,.68,.18,.58,c.accessoryColor);box(0,1.31,.42,.65,.06,.35,c.accessoryColor);}
    if(c.hat==="beanie"){sphere(0,1.43,-.02,.67,.29,.59,c.accessoryColor);torus(0,1.25,.02,.59,.07,c.accessoryColor);}
    if(c.hat==="crown"){cyl(0,1.45,0,.48,.55,.16,c.accessoryColor);for(let i=0;i<5;i++)sphere((i-2)*.2,1.58,.02,.07,.1,.07,"#fff0a8");}
    renderer.render(scene,camera);
  }
  function shade(hex,amount){const n=parseInt((hex||"#888888").replace("#",""),16);const f=v=>Math.max(0,Math.min(255,v+amount));return "#"+[f(n>>16),f((n>>8)&255),f(n&255)].map(v=>v.toString(16).padStart(2,"0")).join("");}
  const avatarFields={"skin-color":"skin","face-shape":"face","eye-style":"eyes","eye-color":"eyeColor","brow-style":"brows","nose-style":"nose","mouth-style":"mouth","hair-style":"style","hair-color":"hair","outfit-style":"outfit","shirt-color":"shirt","pants-style":"pantsStyle","pants-color":"pants","shoe-style":"shoeStyle","shoe-color":"shoes","glasses-style":"glasses","hat-style":"hat","accessory-style":"accessory","accessory-color":"accessoryColor"};
  function syncAvatarControls(){
    Object.entries(avatarFields).forEach(([id,key])=>{const el=$(id);if(el&&avatarConfig[key])el.value=avatarConfig[key];});
  }
  Object.entries(avatarFields).forEach(([id,key])=>{$(id)?.addEventListener("input",()=>{avatarConfig={...avatarConfig,[key]:$(id).value};drawAvatar();});});
  document.querySelectorAll("[data-avatar-tab]").forEach(tab=>tab.addEventListener("click",()=>{
    document.querySelectorAll("[data-avatar-tab]").forEach(t=>t.classList.toggle("active",t===tab));
    document.querySelectorAll("[data-avatar-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.avatarPanel===tab.dataset.avatarTab));
  }));
  $("save-avatar")?.addEventListener("click",async()=>{
    const {error}=await supabase.from("profiles").update({avatar_config:avatarConfig}).eq("id",currentUser.id);
    if(!error)profileAvatars[currentUser.id]={...avatarConfig};
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

  // VIOCHAT_SOCIAL_FEATURES — amis, stories 24 h et notifications.
  function switchSocialSection(section){
    ["home","friends","stories","notifications"].forEach(name=>{
      $("section-"+name)?.classList.toggle("hidden",name!==section);
      document.querySelector('[data-section="'+name+'"]')?.classList.toggle("active",name===section);
    });
    if(section==="friends") loadFriends();
    if(section==="stories") loadStories();
    if(section==="notifications") loadNotifications();
  }
  document.querySelectorAll("[data-section]").forEach(btn=>btn.addEventListener("click",()=>switchSocialSection(btn.dataset.section)));
  async function loadFriends(){
    const reqBox=$("friend-requests"), friendsBox=$("friends-list"); if(!reqBox||!friendsBox||!currentUser)return;
    reqBox.innerHTML="<p class='muted'>Chargement…</p>";friendsBox.innerHTML="<p class='muted'>Chargement…</p>";
    const {data:rows,error}=await supabase.from("friend_requests").select("*").or("sender_id.eq."+currentUser.id+",receiver_id.eq."+currentUser.id).order("created_at",{ascending:false});
    if(error){reqBox.textContent="Active les nouvelles tables avec schema.sql dans Supabase.";friendsBox.innerHTML="";return;}
    const pending=(rows||[]).filter(r=>r.status==="pending"&&r.receiver_id===currentUser.id);
    const accepted=(rows||[]).filter(r=>r.status==="accepted");
    const ids=[...new Set([...pending.map(r=>r.sender_id),...accepted.map(r=>r.sender_id===currentUser.id?r.receiver_id:r.sender_id)])];
    const {data:profiles}=ids.length?await supabase.from("profiles").select("id,username,avatar_config").in("id",ids):{data:[]};
    const profile=id=>(profiles||[]).find(p=>p.id===id);
    reqBox.innerHTML="";
    if(!pending.length)reqBox.innerHTML="<p class='muted'>Aucune demande en attente.</p>";
    pending.forEach(r=>{
      const p=profile(r.sender_id),item=document.createElement("div");item.className="social-person";
      const main=document.createElement("div");main.className="social-person-main";main.innerHTML="<strong></strong><small>Souhaite devenir ton ami</small>";main.querySelector("strong").textContent=p?.username||"Membre";
      const actions=document.createElement("div");actions.className="social-person-actions";
      const accept=document.createElement("button");accept.className="social-action accept";accept.textContent="Accepter";accept.onclick=()=>respondFriend(r,p?.username||"Un membre");
      const decline=document.createElement("button");decline.className="social-action";decline.textContent="Refuser";decline.onclick=async()=>{await supabase.from("friend_requests").delete().eq("id",r.id);loadFriends();};
      actions.append(accept,decline);item.append(main,actions);reqBox.append(item);
    });
    friendsBox.innerHTML="";
    if(!accepted.length)friendsBox.innerHTML="<p class='muted'>Tu n'as pas encore d'amis. Envoie une demande avec leur pseudo.</p>";
    accepted.forEach(r=>{
      const id=r.sender_id===currentUser.id?r.receiver_id:r.sender_id,p=profile(id),item=document.createElement("div");item.className="social-person";
      const main=document.createElement("div");main.className="social-person-main";main.innerHTML="<strong></strong><small>Ton ami VioChat</small>";main.querySelector("strong").textContent=p?.username||"Membre";
      item.append(main);friendsBox.append(item);
    });
  }
  async function respondFriend(row,username){
    const {error}=await supabase.from("friend_requests").update({status:"accepted"}).eq("id",row.id);
    if(error){$("friend-search-status").textContent=error.message;return;}
    await supabase.from("notifications").insert({user_id:row.sender_id,actor_id:currentUser.id,kind:"friend_accepted",content:(username||"Un membre")+" a accepté ta demande d'ami."});
    loadFriends();loadNotifications();
  }
  $("friend-search")?.addEventListener("submit",async e=>{
    e.preventDefault();const status=$("friend-search-status");status.textContent="Recherche…";
    const name=$("friend-username").value.trim();
    const {data:p,error}=await supabase.from("profiles").select("id,username").ilike("username",name).maybeSingle();
    if(error||!p){status.textContent="Pseudo introuvable.";return;}
    if(p.id===currentUser.id){status.textContent="Tu ne peux pas t'ajouter toi-même.";return;}
    const {data:existing}=await supabase.from("friend_requests").select("id,status,sender_id,receiver_id").or("and(sender_id.eq."+currentUser.id+",receiver_id.eq."+p.id+"),and(sender_id.eq."+p.id+",receiver_id.eq."+currentUser.id+")");
    if(existing?.some(r=>r.status==="accepted")){status.textContent="Vous êtes déjà amis.";return;}
    if(existing?.some(r=>r.status==="pending")){status.textContent="Une demande existe déjà entre vous.";return;}
    const {error:insertError}=await supabase.from("friend_requests").insert({sender_id:currentUser.id,receiver_id:p.id});
    if(insertError){status.textContent=insertError.message;return;}
    await supabase.from("notifications").insert({user_id:p.id,actor_id:currentUser.id,kind:"friend_request",content:(currentUser.user_metadata?.username||"Un membre")+" t'a envoyé une demande d'ami."});
    status.textContent="Demande envoyée à "+p.username+" !";$("friend-username").value="";loadFriends();
  });
  $("story-form")?.addEventListener("submit",async e=>{
    e.preventDefault();const file=$("story-file").files[0],status=$("story-status");if(!file)return;
    if(file.size>50*1024*1024){status.textContent="Le fichier doit faire 50 Mo maximum.";return;}
    if(!file.type.startsWith("image/")&&!file.type.startsWith("video/")){status.textContent="Choisis une photo ou une vidéo.";return;}
    status.textContent="Publication…";
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),path=currentUser.id+"/"+Date.now()+"-"+safeName;
    const {error:uploadError}=await supabase.storage.from("viochat-stories").upload(path,file,{contentType:file.type,upsert:false});
    if(uploadError){status.textContent="Erreur de stockage : "+uploadError.message+" (vérifie que le script SQL a été exécuté).";return;}
    const {error}=await supabase.from("stories").insert({user_id:currentUser.id,storage_path:path,caption:$("story-caption").value.trim()});
    if(error){await supabase.storage.from("viochat-stories").remove([path]);status.textContent="Erreur : "+error.message;return;}
    $("story-file").value="";$("story-caption").value="";status.textContent="Story publiée pour 24 heures !";loadStories();
  });
  async function loadStories(){
    const box=$("story-feed");if(!box||!currentUser)return;box.innerHTML="<p class='muted'>Chargement…</p>";
    const {data,error}=await supabase.from("stories").select("*").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(60);
    if(error){box.textContent="Active les tables Stories et le stockage via schema.sql.";return;}
    box.innerHTML="";
    for(const story of (data||[])){
      const {data:urlData,error:urlError}=await supabase.storage.from("viochat-stories").createSignedUrl(story.storage_path,3600);
      if(urlError||!urlData?.signedUrl)continue;
      const {data:profile}=await supabase.from("profiles").select("username").eq("id",story.user_id).maybeSingle();
      const card=document.createElement("article");card.className="story-card";
      const media=document.createElement(story.storage_path.match(/\.(mp4|webm|mov)$/i)?"video":"img");
      media.src=urlData.signedUrl;if(media.tagName==="VIDEO"){media.controls=true;media.playsInline=true;}else media.alt="Story de "+(profile?.username||"Membre");
      const caption=document.createElement("div");caption.className="story-card-caption";const name=document.createElement("strong");name.textContent=profile?.username||"Membre";caption.append(name,document.createTextNode(story.caption||""));
      card.append(media,caption);box.append(card);
    }
    if(!box.children.length)box.innerHTML="<p class='muted'>Aucune story pour le moment. Publie la première !</p>";
  }
  async function loadNotifications(){
    const box=$("notifications-list");if(!box||!currentUser)return;
    const {data,error}=await supabase.from("notifications").select("*").order("created_at",{ascending:false}).limit(50);
    if(error){box.textContent="Active les notifications avec schema.sql.";return;}
    box.innerHTML="";const unread=(data||[]).filter(n=>!n.is_read).length;
    $("notification-count")?.classList.toggle("hidden",!unread);if($("notification-count"))$("notification-count").textContent=String(unread);
    (data||[]).forEach(n=>{
      const item=document.createElement("div");item.className="notification-item"+(n.is_read?"":" unread");
      const p=document.createElement("p");p.textContent=n.content;const date=document.createElement("small");date.textContent=new Date(n.created_at).toLocaleString("fr-FR");
      item.append(p,date);box.append(item);
    });
    if(!data?.length)box.innerHTML="<p class='muted'>Aucune notification pour le moment.</p>";
  }
  $("mark-notifications-read")?.addEventListener("click",async()=>{
    const {error}=await supabase.from("notifications").update({is_read:true}).eq("user_id",currentUser.id).eq("is_read",false);
    if(error){$("notifications-list").textContent=error.message;return;}loadNotifications();
  });

  $("logout-btn").addEventListener("click",async()=>{if(messageChannel)await supabase.removeChannel(messageChannel);await supabase.auth.signOut();currentUser=null;activeChat=null;showAuth();authMode("login");});
  supabase.auth.getSession().then(({data})=>{if(data.session?.user)showApp(data.session.user);});
  supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user)showApp(session.user);else{currentUser=null;showAuth();}});
})();