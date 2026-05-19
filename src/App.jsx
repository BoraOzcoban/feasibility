import React, { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import logoUrl from "./assets/atera-logo.svg";

const emptyForm = {
  username: "",
  password: "",
  email: "",
  phoneNumber: "",
  company: "",
  department: "",
  accessLevel: "user",
  language: "en",
};

const emptyRoleForm = {
  name: "",
  description: "",
};

const emptyManagedUserForm = {
  username: "",
  email: "",
  password: "",
  phoneNumber: "",
  department: "",
  accessLevel: "user",
  language: "tr",
};

const text = {
  en: {
    language: "Language",
    themeLight: "Light mode",
    themeDark: "Dark mode",
    login: "Log in",
    signup: "Create user",
    createUserLink: "Create a new user",
    backToLogin: "Back to login",
    who: "Who are we?",
    solutions: "Our solutions",
    references: "Our references",
    contact: "Contact",
    heroTitle: "Atera",
    heroCopy: "The operating logic behind tailor-made production planning.",
    goToLogin: "Go to log in",
    whoCopy: "Plan. Test. Decide. Scale. Atera brings production teams, finance, and operations into one practical hub where feasibility, cost, stock, and delivery scenarios can move from scattered assumptions to clear decisions.",
    solutionsCopy: "Scenario planning, production visibility, material tracking, cost analysis, and workflow tools will move here step by step as the migration from atera_v2 continues.",
    farmerPersona: "Planning team",
    factoryOwnerPersona: "Production lead",
    entrepreneurPersona: "Finance team",
    exporterPersona: "Operations owner",
    farmerNeed: "Need: See whether a new order is feasible before committing capacity.",
    farmerBenefit: "Benefit: Compare material, labor, and timing scenarios in one calm workspace.",
    farmerDifference: "Atera's difference: Tailor-made planning without enterprise software weight.",
    factoryOwnerNeed: "Need: Understand which production route protects margin and delivery time.",
    factoryOwnerBenefit: "Benefit: Make faster calls with clearer cost and stock visibility.",
    factoryOwnerDifference: "Atera's difference: Built around the way your team actually works.",
    entrepreneurNeed: "Need: Turn scattered spreadsheets into a shared operating view.",
    entrepreneurBenefit: "Benefit: Keep decisions, assumptions, and feasibility notes together.",
    entrepreneurDifference: "Atera's difference: Practical, budget-friendly structure that can grow step by step.",
    exporterNeed: "Need: Check price, currency, stock, and shipment promises before quoting.",
    exporterBenefit: "Benefit: Reduce surprises between sales, production, and delivery.",
    exporterDifference: "Atera's difference: Friendly planning tools for real-world tradeoffs.",
    referencesCopy: "Reference stories and customer examples will live here as the product grows.",
    contactCopy: "You can reach us for access, onboarding, and project questions.",
    contactPhone: "+90 212 000 00 00",
    contactEmail: "hello@atera.app",
    contactLocation: "Istanbul, Turkiye",
    username: "Username",
    password: "Password",
    email: "Mail address",
    phoneNumber: "Phone number",
    company: "Company",
    department: "Department",
    accessLevel: "Access level",
    profilePicture: "Profile picture",
    saveLogin: "Save entry info on this device",
    forgot: "I forgot my password",
    resetPassword: "Set new password",
    confirmPassword: "Confirm password",
    submitLogin: "Log in",
    submitSignup: "Create account",
    logout: "Log out",
    signedIn: "Signed in",
    dashboard: "Dashboard",
    dashboardCopy: "This area will become the main workspace for planning, feasibility, and operational tools.",
    authorizationPage: "Yetkilendirme Sayfası",
    authorizationCopy: "Authorization tools and user access controls live here.",
    authorizationLocked: "Authorization is locked for your current role.",
    authorizationLockedCopy: "Your company role does not have read or write permission for this module yet.",
    roleDefinition: "Yetki tanımlama",
    userDefinition: "Kullanıcı tanımlama",
    userDefinitionCopy: "Create company users and save their profile records through Supabase.",
    managedUsers: "Defined users",
    createManagedUser: "Create user",
    userCreated: "User was created and saved to profiles.",
    newRole: "New role",
    roleName: "Role name",
    roleDescription: "Role description",
    createRole: "Create role",
    permissions: "Permissions",
    module: "Module",
    readPermission: "Read",
    writePermission: "Write",
    readOnlyMode: "Read-only mode",
    writeAccess: "Write access",
    noCompany: "Your profile is not connected to a company yet.",
    loadAuthorizationError: "Authorization data could not be loaded.",
    backToDashboard: "Back to dashboard",
    configure: "Add your Supabase URL and anon key to .env, then restart npm run dev.",
    resetSent: "Password reset email sent.",
    needEmail: "Enter your mail address first.",
    forgotEmailPrompt: "Enter your mail address for password reset.",
    passwordMismatch: "Passwords do not match.",
    passwordTooShort: "Password must be at least 6 characters.",
  },
  tr: {
    language: "Dil",
    themeLight: "Aydinlik mod",
    themeDark: "Karanlik mod",
    login: "Giris yap",
    signup: "Kullanici olustur",
    createUserLink: "Yeni kullanici olustur",
    backToLogin: "Girise don",
    who: "Biz kimiz?",
    solutions: "Cozumlerimiz",
    references: "Referanslarimiz",
    contact: "Iletisim",
    heroTitle: "Atera",
    heroCopy: "Tailor-made uretim planlamasinin arkasindaki operasyon mantigi.",
    goToLogin: "Girise git",
    whoCopy: "Planla. Dene. Karar ver. Buyut. Atera; uretim, finans ve operasyon ekiplerini fizibilite, maliyet, stok ve termin senaryolarini daginik varsayimlardan net kararlara tasiyan pratik bir hub'da bulusturur.",
    solutionsCopy: "Senaryo planlama, uretim gorunurlugu, malzeme takibi, maliyet analizi ve is akisi araclari atera_v2'den parca parca buraya tasinacak.",
    farmerPersona: "Planlama ekibi",
    factoryOwnerPersona: "Uretim sorumlusu",
    entrepreneurPersona: "Finans ekibi",
    exporterPersona: "Operasyon sahibi",
    farmerNeed: "Ihtiyac: Yeni bir siparise soz vermeden once uretim fizibilitesini gormek.",
    farmerBenefit: "Fayda: Malzeme, iscilik ve termin senaryolarini tek sakin alanda karsilastirmak.",
    farmerDifference: "Atera'nin farki: Kurumsal yazilim agirligi olmadan tailor-made planlama.",
    factoryOwnerNeed: "Ihtiyac: Hangi uretim yolunun marji ve teslimati korudugunu anlamak.",
    factoryOwnerBenefit: "Fayda: Maliyet ve stok gorunurluguyle daha hizli karar almak.",
    factoryOwnerDifference: "Atera'nin farki: Ekibinizin gercek calisma sekline gore sekillenmesi.",
    entrepreneurNeed: "Ihtiyac: Dagilan Excel'leri ortak bir operasyon gorunumune cevirmek.",
    entrepreneurBenefit: "Fayda: Kararlari, varsayimlari ve fizibilite notlarini birlikte tutmak.",
    entrepreneurDifference: "Atera'nin farki: Adim adim buyuyebilen pratik ve butce dostu yapi.",
    exporterNeed: "Ihtiyac: Teklif vermeden once fiyat, kur, stok ve sevkiyat sozunu kontrol etmek.",
    exporterBenefit: "Fayda: Satis, uretim ve teslimat arasindaki surprizleri azaltmak.",
    exporterDifference: "Atera'nin farki: Gercek hayattaki trade-off'lar icin samimi planlama araclari.",
    referencesCopy: "Urun buyudukce referans hikayeleri ve musteri ornekleri burada yer alacak.",
    contactCopy: "Erisim, onboarding ve proje sorulari icin bize ulasabilirsiniz.",
    contactPhone: "+90 212 000 00 00",
    contactEmail: "hello@atera.app",
    contactLocation: "Istanbul, Turkiye",
    username: "Kullanici adi",
    password: "Sifre",
    email: "Mail adresi",
    phoneNumber: "Telefon numarasi",
    company: "Sirket",
    department: "Departman",
    accessLevel: "Yetki seviyesi",
    profilePicture: "Profil fotografi",
    saveLogin: "Giris bilgisini bu cihazda sakla",
    forgot: "Sifremi unuttum",
    resetPassword: "Yeni sifre belirle",
    confirmPassword: "Sifreyi onayla",
    submitLogin: "Giris yap",
    submitSignup: "Hesap olustur",
    logout: "Cikis yap",
    signedIn: "Giris yapildi",
    dashboard: "Dashboard",
    dashboardCopy: "Bu alan planlama, fizibilite ve operasyon araclari icin ana calisma alanina donusecek.",
    authorizationPage: "Yetkilendirme Sayfası",
    authorizationCopy: "Yetkilendirme araclari ve kullanici erisim kontrolleri burada yer alir.",
    authorizationLocked: "Yetkilendirme mevcut yetkiniz icin kilitli.",
    authorizationLockedCopy: "Sirketinizdeki yetkinizin bu modul icin okuma veya yazma izni yok.",
    roleDefinition: "Yetki tanımlama",
    userDefinition: "Kullanıcı tanımlama",
    userDefinitionCopy: "Sirket kullanicilari olusturun ve profil kayitlarini Supabase'e kaydedin.",
    managedUsers: "Tanımlı kullanıcılar",
    createManagedUser: "Kullanıcı oluştur",
    userCreated: "Kullanıcı oluşturuldu ve profiles tablosuna kaydedildi.",
    newRole: "Yeni yetki",
    roleName: "Yetki adi",
    roleDescription: "Yetki aciklamasi",
    createRole: "Yetki yarat",
    permissions: "Izinler",
    module: "Modul",
    readPermission: "Okuma",
    writePermission: "Yazma",
    readOnlyMode: "Sadece okuma",
    writeAccess: "Yazma erisimi",
    noCompany: "Profiliniz henuz bir sirkete bagli degil.",
    loadAuthorizationError: "Yetkilendirme verisi yuklenemedi.",
    backToDashboard: "Dashboard'a don",
    configure: ".env dosyasina Supabase URL ve anon key ekleyip npm run dev'i yeniden baslat.",
    resetSent: "Sifre sifirlama e-postasi gonderildi.",
    needEmail: "Once mail adresini gir.",
    forgotEmailPrompt: "Sifre sifirlama icin mail adresini gir.",
    passwordMismatch: "Sifreler eslesmiyor.",
    passwordTooShort: "Sifre en az 6 karakter olmali.",
  },
};

function PersonaAvatar({ type, title }) {
  const palette = {
    planning: { shirt: "#2f9fbd", hair: "#173b41", accent: "#d99a24", skin: "#f1c19d" },
    production: { shirt: "#187565", hair: "#102b32", accent: "#d99a24", skin: "#d99f78" },
    finance: { shirt: "#9d5b3f", hair: "#3f2b24", accent: "#2f9fbd", skin: "#e7b58e" },
    operations: { shirt: "#173b41", hair: "#6f4937", accent: "#187565", skin: "#c98d68" },
  }[type];

  return (
    <svg className="persona-avatar" viewBox="0 0 160 160" role="img" aria-label={title}>
      <rect className="avatar-card-bg" x="8" y="8" width="144" height="144" rx="22" />
      <circle cx="80" cy="68" r="34" fill={palette.skin} />
      <path d="M47 66c4-26 19-40 43-38 19 2 31 14 33 36-15-7-32-9-48-6-11 2-20 5-28 8Z" fill={palette.hair} />
      <circle cx="68" cy="72" r="4" fill="#102b32" />
      <circle cx="92" cy="72" r="4" fill="#102b32" />
      <path d="M70 88c7 6 15 6 22 0" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
      <path d="M42 137c4-24 19-36 38-36s34 12 38 36H42Z" fill={palette.shirt} />
      {type === "planning" && (
        <>
          <circle cx="40" cy="116" r="14" fill="#f1c19d" />
          <circle cx="120" cy="116" r="14" fill="#d99f78" />
          <path d="M26 140c2-12 8-18 14-18s12 6 14 18H26Z" fill="#173b41" />
          <path d="M106 140c2-12 8-18 14-18s12 6 14 18h-28Z" fill="#d99a24" />
          <path d="M112 36h22v18h-22zM117 44h12" fill="none" stroke={palette.accent} strokeLinecap="round" strokeWidth="4" />
        </>
      )}
      {type === "production" && (
        <>
          <path d="M46 54c5-21 17-31 34-31s29 10 34 31H46Z" fill={palette.accent} />
          <path d="M45 55h70" stroke="#102b32" strokeLinecap="round" strokeWidth="5" />
          <path d="M116 106h20v28h-20zM122 112h8M122 121h8M122 130h8" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
        </>
      )}
      {type === "finance" && (
        <>
          <rect x="108" y="98" width="30" height="38" rx="6" fill="#f9faf6" stroke="#102b32" strokeWidth="4" />
          <path d="M115 108h16M116 119h4M124 119h4M132 119h1M116 128h4M124 128h4M132 128h1" stroke={palette.accent} strokeLinecap="round" strokeWidth="3" />
          <path d="M50 44c10-16 31-19 48-6" fill="none" stroke={palette.hair} strokeLinecap="round" strokeWidth="10" />
        </>
      )}
      {type === "operations" && (
        <>
          <path d="M47 73c0-23 14-42 33-42s33 19 33 42" fill="none" stroke={palette.accent} strokeLinecap="round" strokeWidth="7" />
          <rect x="39" y="68" width="12" height="22" rx="5" fill="#102b32" />
          <rect x="109" y="68" width="12" height="22" rx="5" fill="#102b32" />
          <path d="M116 91c-4 15-13 22-27 22" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
          <circle cx="87" cy="113" r="4" fill="#102b32" />
        </>
      )}
    </svg>
  );
}

function App() {
  const initialPath = window.location.pathname;
  const [mode, setMode] = useState("login");
  const [path, setPath] = useState(window.location.pathname);
  const [form, setForm] = useState(emptyForm);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberUsername, setRememberUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useState("light");
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState("");
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [authorizationLoading, setAuthorizationLoading] = useState(false);
  const [authorizationStatus, setAuthorizationStatus] = useState("");
  const [authorizationTab, setAuthorizationTab] = useState("roles");
  const [authorizationAccess, setAuthorizationAccess] = useState({ read: false, write: false });
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [managedUserForm, setManagedUserForm] = useState(emptyManagedUserForm);

  const labels = text[form.language] || text.en;

  const initials = useMemo(() => {
    const source = form.username || form.email || "A";
    return source.slice(0, 2).toUpperCase();
  }, [form.email, form.username]);

  useEffect(() => {
    const storedTheme = localStorage.getItem("atera_theme");
    const systemPrefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setTheme(storedTheme || (systemPrefersDark ? "dark" : "light"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("atera_theme", theme);
  }, [theme]);

  useEffect(() => {
    const remembered = localStorage.getItem("atera_username");
    if (remembered) {
      setForm((current) => ({ ...current, username: remembered }));
      setRememberUsername(true);
    }

    const rememberedLanguage = localStorage.getItem("atera_language");
    if (rememberedLanguage) {
      setForm((current) => ({ ...current, language: rememberedLanguage }));
    }

    if (!supabase) return;

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    if (params.get("type") === "recovery") {
      setMode("reset");
    } else {
      setMode("login");
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handlePopState() {
      const nextPath = window.location.pathname;
      setPath(nextPath);
      setStatus("");
      setMode("login");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setCurrentProfile(null);
      setAuthorizationAccess({ read: false, write: false });
      setModules([]);
      setRoles([]);
      setProfiles([]);
      return;
    }

    loadAuthorizationData();
  }, [session]);

  function goTo(pathname, nextMode) {
    window.history.pushState({}, "", pathname);
    setPath(pathname);
    setMode(nextMode);
    setStatus("");
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function ThemeToggle() {
    const isDark = theme === "dark";

    return (
      <button
        type="button"
        className="theme-toggle"
        aria-label={isDark ? labels.themeLight : labels.themeDark}
        onClick={toggleTheme}
      >
        <span>{isDark ? "Light" : "Dark"}</span>
      </button>
    );
  }

  function updateRoleForm(field, value) {
    setRoleForm((current) => ({ ...current, [field]: value }));
  }

  function updateManagedUserForm(field, value) {
    setManagedUserForm((current) => ({ ...current, [field]: value }));
  }

  function normalizeRole(role) {
    const permissions = {};

    for (const permission of role.role_permissions || []) {
      const moduleKey = permission.module?.module_key;
      if (!moduleKey) continue;

      permissions[moduleKey] = {
        id: permission.id,
        moduleId: permission.module_id,
        canRead: permission.can_read,
        canWrite: permission.can_write,
      };
    }

    return { ...role, permissions };
  }

  async function loadAuthorizationData() {
    if (!supabase || !session) return;

    setAuthorizationLoading(true);
    setAuthorizationStatus("");

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, email, phone_number, company_id, department, access_level, profile_picture_url, company:companies(name)")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentProfile(profile);
      if (profile?.profile_picture_url) setProfilePreview(profile.profile_picture_url);

      const [{ data: canRead }, { data: canWrite }] = await Promise.all([
        supabase.rpc("has_module_permission", { p_module_key: "authorization", p_permission: "read" }),
        supabase.rpc("has_module_permission", { p_module_key: "authorization", p_permission: "write" }),
      ]);

      const nextAccess = { read: Boolean(canRead), write: Boolean(canWrite) };
      setAuthorizationAccess(nextAccess);

      if (!nextAccess.read) {
        setModules([]);
        setRoles([]);
        setProfiles([]);
        return;
      }

      const [
        { data: moduleRows, error: modulesError },
        { data: roleRows, error: rolesError },
        { data: profileRows, error: profilesError },
      ] = await Promise.all([
        supabase.from("app_modules").select("id, module_key, name").order("name"),
        supabase
          .from("company_roles")
          .select("id, name, description, is_system, role_permissions(id, module_id, can_read, can_write, module:app_modules(id, module_key, name))")
          .order("is_system", { ascending: false })
          .order("name"),
        supabase
          .from("profiles")
          .select("id, username, email, phone_number, department, access_level, language, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (modulesError) throw modulesError;
      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;

      setModules(moduleRows || []);
      setRoles((roleRows || []).map(normalizeRole));
      setProfiles(profileRows || []);
    } catch (error) {
      setAuthorizationStatus(`${labels.loadAuthorizationError} ${error.message}`);
      setAuthorizationAccess({ read: false, write: false });
      setModules([]);
      setRoles([]);
      setProfiles([]);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function handleCreateRole(event) {
    event.preventDefault();
    setAuthorizationStatus("");

    if (!supabase || !currentProfile?.company_id || !authorizationAccess.write) return;

    const nextName = roleForm.name.trim().toLowerCase();
    if (!nextName) return;

    setAuthorizationLoading(true);
    try {
      const { data: role, error: roleError } = await supabase
        .from("company_roles")
        .insert({
          company_id: currentProfile.company_id,
          name: nextName,
          description: roleForm.description.trim() || null,
        })
        .select("id")
        .single();

      if (roleError) throw roleError;

      if (modules.length) {
        const { error: permissionError } = await supabase.from("role_permissions").insert(
          modules.map((module) => ({
            role_id: role.id,
            module_id: module.id,
            can_read: false,
            can_write: false,
          })),
        );

        if (permissionError) throw permissionError;
      }

      setRoleForm(emptyRoleForm);
      await loadAuthorizationData();
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function updatePermission(role, module, field, checked) {
    if (!supabase || !authorizationAccess.write) return;

    const existing = role.permissions[module.module_key];
    const nextPermission = {
      can_read: field === "can_read" ? checked : Boolean(existing?.canRead),
      can_write: field === "can_write" ? checked : Boolean(existing?.canWrite),
    };

    setAuthorizationLoading(true);
    setAuthorizationStatus("");

    try {
      const payload = {
        role_id: role.id,
        module_id: module.id,
        ...nextPermission,
      };

      const query = existing?.id
        ? supabase.from("role_permissions").update(nextPermission).eq("id", existing.id)
        : supabase.from("role_permissions").insert(payload);

      const { error } = await query;
      if (error) throw error;

      await loadAuthorizationData();
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function handleCreateManagedUser(event) {
    event.preventDefault();
    setAuthorizationStatus("");

    if (!supabase || !currentProfile?.company?.name || !authorizationAccess.write) return;

    setAuthorizationLoading(true);
    try {
      const adminSession = session;
      const { data, error } = await supabase.auth.signUp({
        email: managedUserForm.email.trim(),
        password: managedUserForm.password,
        options: {
          data: {
            username: managedUserForm.username.trim(),
            phone_number: managedUserForm.phoneNumber.trim(),
            company: currentProfile.company.name,
            department: managedUserForm.department.trim(),
            access_level: managedUserForm.accessLevel,
            language: managedUserForm.language,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Supabase did not return a user.");

      if (data.session && adminSession?.access_token && adminSession?.refresh_token) {
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });

        if (restoreError) throw restoreError;
        setSession(adminSession);
      }

      setManagedUserForm({ ...emptyManagedUserForm, language: form.language });
      await loadAuthorizationData();
      setAuthorizationStatus(labels.userCreated);
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  function onProfileFileChange(event) {
    const file = event.target.files?.[0];
    setProfileFile(file || null);
    setProfilePreview(file ? URL.createObjectURL(file) : "");
  }

  async function uploadProfilePicture(userId) {
    if (!profileFile) return null;

    const extension = profileFile.name.split(".").pop() || "jpg";
    const path = `${userId}/profile.${extension}`;

    const { error } = await supabase.storage
      .from("profile-pictures")
      .upload(path, profileFile, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from("profile-pictures").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSignup(event) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            username: form.username,
            phone_number: form.phoneNumber,
            company: form.company,
            department: form.department,
            access_level: form.accessLevel,
            language: form.language,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Supabase did not return a user.");

      if (data.session) {
        const profilePictureUrl = await uploadProfilePicture(data.user.id);

        const { error: profileError } = await supabase.from("profiles").update({
          profile_picture_url: profilePictureUrl,
        }).eq("id", data.user.id);

        if (profileError) throw profileError;
      }

      setStatus("Account created. Check email confirmation if your Supabase project requires it.");
      goTo("/login", "login");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    setLoading(true);
    try {
      const { data: email, error: profileError } = await supabase.rpc("get_login_email", {
        p_username: form.username,
      });

      if (profileError || !email) throw new Error("Username was not found.");

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });

      if (error) throw error;

      if (rememberUsername) {
        localStorage.setItem("atera_username", form.username);
        localStorage.setItem("atera_language", form.language);
      } else {
        localStorage.removeItem("atera_username");
        localStorage.removeItem("atera_language");
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("profile_picture_url")
        .single();

      if (userProfile?.profile_picture_url) setProfilePreview(userProfile.profile_picture_url);
      goTo("/dashboard", "login");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    const resetEmail = form.email || window.prompt(labels.forgotEmailPrompt)?.trim();

    if (!resetEmail) {
      setStatus(labels.needEmail);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });

    setStatus(error ? error.message : labels.resetSent);
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus(labels.configure);
      return;
    }

    if (form.password.length < 6) {
      setStatus(labels.passwordTooShort);
      return;
    }

    if (form.password !== confirmPassword) {
      setStatus(labels.passwordMismatch);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: form.password });
    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Password updated. You can log in now.");
    goTo("/login", "login");
    updateField("password", "");
    setConfirmPassword("");
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    goTo("/login", "login");
  }

  const references = [
    { mark: "NR", name: "Nora Tekstil", tone: "teal" },
    { mark: "AV", name: "Avra Makina", tone: "amber" },
    { mark: "KM", name: "Kumru Foods", tone: "clay" },
    { mark: "LY", name: "Loya Export", tone: "cyan" },
    { mark: "MT", name: "Motto Plastik", tone: "navy" },
    { mark: "ER", name: "Erva Metal", tone: "green" },
  ];

  const personas = [
    {
      avatarType: "planning",
      title: labels.farmerPersona,
      need: labels.farmerNeed,
      benefit: labels.farmerBenefit,
      difference: labels.farmerDifference,
    },
    {
      avatarType: "production",
      title: labels.factoryOwnerPersona,
      need: labels.factoryOwnerNeed,
      benefit: labels.factoryOwnerBenefit,
      difference: labels.factoryOwnerDifference,
    },
    {
      avatarType: "finance",
      title: labels.entrepreneurPersona,
      need: labels.entrepreneurNeed,
      benefit: labels.entrepreneurBenefit,
      difference: labels.entrepreneurDifference,
    },
    {
      avatarType: "operations",
      title: labels.exporterPersona,
      need: labels.exporterNeed,
      benefit: labels.exporterBenefit,
      difference: labels.exporterDifference,
    },
  ];

  function renderDashboardLayout(activePage, children) {
    return (
      <main className="dashboard-shell">
        <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
          <button type="button" className="landing-brand dashboard-brand" onClick={() => goTo("/dashboard", "login")}>
            <img src={logoUrl} alt="Atera logo" />
            <strong>Atera</strong>
          </button>

          <nav className="dashboard-nav">
            <button
              type="button"
              className={activePage === "dashboard" ? "active" : ""}
              onClick={() => goTo("/dashboard", "login")}
            >
              {labels.dashboard}
            </button>
            {authorizationAccess.read && (
              <button
                type="button"
                className={activePage === "authorization" ? "active" : ""}
                onClick={() => goTo("/authorization", "login")}
              >
                {labels.authorizationPage}
              </button>
            )}
          </nav>

          <button type="button" className="link-button dashboard-logout" onClick={handleLogout}>
            {labels.logout}
          </button>
          <ThemeToggle />
        </aside>

        <section className="dashboard-content">{children}</section>
      </main>
    );
  }

  if (path === "/") {
    return (
      <main className="landing-page">
        <header className="landing-header">
          <button type="button" className="landing-brand" onClick={() => goTo("/", "login")}>
            <img src={logoUrl} alt="Atera logo" />
            <strong>Atera</strong>
          </button>

          <nav className="landing-nav" aria-label="Landing page sections">
            <a href="#who">{labels.who}</a>
            <a href="#solutions">{labels.solutions}</a>
            <a href="#references">{labels.references}</a>
            <a href="#contact">{labels.contact}</a>
          </nav>

          <label className="language-picker">
            <span>{labels.language}</span>
            <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
              <option value="en">EN</option>
              <option value="tr">TR</option>
            </select>
          </label>
          <ThemeToggle />
        </header>

        <section className="landing-hero">
          <div className="landing-hero-content">
            <h1>{labels.heroTitle}</h1>
            <p>{labels.heroCopy}</p>
            <button type="button" className="submit-button landing-login" onClick={() => goTo("/login", "login")}>
              {labels.goToLogin}
            </button>
          </div>
        </section>

        <section className="landing-sections" aria-label="Atera information">
          <article id="who" className="landing-section">
            <div>
              <span>{labels.who}</span>
              <h2>{labels.who}</h2>
            </div>
            <div className="who-content">
              <p>{labels.whoCopy}</p>
            </div>
            <div className="who-orbit" aria-hidden="true">
              <div className="who-core">Atera</div>
              <span className="who-node node-plan">Plan</span>
              <span className="who-node node-test">Test</span>
              <span className="who-node node-decide">Decide</span>
              <span className="who-node node-scale">Scale</span>
            </div>
          </article>

          <article id="solutions" className="landing-section solutions-section">
            <div>
              <span>{labels.solutions}</span>
              <h2>{labels.solutions}</h2>
            </div>
            <div className="solutions-content">
              <p>{labels.solutionsCopy}</p>
              <div className="persona-carousel" aria-label="Solution personas">
                <div className="persona-track">
                  {[...personas, ...personas].map((persona, index) => (
                    <article className="persona-card" key={`${persona.title}-${index}`}>
                      <PersonaAvatar type={persona.avatarType} title={persona.title} />
                      <div>
                        <h3>{persona.title}</h3>
                        <p>{persona.need}</p>
                        <p>{persona.benefit}</p>
                        <p>{persona.difference}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article id="references" className="landing-section references-section">
            <div>
              <span>{labels.references}</span>
              <h2>{labels.references}</h2>
            </div>
            <div className="references-content">
              <p>{labels.referencesCopy}</p>
              <div className="reference-carousel" aria-label="Reference company logos">
                <div className="reference-track">
                  {[...references, ...references].map((reference, index) => (
                    <article className={`reference-logo-card ${reference.tone}`} key={`${reference.name}-${index}`}>
                      <div className="reference-mark">{reference.mark}</div>
                      <strong>{reference.name}</strong>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article id="contact" className="landing-section contact-section">
            <div>
              <span>{labels.contact}</span>
              <h2>{labels.contact}</h2>
            </div>
            <div className="contact-content">
              <p>{labels.contactCopy}</p>
              <address className="contact-details">
                <a href={`tel:${labels.contactPhone.replaceAll(" ", "")}`}>{labels.contactPhone}</a>
                <a href={`mailto:${labels.contactEmail}`}>{labels.contactEmail}</a>
                <span>{labels.contactLocation}</span>
              </address>
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (session && path === "/dashboard") {
    return renderDashboardLayout(
      "dashboard",
        <section className="dashboard-panel">
          <span>{labels.signedIn}</span>
          <h1>{labels.dashboard}</h1>
          <p>{labels.dashboardCopy}</p>
          {authorizationAccess.read && (
            <button type="button" className="submit-button dashboard-action" onClick={() => goTo("/authorization", "login")}>
              {labels.authorizationPage}
            </button>
          )}
        </section>,
    );
  }

  if (session && path === "/authorization") {
    return renderDashboardLayout(
      "authorization",
        <section className="authorization-page">
          <div className="authorization-heading">
            <span>{labels.dashboard}</span>
            <h1>{labels.authorizationPage}</h1>
            <p>{authorizationAccess.read ? labels.authorizationCopy : labels.authorizationLockedCopy}</p>
          </div>

          {!authorizationAccess.read ? (
            <div className="authorization-locked">
              <strong>{labels.authorizationLocked}</strong>
              <p>{labels.authorizationLockedCopy}</p>
            </div>
          ) : (
            <>
              <div className="authorization-tabs" role="tablist" aria-label={labels.authorizationPage}>
                <button
                  type="button"
                  className={authorizationTab === "roles" ? "active" : ""}
                  onClick={() => setAuthorizationTab("roles")}
                >
                  {labels.roleDefinition}
                </button>
                <button
                  type="button"
                  className={authorizationTab === "users" ? "active" : ""}
                  onClick={() => setAuthorizationTab("users")}
                >
                  {labels.userDefinition}
                </button>
              </div>

              {authorizationTab === "users" ? (
                <div className="authorization-grid user-definition-grid">
                  <form className="authorization-card user-definition-form" onSubmit={handleCreateManagedUser}>
                    <h2>{labels.userDefinition}</h2>
                    <p>{labels.userDefinitionCopy}</p>
                    <label>
                      <span>{labels.username}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        required
                        value={managedUserForm.username}
                        onChange={(event) => updateManagedUserForm("username", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.email}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        required
                        type="email"
                        value={managedUserForm.email}
                        onChange={(event) => updateManagedUserForm("email", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.password}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        minLength="6"
                        required
                        type="password"
                        value={managedUserForm.password}
                        onChange={(event) => updateManagedUserForm("password", event.target.value)}
                      />
                    </label>
                    <div className="user-definition-fields">
                      <label>
                        <span>{labels.phoneNumber}</span>
                        <input
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.phoneNumber}
                          onChange={(event) => updateManagedUserForm("phoneNumber", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>{labels.department}</span>
                        <input
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.department}
                          onChange={(event) => updateManagedUserForm("department", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>{labels.accessLevel}</span>
                        <select
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.accessLevel}
                          onChange={(event) => updateManagedUserForm("accessLevel", event.target.value)}
                        >
                          {roles.map((role) => (
                            <option value={role.name} key={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>{labels.language}</span>
                        <select
                          disabled={!authorizationAccess.write || authorizationLoading}
                          value={managedUserForm.language}
                          onChange={(event) => updateManagedUserForm("language", event.target.value)}
                        >
                          <option value="en">EN</option>
                          <option value="tr">TR</option>
                        </select>
                      </label>
                    </div>
                    <button className="submit-button" disabled={!authorizationAccess.write || authorizationLoading} type="submit">
                      {authorizationLoading ? "..." : labels.createManagedUser}
                    </button>
                    <p className="authorization-note">
                      {authorizationAccess.write ? labels.writeAccess : labels.readOnlyMode}
                    </p>
                  </form>

                  <div className="authorization-card users-card">
                    <div className="permissions-header">
                      <h2>{labels.managedUsers}</h2>
                      {currentProfile?.company?.name && <span>{currentProfile.company.name}</span>}
                    </div>
                    <div className="users-table">
                      <div className="users-row users-row-head">
                        <span>{labels.username}</span>
                        <span>{labels.email}</span>
                        <span>{labels.department}</span>
                        <span>{labels.accessLevel}</span>
                      </div>
                      {profiles.map((profile) => (
                        <div className="users-row" key={profile.id}>
                          <strong>{profile.username}</strong>
                          <span>{profile.email}</span>
                          <span>{profile.department || "-"}</span>
                          <span>{profile.access_level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="authorization-grid">
                  <form className="authorization-card role-form" onSubmit={handleCreateRole}>
                    <h2>{labels.newRole}</h2>
                    <label>
                      <span>{labels.roleName}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        value={roleForm.name}
                        onChange={(event) => updateRoleForm("name", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.roleDescription}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        value={roleForm.description}
                        onChange={(event) => updateRoleForm("description", event.target.value)}
                      />
                    </label>
                    <button className="submit-button" disabled={!authorizationAccess.write || authorizationLoading} type="submit">
                      {labels.createRole}
                    </button>
                    <p className="authorization-note">
                      {authorizationAccess.write ? labels.writeAccess : labels.readOnlyMode}
                    </p>
                  </form>

                  <div className="authorization-card permissions-card">
                    <div className="permissions-header">
                      <h2>{labels.permissions}</h2>
                      {currentProfile?.company?.name && <span>{currentProfile.company.name}</span>}
                    </div>
                    <div className="permissions-table">
                      <div className="permissions-row permissions-row-head">
                        <span>{labels.accessLevel}</span>
                        <span>{labels.module}</span>
                        <span>{labels.readPermission}</span>
                        <span>{labels.writePermission}</span>
                      </div>
                      {roles.map((role) =>
                        modules.map((module) => {
                          const permission = role.permissions[module.module_key] || {};
                          return (
                            <div className="permissions-row" key={`${role.id}-${module.id}`}>
                              <strong>{role.name}</strong>
                              <span>{module.name}</span>
                              <label className="permission-check">
                                <input
                                  checked={Boolean(permission.canRead)}
                                  disabled={!authorizationAccess.write || authorizationLoading}
                                  type="checkbox"
                                  onChange={(event) => updatePermission(role, module, "can_read", event.target.checked)}
                                />
                                <span>{labels.readPermission}</span>
                              </label>
                              <label className="permission-check">
                                <input
                                  checked={Boolean(permission.canWrite)}
                                  disabled={!authorizationAccess.write || authorizationLoading}
                                  type="checkbox"
                                  onChange={(event) => updatePermission(role, module, "can_write", event.target.checked)}
                                />
                                <span>{labels.writePermission}</span>
                              </label>
                            </div>
                          );
                        }),
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {authorizationStatus && <p className="status-message">{authorizationStatus}</p>}
        </section>,
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label="Atera authentication">
        <header className="brand-bar">
          <div className="brand-mark">
            <img src={logoUrl} alt="Atera logo" />
            <div>
              <strong>Atera</strong>
              <span>Commodity Workspace</span>
            </div>
          </div>

          <label className="language-picker">
            <span>{labels.language}</span>
            <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
              <option value="en">EN</option>
              <option value="tr">TR</option>
            </select>
          </label>
          <ThemeToggle />
        </header>

        <div className="avatar-zone">
          <div className="avatar">
            {profilePreview ? <img src={profilePreview} alt="Profile preview" /> : <span>{initials}</span>}
          </div>
          {mode === "signup" && (
            <label className="file-button">
              {labels.profilePicture}
              <input accept="image/*" type="file" onChange={onProfileFileChange} />
            </label>
          )}
        </div>

        {session ? (
          <div className="signed-in">
            <p>{labels.signedIn}</p>
            <button type="button" onClick={handleLogout}>
              {labels.logout}
            </button>
          </div>
        ) : mode === "reset" ? (
          <form className="auth-form" onSubmit={handleResetPassword}>
            <label>
              <span>{labels.resetPassword}</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <label>
              <span>{labels.confirmPassword}</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <button className="submit-button" disabled={loading} type="submit">
              {loading ? "..." : labels.resetPassword}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={mode === "login" ? handleLogin : handleSignup}>
            <label>
              <span>{labels.username}</span>
              <input
                autoComplete="username"
                required
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
              />
            </label>

            <label>
              <span>{labels.password}</span>
              <div className="password-field">
                <input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {mode === "signup" && (
              <label>
                <span>{labels.email}</span>
                <input
                  autoComplete="email"
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </label>
            )}

            {mode === "signup" && (
              <div className="signup-grid">
                <label>
                  <span>{labels.phoneNumber}</span>
                  <input
                    autoComplete="tel"
                    value={form.phoneNumber}
                    onChange={(event) => updateField("phoneNumber", event.target.value)}
                  />
                </label>

                <label>
                  <span>{labels.company}</span>
                  <input value={form.company} onChange={(event) => updateField("company", event.target.value)} />
                </label>

                <label>
                  <span>{labels.department}</span>
                  <input value={form.department} onChange={(event) => updateField("department", event.target.value)} />
                </label>

                <label>
                  <span>{labels.accessLevel}</span>
                  <select value={form.accessLevel} onChange={(event) => updateField("accessLevel", event.target.value)}>
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
            )}

            {mode === "login" && (
              <div className="form-options">
                <label className="check-row">
                  <input
                    checked={rememberUsername}
                    type="checkbox"
                    onChange={(event) => setRememberUsername(event.target.checked)}
                  />
                  <span>{labels.saveLogin}</span>
                </label>
                <button type="button" className="link-button" onClick={handleForgotPassword}>
                  {labels.forgot}
                </button>
              </div>
            )}

            <button className="submit-button" disabled={loading} type="submit">
              {loading ? "..." : mode === "login" ? labels.submitLogin : labels.submitSignup}
            </button>
          </form>
        )}

        {status && <p className="status-message">{status}</p>}
      </section>
    </main>
  );
}

export default App;
