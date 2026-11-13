(() => {
  const config = window.VIOCHAT_CONFIG || {};
  const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_URL.includes("COLLE_ICI") &&
    !config.SUPABASE_ANON_KEY.includes("COLLE_ICI");

  const authView = document.getElementById("auth-view");
  const appView = document.getElementById("app-view");
  const signupTab = document.getElementById("signup-tab");
  const loginTab = document.getElementById("login-tab");
  const usernameField = document.getElementById("username-field");
  const usernameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const form = document.getElementById("auth-form");
  const submitBtn = document.getElementById("submit-btn");
  const feedback = document.getElementById("feedback");
  let mode = "signup";
  let supabase = null;

  function message(text, type = "") {
    feedback.textContent = text;
    feedback.className = `feedback ${type}`;
  }
  function setMode(nextMode) {
    mode = nextMode;
    const signup = mode === "signup";
    signupTab.classList.toggle("active", signup);
    loginTab.classList.toggle("active", !signup);
    usernameField.classList.toggle("hidden", !signup);
    usernameInput.required = signup;
    usernameInput.disabled = !signup;
    passwordInput.autocomplete = signup ? "new-password" : "current-password";
    document.getElementById("form-title").textContent = signup ? "Créer un compte" : "Content de te revoir";
    document.getElementById("form-subtitle").textContent = signup ? "Rejoins la communauté, c'est gratuit." : "Connecte-toi pour retrouver tes conversations.";
    submitBtn.querySelector("span").textContent = signup ? "Créer mon compte" : "Me connecter";
    message("");
  }
  function showApp(user) {
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    const pseudo = user.user_metadata?.username || user.email?.split("@")[0] || "Membre";
    document.getElementById("user-pseudo").textContent = pseudo;
    document.getElementById("welcome-name").textContent = pseudo;
    document.getElementById("user-email").textContent = user.email || "";
    document.getElementById("avatar-letter").textContent = pseudo.charAt(0).toUpperCase();
  }
  function showAuth() {
    appView.classList.add("hidden");
    authView.classList.remove("hidden");
  }

  signupTab.addEventListener("click", () => setMode("signup"));
  loginTab.addEventListener("click", () => setMode("login"));

  if (!configured) {
    message("Configuration nécessaire : ajoute l'URL et la clé Supabase dans config.js.", "info");
    form.addEventListener("submit", event => {
      event.preventDefault();
      message("Ajoute d'abord tes identifiants Supabase dans config.js.", "error");
    });
    return;
  }
  if (!window.supabase?.createClient) {
    message("La bibliothèque Supabase n'a pas pu être chargée. Vérifie ta connexion Internet.", "error");
    return;
  }

  supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

  form.addEventListener("submit", async event => {
    event.preventDefault();
    message("");
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    submitBtn.disabled = true;
    submitBtn.querySelector("span").textContent = "Patiente…";
    try {
      if (mode === "signup") {
        const username = usernameInput.value.trim();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
          throw new Error("Le pseudo doit contenir 3 à 20 lettres, chiffres ou tirets bas (_).");
        }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username }, emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (error) throw error;
        if (data.session && data.user) {
          showApp(data.user);
        } else {
          message("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.", "success");
          form.reset();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showApp(data.user);
      }
    } catch (error) {
      message(error.message || "Une erreur est survenue. Réessaie.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector("span").textContent = mode === "signup" ? "Créer mon compte" : "Me connecter";
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) message(error.message, "error");
    else { showAuth(); setMode("login"); }
  });

  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user) showApp(data.session.user);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) showApp(session.user);
    else showAuth();
  });
})();