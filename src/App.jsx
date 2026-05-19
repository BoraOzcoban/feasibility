import React, { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import { emptyFinancialExtraCostForm, emptyFinancialModel, loadFinancialModel, saveFinancialExtraCost, saveFinancialModelSettings } from "./lib/financialService";
import { emptyOperationForms, emptyOperationPlan, emptyPlanRows, loadOperationsWorkspace, saveOperationRecord, saveOperationResourcePlan } from "./lib/operationsService";
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

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits }).format(value || 0);
}

function formatLira(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("tr-TR", {
    currency: "TRY",
    maximumFractionDigits,
    style: "currency",
  }).format(value || 0);
}

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
  const [financialExtraCostForm, setFinancialExtraCostForm] = useState(emptyFinancialExtraCostForm);
  const [financialHorizon, setFinancialHorizon] = useState("6m");
  const [financialModel, setFinancialModel] = useState(emptyFinancialModel);
  const [financialSettingsForm, setFinancialSettingsForm] = useState({ electricityPricePerKwh: 0 });
  const [financialStatus, setFinancialStatus] = useState("");
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financeWindow, setFinanceWindow] = useState("today");
  const [financeDateRange, setFinanceDateRange] = useState({ start: "", end: "" });
  const [operationForms, setOperationForms] = useState(emptyOperationForms);
  const [operationPlan, setOperationPlan] = useState(emptyOperationPlan);
  const [operationPlanResult, setOperationPlanResult] = useState(null);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationsStatus, setOperationsStatus] = useState("");
  const [operationsWorkspace, setOperationsWorkspace] = useState({
    activePlans: [],
    latestPlan: null,
    machines: [],
    materials: [],
    notes: [],
    product: null,
    products: [],
    workforce: [],
  });

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

  useEffect(() => {
    if (!session || !supabase) {
      setOperationsWorkspace({
        activePlans: [],
        latestPlan: null,
        machines: [],
        materials: [],
        notes: [],
        product: null,
        products: [],
        workforce: [],
      });
      setOperationPlan(emptyOperationPlan);
      setOperationPlanResult(null);
      setFinancialModel(emptyFinancialModel);
      setFinancialSettingsForm({ electricityPricePerKwh: 0 });
      setFinancialExtraCostForm(emptyFinancialExtraCostForm);
      setFinancialStatus("");
      return;
    }

    loadOperationsData();
    loadFinancialData();
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

  function updateFinanceDateRange(field, value) {
    setFinanceDateRange((current) => ({ ...current, [field]: value }));
    setFinanceWindow("custom");
  }

  function updateOperationPlan(field, value) {
    setOperationPlan((current) => ({ ...current, [field]: value }));
  }

  function updateOperationPlanRow(collection, index, field, value) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: value } : row
      )),
    }));
  }

  function addOperationPlanRow(collection, row) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: [...(current[collection] || []), row],
    }));
  }

  function removeOperationPlanRow(collection, index) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateOperationForm(entity, field, value) {
    setOperationForms((current) => ({
      ...current,
      [entity]: {
        ...current[entity],
        [field]: value,
      },
    }));
  }

  function addProductMaterialRow() {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: [
          ...(current.product.materialRows || []),
          {
            materialId: operationsWorkspace.materials[0]?.id || "",
            quantityPerUnit: 0,
          },
        ],
      },
    }));
  }

  function updateProductMaterialRow(index, field, value) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: (current.product.materialRows || []).map((row, rowIndex) => (
          rowIndex === index ? { ...row, [field]: value } : row
        )),
      },
    }));
  }

  function removeProductMaterialRow(index) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: (current.product.materialRows || []).filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  }

  async function loadOperationsData() {
    if (!supabase) return;

    setOperationsLoading(true);
    setOperationsStatus("");

    try {
      const workspace = await loadOperationsWorkspace(supabase);
      setOperationsWorkspace(workspace);

      if (workspace.latestPlan) {
        const savedMachineRows = Array.isArray(workspace.latestPlan.input?.machineRows) ? workspace.latestPlan.input.machineRows : [];
        const savedMaterialRows = Array.isArray(workspace.latestPlan.input?.materialRows) ? workspace.latestPlan.input.materialRows : [];
        const savedWorkforceRows = Array.isArray(workspace.latestPlan.input?.workforceRows) ? workspace.latestPlan.input.workforceRows : [];
        const hasSimplePlanResult = workspace.latestPlan.result?.energyConsumptionKwh !== undefined;

        setOperationPlan({
          ...emptyOperationPlan,
          ...workspace.latestPlan.input,
          machineRows: savedMachineRows.length
            ? savedMachineRows.map((row) => ({
                dailyHours: row.dailyHours || 0,
                machineId: row.machineId || "",
              }))
            : (workspace.machines[0]
                ? [{ ...emptyPlanRows.machine, machineId: workspace.machines[0].id }]
                : []),
          materialRows: savedMaterialRows.length
            ? savedMaterialRows.map((row) => ({
                dailyQuantity: row.dailyQuantity ?? row.quantityPerUnit ?? 0,
                materialId: row.materialId || "",
              }))
            : workspace.materials.slice(0, 2).map((material) => ({
                dailyQuantity: 0,
                materialId: material.id,
              })),
          productId: workspace.latestPlan.input?.productId || workspace.product?.id || "",
          productName: workspace.latestPlan.input?.productName || workspace.product?.name || "",
          workforceRows: savedWorkforceRows.length
            ? savedWorkforceRows
            : (workspace.workforce[0]
                ? [{ ...emptyPlanRows.workforce, workforceId: workspace.workforce[0].id }]
                : []),
        });
        setOperationPlanResult(hasSimplePlanResult ? workspace.latestPlan.result : null);
      } else if (workspace.product) {
        setOperationPlan((current) => ({
          ...current,
          machineRows: workspace.machines[0]
            ? [{ ...emptyPlanRows.machine, machineId: workspace.machines[0].id }]
            : [],
          materialRows: workspace.materials.length
            ? workspace.materials.slice(0, 2).map((material) => ({
                dailyQuantity: 0,
                materialId: material.id,
              }))
            : [],
          productId: workspace.product.id,
          productName: workspace.product.name || "",
          workforceRows: workspace.workforce[0]
            ? [{ ...emptyPlanRows.workforce, workforceId: workspace.workforce[0].id }]
            : [],
        }));
        setOperationPlanResult(null);
      }
    } catch (error) {
      setOperationsStatus(`Operations verisi yuklenemedi: ${error.message}`);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleSaveOperationPlan(event) {
    event.preventDefault();
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return;
    }

    setOperationsLoading(true);

    try {
      const savedPlan = await saveOperationResourcePlan(supabase, {
        ...operationPlan,
      });

      setOperationPlan({ ...emptyOperationPlan, ...savedPlan.input });
      setOperationPlanResult(savedPlan.result);
      setOperationsStatus("Kaynak planı Supabase veritabanına kaydedildi ve backend fonksiyonunda hesaplandı.");
      await loadOperationsData();
      await loadFinancialData();
    } catch (error) {
      setOperationsStatus(error.message);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleSaveOperationRecord(entity, event) {
    event.preventDefault();
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return;
    }

    setOperationsLoading(true);

    try {
      await saveOperationRecord(supabase, entity, {
        ...operationForms[entity],
        productId: operationPlan.productId || operationsWorkspace.product?.id,
      });

      setOperationForms((current) => ({ ...current, [entity]: emptyOperationForms[entity] }));
      setOperationsStatus("Operations kaydı Supabase veritabanına kaydedildi.");
      await loadOperationsData();
    } catch (error) {
      setOperationsStatus(error.message);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function loadFinancialData(nextHorizon = financialHorizon) {
    if (!supabase) return;

    setFinancialLoading(true);
    setFinancialStatus("");

    try {
      const nextModel = await loadFinancialModel(supabase, nextHorizon);
      setFinancialModel(nextModel);
      setFinancialSettingsForm({
        electricityPricePerKwh: nextModel.settings?.electricityPricePerKwh || 0,
      });
    } catch (error) {
      setFinancialStatus(`Finansal model yuklenemedi: ${error.message}`);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleSaveFinancialSettings(event) {
    event.preventDefault();
    setFinancialStatus("");

    if (!supabase) {
      setFinancialStatus(labels.configure);
      return;
    }

    setFinancialLoading(true);

    try {
      await saveFinancialModelSettings(supabase, financialSettingsForm);
      setFinancialStatus("Elektrik birim fiyatı Supabase'e kaydedildi.");
      await loadFinancialData();
    } catch (error) {
      setFinancialStatus(error.message);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleSaveFinancialExtraCost(event) {
    event.preventDefault();
    setFinancialStatus("");

    if (!supabase) {
      setFinancialStatus(labels.configure);
      return;
    }

    setFinancialLoading(true);

    try {
      await saveFinancialExtraCost(supabase, financialExtraCostForm);
      setFinancialExtraCostForm(emptyFinancialExtraCostForm);
      setFinancialStatus("Ek finansal gider Supabase'e kaydedildi.");
      await loadFinancialData();
    } catch (error) {
      setFinancialStatus(error.message);
    } finally {
      setFinancialLoading(false);
    }
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

  function renderOperationPlanner() {
    const result = operationPlanResult;
    const machineRows = operationPlan.machineRows || [];
    const workforceRows = operationPlan.workforceRows || [];
    const selectedProduct = operationsWorkspace.products.find((product) => product.id === operationPlan.productId);
    const selectedProductMaterials = selectedProduct?.material_rows || [];
    const defaultMachineRow = {
      ...emptyPlanRows.machine,
      machineId: operationsWorkspace.machines[0]?.id || "",
    };
    const defaultWorkforceRow = {
      ...emptyPlanRows.workforce,
      workforceId: operationsWorkspace.workforce[0]?.id || "",
    };

    return (
      <section className="operation-planner" aria-label="Kaynak planlama hesaplayıcı">
        <form className="operation-card planner-input-card" onSubmit={handleSaveOperationPlan}>
          <div className="operation-card-heading">
            <div>
              <span>Veri girişi</span>
              <h2>Basit günlük üretim maliyeti</h2>
            </div>
            <button
              type="button"
              onClick={() => setOperationPlan({
                ...emptyOperationPlan,
                machineRows: defaultMachineRow.machineId ? [defaultMachineRow] : [],
                productId: operationsWorkspace.product?.id || "",
                productName: operationsWorkspace.product?.name || "",
                workforceRows: defaultWorkforceRow.workforceId ? [defaultWorkforceRow] : [],
              })}
            >
              Varsayılanı Yükle
            </button>
          </div>
          <div className="planner-fields">
            <label>
              <span>Plan adı</span>
              <div>
                <input
                  type="text"
                  value={operationPlan.planName ?? ""}
                  onChange={(event) => updateOperationPlan("planName", event.target.value)}
                />
              </div>
            </label>
            <label>
              <span>Ürün</span>
              <div>
                <select
                  value={operationPlan.productId || ""}
                  onChange={(event) => {
                    const product = operationsWorkspace.products.find((item) => item.id === event.target.value);
                    setOperationPlan((current) => ({
                      ...current,
                      productId: product?.id || "",
                      productName: product?.name || "",
                    }));
                  }}
                >
                  <option value="">Ürün seç</option>
                  {operationsWorkspace.products.map((product) => (
                    <option value={product.id} key={product.id}>{product.name}</option>
                  ))}
                </select>
                <small>{selectedProduct ? `${formatLira(selectedProduct.price, 2)} / ${selectedProduct.unit || "adet"}` : "Ürünler ekranından kayıt seçin"}</small>
              </div>
            </label>
            {[
              ["productName", "Yeni ürün adı", "", "text"],
            ].map(([field, label, suffix, type = "number"]) => (
              <label key={field}>
                <span>{label}</span>
                <div>
                  <input
                    min="0"
                    step="1"
                    type={type}
                    value={operationPlan[field] ?? ""}
                    onChange={(event) => updateOperationPlan(field, event.target.value)}
                  />
                  {suffix && <small>{suffix}</small>}
                </div>
              </label>
            ))}
          </div>

          <div className="resource-section">
            <div className="resource-section-header">
              <div>
                <span>Makine seçimi</span>
                <p>Ürünü üretirken hangi makinenin günde kaç saat kullanılacağını girin.</p>
              </div>
              <button type="button" onClick={() => addOperationPlanRow("machineRows", defaultMachineRow)}>
                Makine Ekle
              </button>
            </div>
            <div className="resource-row-list">
              {machineRows.length ? machineRows.map((row, index) => {
                const selectedMachine = operationsWorkspace.machines.find((machine) => machine.id === row.machineId);

                return (
                  <div className="resource-row-grid machine-plan-row" key={`machine-${index}`}>
                    <label>
                      <span>Makine</span>
                      <select value={row.machineId || ""} onChange={(event) => updateOperationPlanRow("machineRows", index, "machineId", event.target.value)}>
                        <option value="">Makine seç</option>
                        {operationsWorkspace.machines.map((machine) => (
                          <option value={machine.id} key={machine.id}>
                            {machine.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Günlük saat</span>
                      <input
                        min="0"
                        step="0.25"
                        type="number"
                        value={row.dailyHours ?? ""}
                        onChange={(event) => updateOperationPlanRow("machineRows", index, "dailyHours", event.target.value)}
                      />
                    </label>
                    <div className="resource-row-meta">
                      <strong>{selectedMachine ? `${formatNumber(selectedMachine.hourly_energy_consumption_kwh, 2)} kWh/saat` : "-"}</strong>
                      <small>{selectedMachine ? `Makine fiyatı ${formatLira(selectedMachine.price)}` : "Kayıt seçilmedi"}</small>
                    </div>
                    <button type="button" className="resource-remove-button" onClick={() => removeOperationPlanRow("machineRows", index)}>
                      Sil
                    </button>
                  </div>
                );
              }) : (
                <p className="planner-empty-state">Makine kaydı yok. Önce Makine & Ekipman ekranından gerçek makine ekleyin.</p>
              )}
            </div>
          </div>

          <div className="resource-section">
            <div className="resource-section-header">
              <div>
                <span>İşgücü seçimi</span>
                <p>Hangi rolden kaç kişinin günde kaç saat çalışacağını girin.</p>
              </div>
              <button type="button" onClick={() => addOperationPlanRow("workforceRows", defaultWorkforceRow)}>
                İşgücü Ekle
              </button>
            </div>
            <div className="resource-row-list">
              {workforceRows.length ? workforceRows.map((row, index) => {
                const selectedWorkforce = operationsWorkspace.workforce.find((workforce) => workforce.id === row.workforceId);

                return (
                  <div className="resource-row-grid workforce-plan-row" key={`workforce-${index}`}>
                    <label>
                      <span>Rol</span>
                      <select value={row.workforceId || ""} onChange={(event) => updateOperationPlanRow("workforceRows", index, "workforceId", event.target.value)}>
                        <option value="">Rol seç</option>
                        {operationsWorkspace.workforce.map((workforce) => (
                          <option value={workforce.id} key={workforce.id}>
                            {workforce.role_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Kişi</span>
                      <input
                        min="0"
                        step="1"
                        type="number"
                        value={row.peopleAssigned ?? ""}
                        onChange={(event) => updateOperationPlanRow("workforceRows", index, "peopleAssigned", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Günlük saat</span>
                      <input
                        min="0"
                        step="0.25"
                        type="number"
                        value={row.dailyHours ?? ""}
                        onChange={(event) => updateOperationPlanRow("workforceRows", index, "dailyHours", event.target.value)}
                      />
                    </label>
                    <div className="resource-row-meta">
                      <strong>{selectedWorkforce ? `${formatLira(selectedWorkforce.hourly_cost)} / saat` : "-"}</strong>
                      <small>{selectedWorkforce ? "Saatlik maliyet Supabase kaydından okunur" : "Kayıt seçilmedi"}</small>
                    </div>
                    <button type="button" className="resource-remove-button" onClick={() => removeOperationPlanRow("workforceRows", index)}>
                      Sil
                    </button>
                  </div>
                );
              }) : (
                <p className="planner-empty-state">İşgücü kaydı yok. Önce İnsan Kaynağı ekranından rol ekleyin.</p>
              )}
            </div>
          </div>

          <div className="resource-section">
            <div className="resource-section-header">
              <div>
                <span>Ürün malzemeleri</span>
                <p>Malzeme miktarları seçilen ürün reçetesinden ve hesaplanan üretim adedinden otomatik hesaplanır.</p>
              </div>
            </div>
            <div className="resource-row-list">
              {selectedProductMaterials.length ? selectedProductMaterials.map((row) => (
                  <div className="resource-row-grid material-plan-row" key={row.id || row.material_id}>
                    <div className="resource-row-meta">
                      <strong>{row.material?.name || "-"}</strong>
                      <small>{formatNumber(row.quantity_per_unit, 4)} {row.material?.unit || ""} / {selectedProduct.unit || "adet"}</small>
                    </div>
                    <div className="resource-row-meta">
                      <strong>{formatLira(row.material?.price_per_unit, 2)}</strong>
                      <small>Birim fiyat</small>
                    </div>
                  </div>
                )) : (
                <p className="planner-empty-state">Bu ürün için reçete yok. Önce Ürünler ekranında gerekli malzemeleri ekleyin.</p>
              )}
            </div>
          </div>

          <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
            {operationsLoading ? "Kaydediliyor..." : "Supabase'e Kaydet ve Hesapla"}
          </button>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </form>

        <article className="operation-card planner-result-card">
          <div className="operation-card-heading">
            <div>
              <span>{result ? "Backend sonucu hazır" : "Backend sonucu bekleniyor"}</span>
              <h2>Günlük maliyet özeti</h2>
            </div>
            <mark className={result ? "ok" : "bad"}>
              {result ? `${formatNumber(result.energyConsumptionKwh, 2)} kWh` : "Hesap yok"}
            </mark>
          </div>
          {!result ? (
            <p className="planner-empty-state">
              Girdileri kaydettiğinizde hesap Supabase RPC fonksiyonunda yapılacak ve sonuç operation_resource_plans tablosuna yazılacak.
            </p>
          ) : (
            <>
              <div className="planner-summary-grid">
                <span>Ürün <strong>{result.productName || "-"}</strong></span>
                <span>Birim Fiyat <strong>{formatLira(result.productPrice, 2)} / {result.productUnit || "adet"}</strong></span>
                <span>Üretilecek Miktar <strong>{formatNumber(result.producedQuantity, 2)} {result.productUnit || "adet"}</strong></span>
                <span>Çevrim Süresi <strong>{formatNumber(result.cycleTimeMinutes, 2)} dk</strong></span>
                <span>Elektrik Tüketimi <strong>{formatNumber(result.energyConsumptionKwh, 2)} kWh</strong></span>
                <span>Malzeme Maliyeti <strong>{formatLira(result.materialCost)}</strong></span>
                <span>İşgücü Maliyeti <strong>{formatLira(result.workforceCost)}</strong></span>
              </div>
              <div className="allocation-grid">
                <span>Makine Saati <strong>{formatNumber(result.machineHoursUsed, 1)} saat</strong></span>
                <span>İşgücü Saati <strong>{formatNumber(result.workforceHoursUsed, 1)} saat</strong></span>
                <span>Seçili Makine Değeri <strong>{formatLira(result.selectedMachineValue)}</strong></span>
              </div>
              <div className="cost-breakdown">
                <span>Takip Edilen Günlük Maliyet <strong>{formatLira(result.totalTrackedDailyCost)}</strong></span>
                <span>Kayıtlı Ürün <strong>{result.productName || "-"}</strong></span>
              </div>
              <div className="selected-resource-results">
                <div>
                  <h3>Makine kırılımı</h3>
                  {(result.machineRows || []).map((row) => (
                    <span key={row.machineId}>
                      {row.name} <strong>{formatNumber(row.energyConsumptionKwh, 2)} kWh</strong>
                    </span>
                  ))}
                </div>
                <div>
                  <h3>İşgücü kırılımı</h3>
                  {(result.workforceRows || []).map((row) => (
                    <span key={row.workforceId}>
                      {row.roleName} <strong>{formatLira(row.cost)}</strong>
                    </span>
                  ))}
                </div>
                <div>
                  <h3>Malzeme kırılımı</h3>
                  {(result.materialRows || []).map((row) => (
                    <span key={row.materialId}>
                      {row.name} <strong>{formatLira(row.cost)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </article>
      </section>
    );
  }

  function renderOperationRecordForm(entity, fields) {
    return (
      <form className="operation-card operation-data-form" onSubmit={(event) => handleSaveOperationRecord(entity, event)}>
        <div className="operation-data-fields">
          {fields.map((field) => (
            <label key={field.name}>
              <span>{field.label}</span>
              {field.type === "select" ? (
                <select value={operationForms[entity][field.name]} onChange={(event) => updateOperationForm(entity, field.name, event.target.value)}>
                  {field.options.map((option) => (
                    <option value={option} key={option}>{option}</option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea value={operationForms[entity][field.name]} onChange={(event) => updateOperationForm(entity, field.name, event.target.value)} />
              ) : (
                <input
                  min={field.min ?? 0}
                  step={field.step || "1"}
                  type={field.type || "text"}
                  value={operationForms[entity][field.name]}
                  onChange={(event) => updateOperationForm(entity, field.name, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
          {operationsLoading ? "Kaydediliyor..." : "Supabase'e Kaydet"}
        </button>
      </form>
    );
  }

  function renderProductDataPage() {
    const productMaterialRows = operationForms.product.materialRows || [];

    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / Ürünler</span>
              <h1>Ürünler</h1>
              <p>Veri girişi hesaplamasında kullanılacak ürün reçetesini, birimini, fiyatını ve çevrim süresini tutun.</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>Verileri Yenile</button>
            </div>
          </div>

          <div className="operation-data-grid">
            <form className="operation-card operation-data-form" onSubmit={(event) => handleSaveOperationRecord("product", event)}>
              <div className="operation-data-fields">
                <label>
                  <span>Ürün adı</span>
                  <input
                    type="text"
                    value={operationForms.product.name}
                    onChange={(event) => updateOperationForm("product", "name", event.target.value)}
                  />
                </label>
                <label>
                  <span>Birim</span>
                  <select
                    value={operationForms.product.unit}
                    onChange={(event) => updateOperationForm("product", "unit", event.target.value)}
                  >
                    {["adet", "kg", "gr", "mg", "metre", "litre", "ml"].map((unit) => (
                      <option value={unit} key={unit}>{unit}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Fiyat</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={operationForms.product.price}
                    onChange={(event) => updateOperationForm("product", "price", event.target.value)}
                  />
                </label>
                <label>
                  <span>Çevrim süresi</span>
                  <input
                    min="0.0001"
                    step="0.01"
                    type="number"
                    value={operationForms.product.cycleTimeMinutes}
                    onChange={(event) => updateOperationForm("product", "cycleTimeMinutes", event.target.value)}
                  />
                </label>
              </div>

              <div className="resource-section">
                <div className="resource-section-header">
                  <div>
                    <span>Gerekli malzemeler</span>
                    <p>Bir ürün birimi üretmek için gereken malzemeleri ve miktarları girin.</p>
                  </div>
                  <button type="button" onClick={addProductMaterialRow}>Malzeme Ekle</button>
                </div>
                <div className="resource-row-list">
                  {productMaterialRows.length ? productMaterialRows.map((row, index) => {
                    const selectedMaterial = operationsWorkspace.materials.find((material) => material.id === row.materialId);

                    return (
                      <div className="resource-row-grid material-plan-row" key={`product-material-${index}`}>
                        <label>
                          <span>Malzeme</span>
                          <select value={row.materialId || ""} onChange={(event) => updateProductMaterialRow(index, "materialId", event.target.value)}>
                            <option value="">Malzeme seç</option>
                            {operationsWorkspace.materials.map((material) => (
                              <option value={material.id} key={material.id}>{material.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Birim başına miktar</span>
                          <input
                            min="0"
                            step="0.0001"
                            type="number"
                            value={row.quantityPerUnit ?? ""}
                            onChange={(event) => updateProductMaterialRow(index, "quantityPerUnit", event.target.value)}
                          />
                        </label>
                        <div className="resource-row-meta">
                          <strong>{selectedMaterial?.unit || "-"}</strong>
                          <small>{selectedMaterial ? `${formatLira(selectedMaterial.price_per_unit, 2)} / ${selectedMaterial.unit}` : "Kayıt seçilmedi"}</small>
                        </div>
                        <button type="button" className="resource-remove-button" onClick={() => removeProductMaterialRow(index)}>
                          Sil
                        </button>
                      </div>
                    );
                  }) : (
                    <p className="planner-empty-state">Henüz reçete malzemesi yok. Önce Malzeme Tanımları ekranında malzeme ekleyin, sonra buradan ürüne bağlayın.</p>
                  )}
                </div>
              </div>

              <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                {operationsLoading ? "Kaydediliyor..." : "Supabase'e Kaydet"}
              </button>
            </form>

            <article className="operation-card operation-data-table-card">
              <div className="operation-card-heading">
                <h2>Kayıtlar</h2>
                <span>{operationsWorkspace.products.length} kayıt</span>
              </div>
              <div className="operation-data-table">
                <div className="operation-data-row operation-data-head" style={{ gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.8fr 1.4fr" }}>
                  <span>Ürün</span>
                  <span>Birim</span>
                  <span>Fiyat</span>
                  <span>Çevrim</span>
                  <span>Malzemeler</span>
                </div>
                {(operationsWorkspace.products.length ? operationsWorkspace.products : [{ id: "empty" }]).map((product) => (
                  <button
                    type="button"
                    className="operation-data-row operation-data-button-row"
                    style={{ gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.8fr 1.4fr" }}
                    key={product.id}
                    onClick={() => {
                      if (product.id === "empty") return;

                      setOperationForms((current) => ({
                        ...current,
                        product: {
                          cycleTimeMinutes: product.cycle_time_minutes || 1,
                          materialRows: (product.material_rows || []).map((row) => ({
                            materialId: row.material_id,
                            quantityPerUnit: row.quantity_per_unit,
                          })),
                          name: product.name || "",
                          price: product.price || 0,
                          unit: product.unit || "adet",
                        },
                      }));
                    }}
                  >
                    <span>{product.id === "empty" ? "-" : product.name}</span>
                    <span>{product.id === "empty" ? "-" : product.unit || "adet"}</span>
                    <span>{product.id === "empty" ? "-" : formatLira(product.price, 2)}</span>
                    <span>{product.id === "empty" ? "-" : `${formatNumber(product.cycle_time_minutes || 1, 2)} dk`}</span>
                    <span>{product.id === "empty" ? "-" : (product.material_rows || []).map((row) => `${row.material?.name || "-"}: ${formatNumber(row.quantity_per_unit, 4)} ${row.material?.unit || ""}`).join(", ") || "-"}</span>
                  </button>
                ))}
              </div>
            </article>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderActiveProcessesPage() {
    const activePlans = operationsWorkspace.activePlans || [];

    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / Mevcut Süreçler</span>
              <h1>Mevcut Süreçler</h1>
              <p>Supabase'e kaydedilen üretim planlarını ve hesaplanan üretim/maliyet sonuçlarını takip edin.</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>Verileri Yenile</button>
              <button type="button" className="primary" onClick={() => goTo("/operations/data-entry", "login")}>Yeni Plan</button>
            </div>
          </div>

          <div className="process-summary-grid">
            <article className="operation-card process-summary-card">
              <span>Aktif Plan</span>
              <strong>{activePlans.length}</strong>
            </article>
            <article className="operation-card process-summary-card">
              <span>Toplam Üretim</span>
              <strong>{formatNumber(activePlans.reduce((total, plan) => total + (Number(plan.result?.producedQuantity) || 0), 0), 2)}</strong>
            </article>
            <article className="operation-card process-summary-card">
              <span>Takip Edilen Maliyet</span>
              <strong>{formatLira(activePlans.reduce((total, plan) => total + (Number(plan.result?.totalTrackedDailyCost) || 0), 0))}</strong>
            </article>
          </div>

          <div className="process-list">
            {activePlans.length ? activePlans.map((plan) => {
              const result = plan.result || {};
              const productName = plan.product?.name || result.productName || plan.input?.productName || "-";
              const productUnit = result.productUnit || plan.product?.unit || "adet";
              const machineRows = Array.isArray(result.machineRows) ? result.machineRows : [];
              const materialRows = Array.isArray(result.materialRows) ? result.materialRows : [];

              return (
                <article className="operation-card process-card" key={plan.id}>
                  <div className="operation-card-heading">
                    <div>
                      <span>{new Date(plan.created_at).toLocaleString("tr-TR")}</span>
                      <h2>{plan.plan_name || "Günlük üretim planı"}</h2>
                    </div>
                    <mark className="ok">Aktif</mark>
                  </div>

                  <div className="process-metrics">
                    <span>Ürün <strong>{productName}</strong></span>
                    <span>Üretilecek Miktar <strong>{formatNumber(result.producedQuantity, 2)} {productUnit}</strong></span>
                    <span>Çevrim <strong>{formatNumber(result.cycleTimeMinutes, 2)} dk</strong></span>
                    <span>Ana Makine Saati <strong>{formatNumber(result.primaryMachineDailyHours, 2)} saat</strong></span>
                    <span>Enerji <strong>{formatNumber(result.energyConsumptionKwh, 2)} kWh</strong></span>
                    <span>Maliyet <strong>{formatLira(result.totalTrackedDailyCost)}</strong></span>
                  </div>

                  <div className="process-detail-grid">
                    <div>
                      <h3>Makineler</h3>
                      {(machineRows.length ? machineRows : [{ machineId: "empty", name: "-", dailyHours: 0 }]).map((row) => (
                        <span key={row.machineId}>
                          {row.name} <strong>{formatNumber(row.dailyHours, 2)} saat</strong>
                        </span>
                      ))}
                    </div>
                    <div>
                      <h3>Malzeme Kullanımı</h3>
                      {(materialRows.length ? materialRows : [{ materialId: "empty", name: "-", dailyQuantity: 0, unit: "" }]).map((row) => (
                        <span key={row.materialId}>
                          {row.name} <strong>{formatNumber(row.dailyQuantity, 4)} {row.unit || ""}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            }) : (
              <article className="operation-card process-card">
                <p className="planner-empty-state">Henüz Supabase'e kaydedilmiş üretim planı yok. Veri girişi ekranından plan kaydedince burada görünecek.</p>
              </article>
            )}
          </div>

          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderFinancialModellingPage() {
    const summary = financialModel.summary || emptyFinancialModel.summary;
    const chart = financialModel.trendChart || emptyFinancialModel.trendChart;

    return renderDashboardLayout(
      "financial-modelling",
        <section className="financial-workspace">
          <div className="financial-header">
            <div>
              <span>Operations verisine bağlı model</span>
              <h1>Finansal Modelleme</h1>
              <p>Gelir, gider ve net kazanç hesapları Supabase fonksiyonunda mevcut süreçlerden hesaplanır.</p>
            </div>
            <button type="button" className="primary" onClick={() => loadFinancialData()}>
              {financialLoading ? "Yükleniyor..." : "Verileri Güncelle"}
            </button>
          </div>

          <div className="financial-controls finance-input-panel">
            <form onSubmit={handleSaveFinancialSettings}>
              <label>
                <span>Elektrik kW fiyatı</span>
                <input
                  min="0"
                  step="0.0001"
                  type="number"
                  value={financialSettingsForm.electricityPricePerKwh}
                  onChange={(event) => setFinancialSettingsForm({ electricityPricePerKwh: event.target.value })}
                />
              </label>
              <button type="submit" disabled={financialLoading}>Kaydet</button>
            </form>

            <form onSubmit={handleSaveFinancialExtraCost}>
              <label>
                <span>Ek gider adı</span>
                <input
                  type="text"
                  value={financialExtraCostForm.name}
                  onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                <span>Tip</span>
                <select
                  value={financialExtraCostForm.costType}
                  onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, costType: event.target.value }))}
                >
                  <option value="initial">Başlangıç</option>
                  <option value="recurring">Tekrarlayan</option>
                </select>
              </label>
              <label>
                <span>Tutar</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={financialExtraCostForm.amount}
                  onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </label>
              <button type="submit" disabled={financialLoading}>Ek Gider Ekle</button>
            </form>
          </div>

          {financialStatus && <p className="status-message">{financialStatus}</p>}

          <div className="finance-metric-grid">
            {[
              ["Mevcut Süreç", summary.planCount],
              ["Satış Kazançları", formatLira(summary.salesRevenue)],
              ["Toplam Gider", formatLira(summary.totalCost)],
              ["Net Kazanç", formatLira(summary.netIncome)],
            ].map(([label, value]) => (
              <article className="finance-metric-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>Supabase hesap sonucu</small>
              </article>
            ))}
          </div>

          <div className="financial-grid">
            <article className="financial-card income-card">
              <div className="financial-card-heading"><h2>Gelir Tablosu</h2></div>
              <div className="income-table simplified-income-table">
                <div className="income-row income-head"><span>Kalem</span><span>Tip</span><span>Tutar</span></div>
                {(financialModel.incomeRows || []).map((row, index) => (
                  <div className="income-row" key={`${row.label}-${index}`}>
                    <strong>{row.label}</strong>
                    <span>{row.kind === "income" ? "Gelir" : row.costType === "initial" ? "Başlangıç gideri" : "Gider"}</span>
                    <span>{formatLira(row.amount)}</span>
                  </div>
                ))}
                <div className="income-row income-total">
                  <strong>Net kazanç</strong>
                  <span>Gelir - gider</span>
                  <span>{formatLira(summary.netIncome)}</span>
                </div>
              </div>
            </article>

            <article className="financial-card trend-card">
            <div className="financial-card-heading">
              <h2>Finansal Trendler</h2>
              <div className="mini-tabs">
                {[
                  ["6m", "6 Ay"],
                  ["1y", "1 Yıl"],
                  ["5y", "5 Yıl"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    className={financialHorizon === value ? "active" : ""}
                    onClick={() => {
                      setFinancialHorizon(value);
                      loadFinancialData(value);
                    }}
                    key={value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-legend" aria-label="Grafik renk açıklaması">
              <span className="legend-sales">Satış kazançları</span>
              <span className="legend-costs">Giderler</span>
              <span className="legend-net">Net kazanç</span>
            </div>
              <svg className="trend-chart finance-model-chart" viewBox="0 0 560 280" role="img" aria-label="Satış kazançları, giderler ve net kazanç projeksiyon grafiği">
                <text className="axis-label axis-label-y" x="-162" y="18" transform="rotate(-90)">Tutar (TRY)</text>
                <text className="axis-label axis-label-x" x="272" y="262">Projeksiyon dönemi</text>
                <path className="chart-grid" d="M30 40 H500 M30 82.5 H500 M30 125 H500 M30 167.5 H500 M30 210 H500" />
                <path className="chart-axis" d="M30 30 V210 H500" />
                <text className="chart-tick" x="30" y="214">0</text>
                <text className="chart-tick" x="24" y="44">Yüksek</text>
                <text className="chart-tick" x="30" y="232">Başlangıç</text>
                <text className="chart-tick chart-tick-end" x="500" y="232">Bitiş</text>
                {chart.salesPath && <path className="trend-line sales" d={chart.salesPath} />}
                {chart.costPath && <path className="trend-line costs" d={chart.costPath} />}
                {chart.netPath && <path className="trend-line net" d={chart.netPath} />}
              </svg>
            </article>

            <article className="financial-card cost-card">
              <h2>Maliyet Yapısı</h2>
              <div className="cost-body">
                <div className="donut-chart cost-donut" aria-hidden="true"><span>{formatLira(summary.totalCost)}</span></div>
                <div className="cost-list">
                  {(financialModel.costStructure || []).map((item) => (
                    <span key={item.label}>{item.label}<strong>{formatLira(item.amount)}</strong></span>
                  ))}
                </div>
              </div>
            </article>

            <article className="financial-card scenario-card">
              <div className="financial-card-heading"><h2>Ek Giderler</h2></div>
              <div className="scenario-list">
                {(financialModel.extraCosts?.length ? financialModel.extraCosts : [{ id: "empty", name: "Henüz ek gider yok", costType: "-", amount: 0 }]).map((cost) => (
                  <div className="scenario-row" key={cost.id}>
                    <div>
                      <strong>{cost.name}</strong>
                      <span>{cost.costType === "initial" ? "Başlangıç gideri" : cost.costType === "recurring" ? "Tekrarlayan gider" : "-"}</span>
                    </div>
                    <strong>{cost.id === "empty" ? "-" : formatLira(cost.amount)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>,
    );
  }

  function renderOperationDataPage({ columns, description, entity, fields, rows, title }) {
    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / {activeOperationsSubmodule.label}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>Verileri Yenile</button>
            </div>
          </div>

          <div className="operation-data-grid">
            {renderOperationRecordForm(entity, fields)}
            <article className="operation-card operation-data-table-card">
              <div className="operation-card-heading">
                <h2>Kayıtlar</h2>
                <span>{rows.length} kayıt</span>
              </div>
              <div className="operation-data-table">
                <div className="operation-data-row operation-data-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))` }}>
                  {columns.map((column) => <span key={column.header}>{column.header}</span>)}
                </div>
                {(rows.length ? rows : [{ id: "empty" }]).map((row) => (
                  <div className="operation-data-row" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))` }} key={row.id}>
                    {columns.map((column) => (
                      <span key={column.header}>{row.id === "empty" ? "-" : column.render(row)}</span>
                    ))}
                  </div>
                ))}
              </div>
            </article>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
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

  const dashboardStats = [
    { label: "Günlük Üretim", value: "24.580", delta: "+12%", detail: "düne göre" },
    { label: "Kapasite Kullanımı", value: "78%", delta: "+8%", detail: "hedefin üstünde" },
    { label: "Günlük Karlılık", value: "₺4.2M", delta: "+14%", detail: "net operasyonel etki" },
    { label: "Kritik Alarm", value: "3", delta: "aktif", detail: "aksiyon bekliyor" },
  ];

  const factoryLines = [
    { name: "LINE-1", status: "aktif", tone: "teal" },
    { name: "LINE-2", status: "aktif", tone: "teal" },
    { name: "LINE-3", status: "bakım", tone: "amber" },
    { name: "LINE-4", status: "kritik", tone: "clay" },
    { name: "QC-02", status: "aktif", tone: "cyan" },
  ];

  const dashboardInsights = [
    { title: "LINE-2 çıktı limiti", copy: "Vardiya sonuna kadar %8 ek kapasite mümkün.", tone: "amber" },
    { title: "EK-22 malzeme darboğazı", copy: "Tedarik gecikmesi termin riskini artırıyor.", tone: "clay" },
    { title: "3 vardiya modeli iyi", copy: "Karlılık için en dengeli rota görünüyor.", tone: "teal" },
    { title: "Kur farkı etkisi", copy: "Finansal çıktıda koruma ihtiyacı oluştu.", tone: "navy" },
    { title: "Enerji tüketimi optimize", copy: "Gece üretimi maliyeti aşağı çekiyor.", tone: "cyan" },
  ];

  const dashboardModules = [
    { key: "operations", path: "/operations", label: "Operations" },
    { key: "financial-modelling", path: "/financial-modelling", label: "Financial Modelling" },
    { key: "sales-strategy", path: "/sales-strategy", label: "Sales Strategy" },
    { key: "simulation", path: "/simulation", label: "Simulation" },
    { key: "ai-insights", path: "/ai-insights", label: "AI Insights" },
    { key: "reports", path: "/reports", label: "Reports" },
    { key: "settings", path: "/settings", label: "Settings" },
  ];
  const operationsSubmodules = [
    { key: "data-entry", path: "/operations/data-entry", label: "Veri girişi" },
    { key: "active-processes", path: "/operations/active-processes", label: "Mevcut Süreçler" },
    { key: "products", path: "/operations/products", label: "Ürünler" },
    { key: "product-tree", path: "/operations/product-tree", label: "Ürün Ağacı" },
    { key: "machines-equipment", path: "/operations/machines-equipment", label: "Makine & Ekipman" },
    { key: "human-resources", path: "/operations/human-resources", label: "İnsan Kaynağı" },
    { key: "material-definitions", path: "/operations/material-definitions", label: "Malzeme Tanımları" },
  ];

  const activeModule = dashboardModules.find((module) => module.path === path);
  const activeOperationsSubmodule = operationsSubmodules.find((module) => module.path === path);
  const operationSteps = ["Kesim", "Şekillendirme", "Delik Delme", "Kalınlama", "Yüzey İşleme", "Temizlik", "Kontrol", "Paketleme", "Sevkiyat"];
  const financeMetrics = [
    { label: "Net Satışlar", value: "₺28.7M", change: "+11%" },
    { label: "Brüt Kâr", value: "₺9.78M", change: "+8" },
    { label: "Faaliyet Kârı", value: "₺6.42M", change: "+14" },
    { label: "Net Kâr", value: "₺4.23M", change: "+10" },
    { label: "Nakit Pozisyonu", value: "₺12.6M", change: "+16" },
  ];
  const incomeRows = [
    ["Net Satışlar", "₺28.690.000", "₺25.780.000", "+11.3%", "₺27.500.000", "+4.3%"],
    ["Satışların Maliyeti", "-₺18.912.000", "-₺17.216.000", "+9.9%", "-₺18.300.000", "+3.3%"],
    ["Brüt Kâr", "₺9.778.000", "₺8.564.000", "+14.2%", "₺9.200.000", "+6.3%"],
    ["Brüt Kâr Marjı", "34.1", "33.2", "+0.9p", "33.5", "+0.6p"],
    ["Faaliyet Giderleri", "-₺3.358.000", "-₺3.200.000", "+4.9%", "-₺3.100.000", "+8.3%"],
    ["FAVÖK", "₺6.420.000", "₺5.371.000", "+19.5%", "₺6.100.000", "+5.2%"],
    ["Net Kâr", "₺4.230.000", "₺3.810.000", "+11.0%", "₺3.900.000", "+8.5%"],
  ];
  const scenarioCards = [
    { title: "Elektrik Maliyeti +15%", metric: "FAVÖK Etkisi", value: "-₺1.2M", action: "Simüle Et" },
    { title: "3 Vardiya Geçişi", metric: "Net Kâr Etkisi", value: "+₺2.3M", action: "Simüle Et" },
    { title: "Makine EK-22 Yatırımı", metric: "Geri Dönüş", value: "14.7 ay", action: "Simüle Et" },
    { title: "Hammadde Fiyatı +10%", metric: "Marj Etkisi", value: "-₺1.2M", action: "Simüle Et" },
  ];
  const simulationParameters = [
    ["Talep Değişimi", "+15"],
    ["Hammadde Fiyat Değişimi", "+10"],
    ["Enerji Fiyatı Değişimi", "-20"],
    ["İşçilik Maliyeti Değişimi", "+5"],
    ["Verimlilik Değişimi", "+10"],
    ["Çalışma Süresi", "3 vardiya"],
  ];
  const productionLines = [
    ["LINE-1", "72%", "4.120", "+512", "87%", "Düşük"],
    ["LINE-2", "95%", "7.480", "+1.180", "79%", "Orta"],
    ["LINE-3", "81%", "6.890", "+940", "76%", "Yüksek"],
    ["LINE-4", "68%", "3.320", "+420", "63%", "Orta"],
  ];
  const reportStats = [
    ["Toplam Rapor", "32", "+14 bu aya göre"],
    ["Görüntülenen Rapor", "128", "+22 bu aya göre"],
    ["İndirilen Rapor", "45", "+9 bu aya göre"],
    ["Otomatik Raporlar", "12", "+33 bu aya göre"],
    ["Son Rapor", "Finansal Özet Raporu", "21 Mayıs 2024 09:15"],
  ];
  const recentReports = [
    ["Finansal Özet Raporu", "Finansal Raporlar", "21 Mayıs 2024 09:15", "01 May - 31 May 2024", "Ahmet Yılmaz"],
    ["Üretim Performans Raporu", "Üretim Raporları", "21 Mayıs 2024 08:45", "01 May - 31 May 2024", "Sistem Otomatik"],
    ["Kapasite Kullanım Raporu", "Kapasite Raporları", "20 Mayıs 2024 11:30", "01 May - 31 May 2024", "Ahmet Yılmaz"],
    ["Satış Karlılık Analizi", "Satış Raporları", "20 Mayıs 2024 11:00", "01 May - 31 May 2024", "Mehmet Kaya"],
    ["Makine Bakım Raporu", "Bakım Raporları", "20 Mayıs 2024 08:00", "01 May - 31 May 2024", "Sistem Otomatik"],
    ["Nakit Akış Raporu", "Finansal Raporlar", "19 Mayıs 2024 15:20", "01 May - 31 May 2024", "Ahmet Yılmaz"],
  ];
  const financeWindowLabel =
    financeWindow === "custom"
      ? `${financeDateRange.start || "Başlangıç"} - ${financeDateRange.end || "Bitiş"}`
      : {
          today: "Bugün",
          tomorrow: "Yarın",
          week: "Bu hafta",
          month: "Bu ay",
        }[financeWindow];

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
            {dashboardModules.map((module) => (
              <React.Fragment key={module.key}>
                <button
                  type="button"
                  className={activePage === module.key || (module.key === "operations" && activePage.startsWith("operations/")) ? "active" : ""}
                  onClick={() => goTo(module.key === "operations" ? "/operations/data-entry" : module.path, "login")}
                >
                  {module.label}
                </button>
                {module.key === "operations" && (activePage === "operations" || activePage.startsWith("operations/")) && (
                  <div className="dashboard-subnav" aria-label="Operations submodules">
                    {operationsSubmodules.map((submodule) => (
                      <button
                        type="button"
                        className={activePage === `operations/${submodule.key}` ? "active" : ""}
                        onClick={() => goTo(submodule.path, "login")}
                        key={submodule.key}
                      >
                        {submodule.label}
                      </button>
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}
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

          <div className="sidebar-footer">
            <div className="sync-status-card" role="status" aria-label="Data synchronization status">
              <span className="live-dot" />
              <div>
                <strong>Data Sync</strong>
                <small>Live</small>
              </div>
            </div>
            <button type="button" className="link-button dashboard-logout" onClick={handleLogout}>
              {labels.logout}
            </button>
            <ThemeToggle />
          </div>
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
        <section className="command-dashboard" aria-label="Atera command dashboard">
          <div className="command-topbar">
            <div className="command-context">
              <strong>ARKAS METAL</strong>
              <span>Otomotiv Conta Üretimi</span>
            </div>
            <div className="command-live">
              <span className="live-dot" />
              <strong>Sistem Sağlıklı</strong>
            </div>
            <div className="command-user">
              <span>{currentProfile?.username || form.username || "Atera"}</span>
              <small>Admin</small>
            </div>
            <button type="button" className="command-run-button">Simülasyon Çalışıyor</button>
          </div>

          <div className="command-hero">
            <div className="hero-copy">
              <span>Bugünün Operasyon Modeli</span>
              <h1>Fabrikanızın Geleceğini Bugün Modelleyin.</h1>
              <p>Kur, kapasite, malzeme ve üretim kararlarını tek ekranda takip edin.</p>
            </div>
            <div className="blueprint-visual" aria-hidden="true">
              <span className="blueprint-ring ring-one" />
              <span className="blueprint-ring ring-two" />
              <span className="blueprint-ring ring-three" />
              <span className="blueprint-line line-one" />
              <span className="blueprint-line line-two" />
            </div>
          </div>

          <div className="command-stat-grid">
            {dashboardStats.map((stat, index) => (
              <article className={`command-card stat-card stat-card-${index + 1}`} key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.delta} {stat.detail}</small>
                <svg viewBox="0 0 120 42" aria-hidden="true">
                  <path d="M4 34 L22 26 L36 30 L52 18 L70 22 L88 10 L116 6" />
                </svg>
              </article>
            ))}
          </div>

          <div className="command-main-grid">
            <article className="command-card factory-map-card">
              <div className="card-heading">
                <div>
                  <span>Dijital Fabrika Haritası</span>
                  <h2>Üretim sahası</h2>
                </div>
                <button type="button">Tam ekran</button>
              </div>
              <div className="factory-map" aria-label="Mock digital factory map">
                {factoryLines.map((line, index) => (
                  <div className={`factory-node ${line.tone} node-${index + 1}`} key={line.name}>
                    <strong>{line.name}</strong>
                    <span>{line.status}</span>
                  </div>
                ))}
                <div className="factory-building building-a">Kesim</div>
                <div className="factory-building building-b">Pres</div>
                <div className="factory-building building-c">Paketleme</div>
              </div>
              <div className="factory-metrics">
                <span>Toplam Hatlar <strong>42</strong></span>
                <span>Çalışan Makine <strong>38</strong></span>
                <span>Duraklama <strong>3</strong></span>
                <span>Kalite NOK <strong>1</strong></span>
              </div>
            </article>

            <article className="command-card finance-card">
              <div className="card-heading">
                <div>
                  <span>Finansal Etki Paneli</span>
                  <h2>{financeWindowLabel} etkisi</h2>
                </div>
                <div className="finance-date-controls" aria-label="Finansal etki tarih aralığı">
                  <select value={financeWindow} onChange={(event) => setFinanceWindow(event.target.value)}>
                    <option value="today">Bugün</option>
                    <option value="tomorrow">Yarın</option>
                    <option value="week">Bu hafta</option>
                    <option value="month">Bu ay</option>
                    <option value="custom">Özel aralık</option>
                  </select>
                  <input
                    aria-label="Başlangıç tarihi"
                    type="date"
                    value={financeDateRange.start}
                    onChange={(event) => updateFinanceDateRange("start", event.target.value)}
                  />
                  <input
                    aria-label="Bitiş tarihi"
                    type="date"
                    value={financeDateRange.end}
                    onChange={(event) => updateFinanceDateRange("end", event.target.value)}
                  />
                </div>
              </div>
              <div className="finance-kpis">
                <span>Tahmini Ciro <strong>₺28.7M</strong></span>
                <span>Tahmini Maliyet <strong>₺24.5M</strong></span>
                <span>Net Kâr <strong>₺4.2M</strong></span>
              </div>
              <div className="finance-chart" aria-hidden="true">
                <svg viewBox="0 0 420 180">
                  <path className="chart-grid" d="M20 30 H400 M20 75 H400 M20 120 H400 M20 165 H400" />
                  <path className="chart-line" d="M24 154 L58 138 L82 146 L108 112 L136 120 L166 92 L194 104 L226 72 L256 86 L286 54 L316 66 L346 42 L392 48" />
                  <path className="chart-dash" d="M316 66 L346 68 L376 62 L400 70" />
                </svg>
              </div>
              <div className="risk-list">
                <span>Kur etkisi <strong>-₺1.2M</strong></span>
                <span>Tedarik baskısı <strong>+₺0.8M</strong></span>
                <span>Enerji avantajı <strong>+₺2.1M</strong></span>
              </div>
            </article>
          </div>

          <section className="insight-strip" aria-label="AI insights">
            <div className="card-heading">
              <div>
                <span>AI insights</span>
                <h2>Canlı öneriler</h2>
              </div>
              {authorizationAccess.read && (
                <button type="button" onClick={() => goTo("/authorization", "login")}>
                  {labels.authorizationPage}
                </button>
              )}
            </div>
            <div className="insight-grid">
              {dashboardInsights.map((item) => (
                <article className={`insight-card ${item.tone}`} key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.copy}</p>
                  <span>Detayları incele</span>
                </article>
              ))}
            </div>
          </section>
        </section>,
    );
  }

  if (session && (activeModule || activeOperationsSubmodule)) {
    if (path === "/operations") {
      goTo("/operations/data-entry", "login");
      return null;
    }

    if (activeOperationsSubmodule?.key === "data-entry") {
      return renderDashboardLayout(
        `operations/${activeOperationsSubmodule.key}`,
          <section className="operations-workspace operations-modern">
            <div className="operations-header">
              <div>
                <span>Operations / Veri girişi</span>
                <h1>Kaynak Planlama</h1>
              </div>
              <div className="operations-actions">
                <button type="button" onClick={loadOperationsData}>Verileri Yenile</button>
              </div>
            </div>
            {renderOperationPlanner()}
          </section>,
      );
    }

    if (activeOperationsSubmodule?.key === "active-processes") {
      return renderActiveProcessesPage();
    }

    if (activeOperationsSubmodule?.key === "machines-equipment") {
      return renderOperationDataPage({
        columns: [
          { header: "Makine", render: (row) => row.name },
          { header: "Fiyat", render: (row) => formatLira(row.price) },
          { header: "Saatlik Enerji", render: (row) => `${formatNumber(row.hourly_energy_consumption_kwh, 2)} kWh` },
        ],
        description: "Sadece üretimde seçilecek makinenin adını, fiyatını ve saatlik enerji tüketimini tutun.",
        entity: "machine",
        fields: [
          { name: "name", label: "Makine adı" },
          { name: "price", label: "Makine fiyatı", step: "0.01", type: "number" },
          { name: "hourlyEnergyConsumptionKwh", label: "Saatlik enerji tüketimi", step: "0.01", type: "number" },
        ],
        rows: operationsWorkspace.machines,
        title: "Makine & Ekipman",
      });
    }

    if (activeOperationsSubmodule?.key === "products") {
      return renderProductDataPage();
    }

    if (activeOperationsSubmodule?.key === "human-resources") {
      return renderOperationDataPage({
        columns: [
          { header: "Rol", render: (row) => row.role_name },
          { header: "Saatlik Maliyet", render: (row) => formatLira(row.hourly_cost) },
        ],
        description: "Üretim planında seçilecek rolü ve o rolün saatlik maliyetini tutun.",
        entity: "workforce",
        fields: [
          { name: "roleName", label: "Rol" },
          { name: "hourlyCost", label: "Saatlik maliyet", type: "number" },
        ],
        rows: operationsWorkspace.workforce,
        title: "İnsan Kaynağı",
      });
    }

    if (activeOperationsSubmodule?.key === "material-definitions") {
      return renderOperationDataPage({
        columns: [
          { header: "Malzeme", render: (row) => row.name },
          { header: "Birim", render: (row) => row.unit },
          { header: "Birim Fiyat", render: (row) => formatLira(row.price_per_unit, 2) },
        ],
        description: "Günlük üretim maliyetine girecek malzemenin adını, birimini ve birim fiyatını tutun.",
        entity: "material",
        fields: [
          { name: "name", label: "Malzeme adı" },
          { name: "unit", label: "Birim", type: "select", options: ["kg", "gr", "mg", "adet", "metre", "litre", "ml"] },
          { name: "pricePerUnit", label: "Birim fiyat", step: "0.01", type: "number" },
        ],
        rows: operationsWorkspace.materials,
        title: "Malzeme Tanımları",
      });
    }

    if (activeOperationsSubmodule?.key === "product-tree") {
      return renderDashboardLayout(
        `operations/${activeOperationsSubmodule.key}`,
          <section className="operations-workspace">
            <div className="operations-header">
              <div>
                <span>Ürün Ağacı / Ürün Detayı</span>
                <h1>{operationsWorkspace.product?.name || "Operasyonel Tanımlama"}</h1>
              </div>
              <div className="operations-actions">
                <button type="button">Geri</button>
                <button type="button">Kopyala</button>
                <button type="button">Revizyon Geçmişi</button>
                <button type="button" className="primary">Düzenle</button>
              </div>
            </div>

            <div className="operations-tabs" role="tablist" aria-label="Operasyon detay sekmeleri">
              {["Genel Bilgiler", "Teknik Özellikler", "Malzeme & Bileşenler", "Operasyon Sırası", "Süreç Akışı", "Kalite", "Dokümanlar", "Notlar"].map((tab, index) => (
                <button type="button" className={index === 0 ? "active" : ""} key={tab}>{tab}</button>
              ))}
            </div>

            <div className="operations-grid">
              <article className="operation-card part-visual-card">
                <div className="part-blueprint" aria-label="Conta teknik görseli">
                  <div className="gasket-shape">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="part-status-row">
                  <span>Ağırlık <strong>{operationsWorkspace.product?.weight_kg || "-"}kg</strong></span>
                  <span>Boyut <strong>{operationsWorkspace.product?.dimensions || "-"}</strong></span>
                  <span>Malzeme <strong>{operationsWorkspace.product?.material_name || "-"}</strong></span>
                  <span>Kalite <strong>{operationsWorkspace.product?.quality_grade || "-"}</strong></span>
                  <span>Çevrim <strong>{operationsWorkspace.product?.cycle_time_seconds || "-"} sn</strong></span>
                </div>
              </article>

              <article className="operation-card part-info-card">
                <div className="part-title">
                  <span>{operationsWorkspace.product?.status || "Aktif"}</span>
                  <h2>{operationsWorkspace.product?.product_code || "CONTA-0478-A"}</h2>
                </div>
                <dl>
                  <div><dt>Ürün Kodu</dt><dd>{operationsWorkspace.product?.product_code || "-"}</dd></div>
                  <div><dt>Ürün Adı</dt><dd>{operationsWorkspace.product?.name || "-"}</dd></div>
                  <div><dt>Ürün Grubu</dt><dd>{operationsWorkspace.product?.product_group || "-"}</dd></div>
                  <div><dt>Revizyon</dt><dd>{operationsWorkspace.product?.revision || "-"}</dd></div>
                  <div><dt>Durum</dt><dd>{operationsWorkspace.product?.status || "-"}</dd></div>
                  <div><dt>Oluşturma Tarihi</dt><dd>{operationsWorkspace.product?.created_at ? new Date(operationsWorkspace.product.created_at).toLocaleDateString("tr-TR") : "-"}</dd></div>
                  <div><dt>Son Güncelleme</dt><dd>{operationsWorkspace.product?.updated_at ? new Date(operationsWorkspace.product.updated_at).toLocaleString("tr-TR") : "-"}</dd></div>
                  <div><dt>Açıklama</dt><dd>{operationsWorkspace.product?.description || "-"}</dd></div>
                </dl>
              </article>

              <article className="operation-card machine-card">
                <div className="operation-card-heading">
                  <h2>Makine Havuzu</h2>
                  <span>Makine havuzu</span>
                </div>
                <div className="machine-table">
                  <div className="machine-row machine-head"><span>Makine</span><span>Fiyat</span><span>Enerji</span><span>Durum</span></div>
                  {operationsWorkspace.machines.map((machine) => (
                    <div className="machine-row" key={machine.id}>
                      <strong>{machine.name}</strong>
                      <span>{formatLira(machine.price)}</span>
                      <span>{formatNumber(machine.hourly_energy_consumption_kwh, 2)} kWh/saat</span>
                      <mark className="ok">Tanımlı</mark>
                    </div>
                  ))}
                </div>
              </article>

              <article className="operation-card technical-card">
                <h2>Teknik Özellikler</h2>
                <div className="technical-grid">
                  {[
                    ["Kalınlık", "1.20 mm"],
                    ["Çap Delik", "82.00 mm"],
                    ["Delik Sayısı", "4"],
                    ["Sıkıştırılma", "0.35 mm"],
                    ["Çelik Sınıfı", "316"],
                    ["Çalışma Sıcaklığı", "-40 / +300°C"],
                    ["Maks. Basınç", "120 bar"],
                    ["Yüzey Kaplama", "Kaplamasız"],
                    ["Test Basıncı", "90 bar"],
                    ["Yüzey Kalitesi", "Kaplamasız"],
                  ].map(([label, value]) => (
                    <div key={label}><span>{label}</span><strong>{value}</strong></div>
                  ))}
                </div>
              </article>

              <article className="operation-card finance-impact-card">
                <div className="operation-card-heading">
                  <h2>Finansal Etki</h2>
                  <select defaultValue="mayıs">
                    <option value="mayıs">Mayıs 2024</option>
                    <option value="haziran">Haziran 2024</option>
                    <option value="ceyrek">Bu çeyrek</option>
                  </select>
                </div>
                <div className="impact-kpis">
                  <span>Birim Satış Fiyatı <strong>₺45,00</strong></span>
                  <span>Günlük Maliyet <strong>{operationPlanResult ? formatLira(operationPlanResult.totalTrackedDailyCost) : "-"}</strong></span>
                  <span>Birim Kâr <strong>₺17,65</strong></span>
                  <span>Kâr Marjı <strong>39.2%</strong></span>
                </div>
                <div className="impact-body">
                  <div className="donut-chart" aria-hidden="true"><span>{operationPlanResult ? formatLira(operationPlanResult.totalTrackedDailyCost) : "-"}</span></div>
                  <div className="monthly-impact">
                    <span>Ürün <strong>{operationPlanResult?.productName || "-"}</strong></span>
                    <span>Tahmini Ciro <strong>₺1.10M</strong></span>
                    <span>Tahmini Maliyet <strong>{operationPlanResult ? formatLira(operationPlanResult.totalTrackedDailyCost) : "-"}</strong></span>
                    <span>Net Kâr Marjı <strong>39.2%</strong></span>
                  </div>
                </div>
              </article>

              <article className="operation-card notes-card">
                <div className="operation-card-heading">
                  <h2>Notlar</h2>
                  <button type="button">Yeni Not</button>
                </div>
                {(operationsWorkspace.notes.length ? operationsWorkspace.notes : [{ id: "empty", note: "Henüz ürün notu yok.", created_at: new Date().toISOString() }]).map((note) => (
                  <p key={note.id}>{new Date(note.created_at).toLocaleDateString("tr-TR")}: {note.note}</p>
                ))}
              </article>
            </div>

            <article className="operation-card operation-flow">
              <div className="operation-card-heading">
                <h2>Operasyon Akışı</h2>
                <button type="button">Akış Diyagramını Gör</button>
              </div>
              <div className="flow-steps">
                {operationSteps.map((name, index) => ({ id: name, step_order: index + 1, name, station: index % 2 === 0 ? "Lazer Kesim" : "Proses" })).map((step) => (
                  <div className="flow-step" key={step.id}>
                    <span>{step.step_order}</span>
                    <strong>{step.name}</strong>
                    <small>{step.station}</small>
                  </div>
                ))}
              </div>
            </article>
          </section>,
      );
    }

    if (activeOperationsSubmodule) {
      return renderDashboardLayout(
        `operations/${activeOperationsSubmodule.key}`,
          <section className="module-placeholder">
            <div>
              <span>Operations placeholder</span>
              <h1>{activeOperationsSubmodule.label}</h1>
              <p>Bu alt sayfa Operations modülü altında hazırlandı. İçerik ve iş mantığı daha sonra eklenecek.</p>
            </div>
            <div className="placeholder-grid">
              <article>
                <strong>Alt Modül</strong>
                <p>{activeOperationsSubmodule.label} için ekran yapısı burada geliştirilecek.</p>
              </article>
              <article>
                <strong>Durum</strong>
                <p>Şimdilik sadece frontend routing ve boş durum ekranı mevcut.</p>
              </article>
            </div>
          </section>,
      );
    }

    if (activeModule.key === "financial-modelling") {
      return renderFinancialModellingPage();
    }

    if (activeModule.key === "simulation") {
      return renderDashboardLayout(
        activeModule.key,
          <section className="simulation-workspace">
            <div className="simulation-header">
              <div>
                <span>ARKAS METAL / Otomotiv Conta Üretimi</span>
                <h1>Simülasyon & Senaryo Analizi</h1>
                <p>Karar vermeden önce sonucu görün.</p>
              </div>
              <button type="button" className="primary">Simülasyonu Çalıştır</button>
            </div>

            <div className="scenario-management">
              <article className="scenario-choice active"><span>İyi Senaryo</span><strong>85/100</strong><p>Talep artışı, verimlilik iyileşmesi ve enerji optimizasyonu.</p></article>
              <article className="scenario-choice"><span>Orta Senaryo</span><strong>60/100</strong><p>Mevcut koşullarda üretim hedefi.</p></article>
              <article className="scenario-choice warning"><span>Kötü Senaryo</span><strong>30/100</strong><p>Maliyet artışı, talep düşüşü ve verim kaybı.</p></article>
              <button type="button" className="new-scenario">+ Yeni Senaryo</button>
            </div>

            <div className="simulation-tabs" role="tablist" aria-label="Simülasyon sekmeleri">
              {["Senaryo Kurulumu", "Üretim Etkisi", "Finansal Etki", "Karşılaştırma", "Duyarlılık Analizi"].map((tab, index) => (
                <button type="button" className={index === 0 ? "active" : ""} key={tab}>{tab}</button>
              ))}
            </div>

            <div className="simulation-grid">
              <aside className="simulation-card parameter-card">
                <h2>Senaryo Parametreleri</h2>
                <p>Aşağıdaki parametreleri değiştirerek senaryo etkisini görün.</p>
                {simulationParameters.map(([label, value], index) => (
                  <label className="sim-slider" key={label}>
                    <span>{label}<strong>{value}{index < 5 ? "%" : ""}</strong></span>
                    <input type="range" min="-30" max="30" defaultValue={index === 5 ? 10 : Number.parseInt(value, 10) || 0} />
                  </label>
                ))}
                <div className="scenario-version">
                  <span>Senaryo</span>
                  <select defaultValue="best"><option value="best">İyi Senaryo</option><option value="base">Orta Senaryo</option><option value="bad">Kötü Senaryo</option></select>
                </div>
                <button type="button" className="wide-action">Senaryoyu Güncelle</button>
              </aside>

              <main className="simulation-main">
                <article className="simulation-card production-impact">
                  <div className="simulation-card-heading">
                    <div><span>Üretim Etkisi</span><h2>Senaryonun üretim performansına etkisi</h2></div>
                  </div>
                  <div className="impact-summary">
                    <span>Toplam Üretim <strong>27.850 adet</strong><small>+15.2%</small></span>
                    <span>Kapasite Kullanımı <strong>86%</strong><small>+8.1%</small></span>
                    <span>Ortalama OEE <strong>78.3%</strong><small>+10.1%</small></span>
                    <span>Çevrim Süresi <strong>45.2 sn</strong><small>-8.4%</small></span>
                  </div>
                  <div className="line-impact-table">
                    <div className="line-impact-row line-impact-head"><span>Hat</span><span>Kapasite</span><span>Üretim</span><span>OEE</span><span>Darboğaz Riski</span></div>
                    {productionLines.map((line) => (
                      <div className="line-impact-row" key={line[0]}>
                        <strong>{line[0]}</strong>
                        <span><i style={{ width: line[1] }} />{line[1]}</span>
                        <span>{line[2]} <em>{line[3]}</em></span>
                        <span>{line[4]}</span>
                        <mark>{line[5]}</mark>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="simulation-card flow-impact-card">
                  <h2>Üretim Akışı Simülasyonu</h2>
                  <div className="flow-impact-grid">
                    {["Hammadde", "Kesim", "Şekillendirme", "Kaplama", "Kontrol", "Paketleme"].map((step, index) => (
                      <div className={index === 3 ? "flow-impact-item risk" : "flow-impact-item"} key={step}>
                        <strong>{step}</strong>
                        <span>{[18500, 27300, 24000, 22950, 27050, 26030][index]} adet</span>
                      </div>
                    ))}
                  </div>
                </article>
              </main>

              <aside className="simulation-side">
                <article className="simulation-card sim-financial">
                  <div className="simulation-card-heading">
                    <h2>Finansal Etki (Özet)</h2>
                    <select defaultValue="try"><option value="try">TRY</option><option value="usd">USD</option></select>
                  </div>
                  <div className="sim-financial-table">
                    {["Net Satışlar", "Brüt Kâr", "FAVÖK", "Net Kâr", "Nakit Akışı", "Net Kâr Marjı"].map((item, index) => (
                      <div key={item}><span>{item}</span><strong>{["₺32.1M", "₺11.7M", "₺7.8M", "₺5.6M", "₺8.8M", "18.4%"][index]}</strong><em>{index % 2 === 0 ? "+12.5%" : "+9.4%"}</em></div>
                    ))}
                  </div>
                  <svg className="sim-chart" viewBox="0 0 420 180" aria-hidden="true">
                    <path className="chart-grid" d="M20 35 H400 M20 85 H400 M20 135 H400" />
                    <path className="trend-line sales" d="M24 150 L70 134 L116 118 L162 102 L208 86 L254 72 L300 58 L380 40" />
                    <path className="trend-line gross" d="M24 160 L70 148 L116 136 L162 126 L208 114 L254 104 L300 94 L380 80" />
                    <path className="trend-line net" d="M24 168 L70 158 L116 150 L162 142 L208 134 L254 128 L300 120 L380 112" />
                  </svg>
                </article>

                <article className="simulation-card compare-card">
                  <div className="simulation-card-heading"><h2>Senaryo Karşılaştırma</h2><button type="button">Kritik Ağrılar</button></div>
                  <div className="compare-table">
                    <div><span>Toplam Skor</span><strong>100%</strong><b>85</b><b>60</b><b>30</b></div>
                    <div><span>Nakit Akışı</span><strong>20%</strong><b>80</b><b>58</b><b>22</b></div>
                    <div><span>Operasyonel Risk</span><strong>15%</strong><b>88</b><b>60</b><b>23</b></div>
                    <div><span>Yatırım İhtiyacı</span><strong>10%</strong><b>90</b><b>58</b><b>20</b></div>
                  </div>
                </article>
              </aside>
            </div>

            <div className="simulation-bottom">
              <article className="simulation-card"><h2>AI Önerisi</h2><p>İyi senaryo 3. haftada darboğaz riski nedeniyle yatırım gerektirebilir. EK-22 hattı için kapasite kontrolü önerilir.</p><button type="button">Detaylı Analiz</button></article>
              <article className="simulation-card"><h2>Kritik Bulgular</h2><p>LINE-3 hattı darboğaz olabilir. Enerji tüketiminde %12 avantaj oluşuyor. 3 vardiya modeli kârlılığı artırıyor.</p></article>
              <article className="simulation-card risk-card"><h2>Risk Uyarıları</h2><p>Hammadde fiyatındaki artış ve kapasite stresi simülasyonda kritik seviyeye yaklaşıyor.</p><button type="button">Tüm Riskleri Gör</button></article>
            </div>
          </section>,
      );
    }

    if (activeModule.key === "reports") {
      return renderDashboardLayout(
        activeModule.key,
          <section className="reports-workspace">
            <div className="reports-header">
              <div>
                <span>ARKAS METAL / Otomotiv Conta Üretimi</span>
                <h1>Raporlar</h1>
                <p>Performansınızı analiz edin, içgörüleri keşfedin ve doğru kararlar alın.</p>
              </div>
            </div>

            <div className="reports-tabs" role="tablist" aria-label="Rapor türleri">
              {["Tüm Raporlar", "Üretim Raporları", "Finansal Raporlar", "Satış Raporları", "Kapasite Raporları", "Bakım Raporları", "Özel Raporlar"].map((tab, index) => (
                <button type="button" className={index === 0 ? "active" : ""} key={tab}>{tab}</button>
              ))}
            </div>

            <div className="reports-controls">
              <label><span>Rapor ara</span><input placeholder="Rapor ara..." /></label>
              <button type="button">Filtreler</button>
              <select defaultValue="may"><option value="may">01 Mayıs 2024 - 31 Mayıs 2024</option><option value="q2">Q2 2024</option></select>
              <button type="button" className="primary">Dışa Aktar</button>
            </div>

            <div className="report-stat-grid">
              {reportStats.map(([label, value, detail]) => (
                <article className="report-stat-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{detail}</small>
                </article>
              ))}
            </div>

            <div className="reports-grid">
              <article className="reports-card distribution-card">
                <h2>Rapor Kategorilerine Göre Dağılım</h2>
                <div className="distribution-body">
                  <div className="donut-chart report-donut" aria-hidden="true"><span>32<small>Toplam</small></span></div>
                  <div className="report-category-list">
                    {["Üretim Raporları", "Finansal Raporlar", "Satış Raporları", "Kapasite Raporları", "Bakım Raporları", "Özel Raporlar"].map((item, index) => (
                      <span key={item}>{item}<strong>{[37, 23, 15, 10, 6, 4][index]}%</strong></span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="reports-card usage-card">
                <div className="reports-card-heading"><h2>Rapor Kullanım Trendi</h2><select defaultValue="daily"><option value="daily">Günlük</option><option value="weekly">Haftalık</option></select></div>
                <svg className="reports-trend" viewBox="0 0 620 230" aria-hidden="true">
                  <path className="chart-grid" d="M30 42 H590 M30 92 H590 M30 142 H590 M30 192 H590" />
                  <path className="trend-line sales" d="M34 166 L72 146 L108 156 L146 126 L184 142 L222 118 L260 132 L298 104 L336 122 L374 92 L412 110 L450 82 L488 102 L526 76 L586 54" />
                  <path className="trend-line gross" d="M34 188 L72 176 L108 168 L146 160 L184 156 L222 148 L260 142 L298 132 L336 126 L374 120 L412 114 L450 106 L488 96 L526 90 L586 72" />
                  <path className="trend-line net" d="M34 204 L72 202 L108 198 L146 196 L184 194 L222 190 L260 192 L298 184 L336 186 L374 178 L412 182 L450 174 L488 176 L526 170 L586 164" />
                </svg>
              </article>

              <article className="reports-card recent-reports-card">
                <div className="reports-card-heading"><h2>Son Raporlar</h2><button type="button">Tümünü Gör</button></div>
                <div className="recent-report-table">
                  <div className="recent-report-row report-head"><span>Rapor Adı</span><span>Kategori</span><span>Oluşturulma Tarihi</span><span>Dönem</span><span>Oluşturan</span><span>İşlemler</span></div>
                  {recentReports.map((report) => (
                    <div className="recent-report-row" key={report[0]}>
                      {report.map((cell, index) => index === 0 ? <strong key={cell}>{cell}</strong> : <span key={`${report[0]}-${index}`}>{cell}</span>)}
                      <span className="report-actions">⌕ ↓ ⋯</span>
                    </div>
                  ))}
                </div>
              </article>

              <aside className="reports-side">
                <article className="reports-card schedule-card">
                  <div className="reports-card-heading"><h2>Otomatik Rapor Takvimi</h2><button type="button">Tümünü Gör</button></div>
                  {["Günlük Üretim Özeti", "Haftalık Finansal Özet", "Aylık Yönetim Raporu", "Aylık Karlılık Analizi"].map((item, index) => (
                    <div className="schedule-row" key={item}>
                      <strong>{item}</strong>
                      <span>{["Her gün 08:00", "Her Pazartesi 09:00", "Her ayın 1. günü 10:00", "Her ayın 5. günü 10:30"][index]}</span>
                      <mark>Aktif</mark>
                    </div>
                  ))}
                </article>

                <article className="reports-card quick-report-card">
                  <h2>Hızlı Rapor Oluştur</h2>
                  <div className="quick-report-grid">
                    {["Üretim Raporu", "Finansal Özet", "Satış Analizi", "Kapasite Analizi", "Özel Rapor"].map((item) => (
                      <button type="button" key={item}>{item}</button>
                    ))}
                  </div>
                </article>
              </aside>
            </div>
          </section>,
      );
    }

    return renderDashboardLayout(
      activeModule.key,
        <section className="module-placeholder">
          <div>
            <span>Module placeholder</span>
            <h1>{activeModule.label}</h1>
            <p>This module is visible in the dashboard navigation and is ready for its frontend workflow.</p>
          </div>
          <div className="placeholder-grid">
            <article>
              <strong>Workspace</strong>
              <p>Empty state for upcoming tools, tables, and decision screens.</p>
            </article>
            <article>
              <strong>Status</strong>
              <p>No backend, database, or algorithm behavior is connected yet.</p>
            </article>
          </div>
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
