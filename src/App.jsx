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

const initialSalesStrategy = {
  company: {
    baseSalesPrice: 45,
    marketShare: 14,
    monthlyTarget: 38000,
    positioning: "Reliable mid-premium supplier for OEM and aftermarket gasket buyers.",
    productName: "CONTA-0478-A",
    reputationScore: 72,
    targetSegment: "OEM + aftermarket",
  },
  channels: [
    {
      budget: 180000,
      conversionRate: 18,
      id: "online",
      name: "Online B2B portal",
      note: "Quote requests, reorder flow, and export leads.",
      price: 48,
      revenueShare: 28,
      successScore: 76,
      type: "Online",
    },
    {
      budget: 240000,
      conversionRate: 24,
      id: "distributor",
      name: "Distributor network",
      note: "Regional industrial parts distributors.",
      price: 44,
      revenueShare: 44,
      successScore: 82,
      type: "Retail / Distributor",
    },
    {
      budget: 120000,
      conversionRate: 31,
      id: "direct",
      name: "Direct enterprise sales",
      note: "Large recurring accounts and negotiated annual agreements.",
      price: 52,
      revenueShare: 28,
      successScore: 69,
      type: "Direct B2B",
    },
  ],
  campaigns: [
    {
      budget: 320000,
      channel: "Online B2B portal",
      durationWeeks: 8,
      goal: "Generate qualified export quote requests.",
      id: "digital-launch",
      name: "Digital launch sprint",
      successScore: 74,
      type: "Performance marketing",
    },
    {
      budget: 260000,
      channel: "Distributor network",
      durationWeeks: 12,
      goal: "Increase shelf presence and distributor recommendation rate.",
      id: "distributor-push",
      name: "Distributor push",
      successScore: 81,
      type: "Trade promotion",
    },
    {
      budget: 180000,
      channel: "Direct enterprise sales",
      durationWeeks: 6,
      goal: "Win trials with high-volume accounts.",
      id: "sample-program",
      name: "Sample and demo program",
      successScore: 67,
      type: "Field campaign",
    },
  ],
  competitors: [
    {
      campaignType: "Price-led distributor promotion",
      id: "metalfix",
      marketShare: 19,
      marketingBudget: 420000,
      name: "MetalFix",
      reputationScore: 78,
      salesPrice: 43,
      strategy: "Discounts through distributors and fast quote response.",
      threatScore: 82,
    },
    {
      campaignType: "Digital ads + technical content",
      id: "sealpro",
      marketShare: 11,
      marketingBudget: 290000,
      name: "SealPro",
      reputationScore: 70,
      salesPrice: 49,
      strategy: "Premium positioning with engineering proof points.",
      threatScore: 66,
    },
    {
      campaignType: "Retail visibility campaign",
      id: "gasketline",
      marketShare: 8,
      marketingBudget: 160000,
      name: "GasketLine",
      reputationScore: 61,
      salesPrice: 39,
      strategy: "Low-price retail availability.",
      threatScore: 58,
    },
  ],
  personnel: [
    {
      assignedChannel: "Distributor network",
      id: "aylin",
      monthlyTarget: 420,
      name: "Aylin Demir",
      pipelineValue: 1250000,
      role: "Channel Manager",
      successScore: 84,
      winRate: 34,
    },
    {
      assignedChannel: "Direct enterprise sales",
      id: "mert",
      monthlyTarget: 260,
      name: "Mert Kaya",
      pipelineValue: 980000,
      role: "Key Account Lead",
      successScore: 73,
      winRate: 29,
    },
    {
      assignedChannel: "Online B2B portal",
      id: "selin",
      monthlyTarget: 340,
      name: "Selin Arslan",
      pipelineValue: 740000,
      role: "Inside Sales",
      successScore: 78,
      winRate: 26,
    },
  ],
};

const initialSimulationVariants = [
  {
    id: "current-situation",
    label: "Current Situation",
    name: "Current Situation",
    path: "/simulation/current-situation",
    parameters: {
      baseRevenue: 28690000,
      campaignLift: 9,
      competitorPressure: 6,
      costVolatility: 11,
      demandChange: 8,
      fixedCost: 7200000,
      grossMargin: 34,
      marketingBudget: 760000,
      marketShare: 14,
      priceChange: 3,
      productionEfficiency: 7,
      reputationScore: 72,
      simulationCount: 10000,
      timeHorizonMonths: 12,
      variableCostRatio: 62,
      volatility: 18,
    },
  },
];

function formatNumber(value, maximumFractionDigits = 0) {
  const locale = (localStorage.getItem("atera_language") || "en") === "tr" ? "tr-TR" : "en-US";
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value || 0);
}

function formatLira(value, maximumFractionDigits = 0) {
  const locale = (localStorage.getItem("atera_language") || "en") === "tr" ? "tr-TR" : "en-US";
  return new Intl.NumberFormat(locale, {
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
    showPassword: "Show password",
    hidePassword: "Hide password",
    show: "Show",
    hide: "Hide",
    light: "Light",
    dark: "Dark",
    dataSync: "Data Sync",
    live: "Live",
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
    authorizationPage: "Authorization Page",
    authorizationCopy: "Authorization tools and user access controls live here.",
    authorizationLocked: "Authorization is locked for your current role.",
    authorizationLockedCopy: "Your company role does not have read or write permission for this module yet.",
    roleDefinition: "Role definition",
    userDefinition: "User definition",
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
    signupSuccess: "Account created. Check email confirmation if your Supabase project requires it.",
    passwordUpdated: "Password updated. You can log in now.",
    usernameNotFound: "Username was not found.",
    missingUser: "Supabase did not return a user.",
  },
  tr: {
    language: "Dil",
    themeLight: "Aydınlık mod",
    themeDark: "Karanlık mod",
    showPassword: "Şifreyi göster",
    hidePassword: "Şifreyi gizle",
    show: "Göster",
    hide: "Gizle",
    light: "Aydınlık",
    dark: "Karanlık",
    dataSync: "Veri Senkronu",
    live: "Canlı",
    login: "Giriş yap",
    signup: "Kullanıcı oluştur",
    createUserLink: "Yeni kullanıcı oluştur",
    backToLogin: "Girişe dön",
    who: "Biz kimiz?",
    solutions: "Çözümlerimiz",
    references: "Referanslarımız",
    contact: "İletişim",
    heroTitle: "Atera",
    heroCopy: "Tailor-made üretim planlamasının arkasındaki operasyon mantığı.",
    goToLogin: "Girişe git",
    whoCopy: "Planla. Dene. Karar ver. Büyüt. Atera; üretim, finans ve operasyon ekiplerini fizibilite, maliyet, stok ve termin senaryolarını dağınık varsayımlardan net kararlara taşıyan pratik bir hub'da buluşturur.",
    solutionsCopy: "Senaryo planlama, üretim görünürlüğü, malzeme takibi, maliyet analizi ve iş akışı araçları atera_v2'den parça parça buraya taşınacak.",
    farmerPersona: "Planlama ekibi",
    factoryOwnerPersona: "Üretim sorumlusu",
    entrepreneurPersona: "Finans ekibi",
    exporterPersona: "Operasyon sahibi",
    farmerNeed: "İhtiyaç: Yeni bir siparişe söz vermeden önce üretim fizibilitesini görmek.",
    farmerBenefit: "Fayda: Malzeme, işçilik ve termin senaryolarını tek sakin alanda karşılaştırmak.",
    farmerDifference: "Atera'nın farkı: Kurumsal yazılım ağırlığı olmadan tailor-made planlama.",
    factoryOwnerNeed: "İhtiyaç: Hangi üretim yolunun marjı ve teslimatı koruduğunu anlamak.",
    factoryOwnerBenefit: "Fayda: Maliyet ve stok görünürlüğüyle daha hızlı karar almak.",
    factoryOwnerDifference: "Atera'nın farkı: Ekibinizin gerçek çalışma şekline göre şekillenmesi.",
    entrepreneurNeed: "İhtiyaç: Dağılan Excel'leri ortak bir operasyon görünümüne çevirmek.",
    entrepreneurBenefit: "Fayda: Kararları, varsayımları ve fizibilite notlarını birlikte tutmak.",
    entrepreneurDifference: "Atera'nın farkı: Adım adım büyüyebilen pratik ve bütçe dostu yapı.",
    exporterNeed: "İhtiyaç: Teklif vermeden önce fiyat, kur, stok ve sevkiyat sözünü kontrol etmek.",
    exporterBenefit: "Fayda: Satış, üretim ve teslimat arasındaki sürprizleri azaltmak.",
    exporterDifference: "Atera'nın farkı: Gerçek hayattaki trade-off'lar için samimi planlama araçları.",
    referencesCopy: "Ürün büyüdükçe referans hikayeleri ve müşteri örnekleri burada yer alacak.",
    contactCopy: "Erişim, onboarding ve proje soruları için bize ulaşabilirsiniz.",
    contactPhone: "+90 212 000 00 00",
    contactEmail: "hello@atera.app",
    contactLocation: "Istanbul, Turkiye",
    username: "Kullanıcı adı",
    password: "Şifre",
    email: "Mail adresi",
    phoneNumber: "Telefon numarası",
    company: "Şirket",
    department: "Departman",
    accessLevel: "Yetki seviyesi",
    profilePicture: "Profil fotoğrafı",
    saveLogin: "Giriş bilgisini bu cihazda sakla",
    forgot: "Şifremi unuttum",
    resetPassword: "Yeni şifre belirle",
    confirmPassword: "Şifreyi onayla",
    submitLogin: "Giriş yap",
    submitSignup: "Hesap oluştur",
    logout: "Çıkış yap",
    signedIn: "Giriş yapıldı",
    dashboard: "Dashboard",
    dashboardCopy: "Bu alan planlama, fizibilite ve operasyon araçları için ana çalışma alanına dönüşecek.",
    authorizationPage: "Yetkilendirme Sayfası",
    authorizationCopy: "Yetkilendirme araçları ve kullanıcı erişim kontrolleri burada yer alır.",
    authorizationLocked: "Yetkilendirme mevcut yetkiniz için kilitli.",
    authorizationLockedCopy: "Şirketinizdeki yetkinizin bu modül için okuma veya yazma izni yok.",
    roleDefinition: "Yetki tanımlama",
    userDefinition: "Kullanıcı tanımlama",
    userDefinitionCopy: "Şirket kullanıcıları oluşturun ve profil kayıtlarını Supabase'e kaydedin.",
    managedUsers: "Tanımlı kullanıcılar",
    createManagedUser: "Kullanıcı oluştur",
    userCreated: "Kullanıcı oluşturuldu ve profiles tablosuna kaydedildi.",
    newRole: "Yeni yetki",
    roleName: "Yetki adı",
    roleDescription: "Yetki açıklaması",
    createRole: "Yetki yarat",
    permissions: "İzinler",
    module: "Modül",
    readPermission: "Okuma",
    writePermission: "Yazma",
    readOnlyMode: "Sadece okuma",
    writeAccess: "Yazma erişimi",
    noCompany: "Profiliniz henüz bir şirkete bağlı değil.",
    loadAuthorizationError: "Yetkilendirme verisi yüklenemedi.",
    backToDashboard: "Dashboard'a dön",
    configure: ".env dosyasına Supabase URL ve anon key ekleyip npm run dev'i yeniden başlat.",
    resetSent: "Şifre sıfırlama e-postası gönderildi.",
    needEmail: "Önce mail adresini gir.",
    forgotEmailPrompt: "Şifre sıfırlama için mail adresini gir.",
    passwordMismatch: "Şifreler eşleşmiyor.",
    passwordTooShort: "Şifre en az 6 karakter olmalı.",
    signupSuccess: "Hesap oluşturuldu. Supabase projeniz gerektiriyorsa e-posta onayını kontrol edin.",
    passwordUpdated: "Şifre güncellendi. Artık giriş yapabilirsiniz.",
    usernameNotFound: "Kullanıcı adı bulunamadı.",
    missingUser: "Supabase kullanıcı bilgisi döndürmedi.",
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
  const [semiFinishedForm, setSemiFinishedForm] = useState({
    componentRows: [],
    name: "",
    pricePerUnit: 0,
    unit: "adet",
  });
  const [semiFinishedItems, setSemiFinishedItems] = useState([]);
  const [serviceForm, setServiceForm] = useState({
    initialCost: 0,
    monthlyCost: 0,
    name: "",
    price: 0,
  });
  const [serviceItems, setServiceItems] = useState([]);
  const [salesStrategy, setSalesStrategy] = useState(initialSalesStrategy);
  const [simulationVariants, setSimulationVariants] = useState(initialSimulationVariants);
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
  const copy = (en, tr) => (form.language === "tr" ? tr : en);
  const locale = form.language === "tr" ? "tr-TR" : "en-US";

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
    document.documentElement.lang = form.language;
    localStorage.setItem("atera_language", form.language);
  }, [form.language]);

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
    if (field === "language") {
      localStorage.setItem("atera_language", value);
      if (supabase && session?.user?.id) {
        supabase.from("profiles").update({ language: value }).eq("id", session.user.id).then(({ error }) => {
          if (error) console.warn("Language preference could not be saved.", error);
        });
      }
    }
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateSalesCompany(field, value) {
    setSalesStrategy((current) => ({
      ...current,
      company: { ...current.company, [field]: value },
    }));
  }

  function updateSalesItem(collection, id, field, value) {
    setSalesStrategy((current) => ({
      ...current,
      [collection]: current[collection].map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  }

  function addSalesItem(collection) {
    const nextId = `${collection}-${Date.now()}`;
    const templates = {
      campaigns: {
        budget: 0,
        channel: copy("New channel", "Yeni kanal"),
        durationWeeks: 4,
        goal: copy("Campaign objective", "Kampanya hedefi"),
        id: nextId,
        name: copy("New campaign", "Yeni kampanya"),
        successScore: 50,
        type: copy("Campaign type", "Kampanya tipi"),
      },
      channels: {
        budget: 0,
        conversionRate: 0,
        id: nextId,
        name: copy("New channel", "Yeni kanal"),
        note: copy("Channel notes", "Kanal notları"),
        price: salesStrategy.company.baseSalesPrice,
        revenueShare: 0,
        successScore: 50,
        type: copy("Channel type", "Kanal tipi"),
      },
      competitors: {
        campaignType: copy("Manual campaign input", "Manuel kampanya girdisi"),
        id: nextId,
        marketShare: 0,
        marketingBudget: 0,
        name: copy("New competitor", "Yeni rakip"),
        reputationScore: 50,
        salesPrice: 0,
        strategy: copy("Competitor strategy notes", "Rakip strateji notları"),
        threatScore: 50,
      },
      personnel: {
        assignedChannel: copy("Assigned channel", "Atanan kanal"),
        id: nextId,
        monthlyTarget: 0,
        name: copy("New sales person", "Yeni satış personeli"),
        pipelineValue: 0,
        role: copy("Sales role", "Satış rolü"),
        successScore: 50,
        winRate: 0,
      },
    };

    setSalesStrategy((current) => ({
      ...current,
      [collection]: [...current[collection], templates[collection]],
    }));
  }

  function updateSimulationVariant(id, field, value) {
    setSimulationVariants((current) => current.map((variant) => {
      if (variant.id !== id) return variant;
      const nextVariant = { ...variant, [field]: value };
      if (field === "name") {
        nextVariant.label = value || variant.label;
      }
      return nextVariant;
    }));
  }

  function updateSimulationParameter(id, field, value) {
    setSimulationVariants((current) => current.map((variant) => (
      variant.id === id
        ? { ...variant, parameters: { ...variant.parameters, [field]: value } }
        : variant
    )));
  }

  function addSimulationVariant() {
    const baseVariant = simulationVariants.find((variant) => variant.path === path) || simulationVariants[0];
    const nextIndex = simulationVariants.length + 1;
    const nextId = `variant-${nextIndex}`;
    const nextVariant = {
      ...baseVariant,
      id: nextId,
      label: copy("Variant", "Varyant") + ` ${nextIndex}`,
      name: copy("Variant", "Varyant") + ` ${nextIndex}`,
      path: `/simulation/${nextId}`,
      parameters: { ...baseVariant.parameters },
    };

    setSimulationVariants((current) => [...current, nextVariant]);
    goTo(nextVariant.path, "login");
  }

  function deleteSimulationVariant(id) {
    if (id === "current-situation") return;

    setSimulationVariants((current) => current.filter((variant) => variant.id !== id));
    if (path === `/simulation/${id}`) {
      goTo("/simulation/current-situation", "login");
    }
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
        <span>{isDark ? labels.light : labels.dark}</span>
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
      setOperationsStatus(`${copy("Operations data could not be loaded:", "Operations verisi yüklenemedi:")} ${error.message}`);
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
      setOperationsStatus(copy(
        "Resource plan was saved to Supabase and calculated by the backend function.",
        "Kaynak planı Supabase veritabanına kaydedildi ve backend fonksiyonunda hesaplandı.",
      ));
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
      setOperationsStatus(copy("Operations record was saved to Supabase.", "Operations kaydı Supabase veritabanına kaydedildi."));
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
      setFinancialStatus(`${copy("Financial model could not be loaded:", "Finansal model yüklenemedi:")} ${error.message}`);
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
      setFinancialStatus(copy("Electricity unit price was saved to Supabase.", "Elektrik birim fiyatı Supabase'e kaydedildi."));
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
      setFinancialStatus(copy("Extra financial cost was saved to Supabase.", "Ek finansal gider Supabase'e kaydedildi."));
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
        .select("id, username, email, phone_number, company_id, department, access_level, language, profile_picture_url, company:companies(name)")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentProfile(profile);
      if (profile?.profile_picture_url) setProfilePreview(profile.profile_picture_url);
      if (profile?.language && ["en", "tr"].includes(profile.language)) {
        localStorage.setItem("atera_language", profile.language);
        setForm((current) => ({ ...current, language: profile.language }));
      }

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
      if (!data.user) throw new Error(labels.missingUser);

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
      if (!data.user) throw new Error(labels.missingUser);

      if (data.session) {
        const profilePictureUrl = await uploadProfilePicture(data.user.id);

        const { error: profileError } = await supabase.from("profiles").update({
          profile_picture_url: profilePictureUrl,
        }).eq("id", data.user.id);

        if (profileError) throw profileError;
      }

      setStatus(labels.signupSuccess);
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

      if (profileError || !email) throw new Error(labels.usernameNotFound);

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

    setStatus(labels.passwordUpdated);
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
    const latestProcess = operationsWorkspace.activePlans?.[0] || operationsWorkspace.latestPlan;
    const latestProcessName = latestProcess?.plan_name || latestProcess?.input?.planName || result?.planName || "";
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
      <section className="operation-planner" aria-label={copy("Resource planning calculator", "Kaynak planlama hesaplayıcı")}>
        <form className="operation-card planner-input-card" onSubmit={handleSaveOperationPlan}>
          <div className="operation-card-heading">
            <div>
              <span>{copy("Process Definition", "Süreç Tanımlama")}</span>
              <h2>{copy("Simple daily production cost", "Basit günlük üretim maliyeti")}</h2>
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
              {copy("Load Default", "Varsayılanı Yükle")}
            </button>
          </div>
          <div className="planner-fields">
            <label>
              <span>{copy("Plan name", "Plan adı")}</span>
              <div>
                <input
                  type="text"
                  value={operationPlan.planName ?? ""}
                  onChange={(event) => updateOperationPlan("planName", event.target.value)}
                />
              </div>
            </label>
            <label>
              <span>{copy("Product", "Ürün")}</span>
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
                  <option value="">{copy("Select product", "Ürün seç")}</option>
                  {operationsWorkspace.products.map((product) => (
                    <option value={product.id} key={product.id}>{product.name}</option>
                  ))}
                </select>
                <small>{selectedProduct ? `${formatLira(selectedProduct.price, 2)} / ${selectedProduct.unit || copy("pcs", "adet")}` : copy("Select a record from the Products screen", "Ürünler ekranından kayıt seçin")}</small>
              </div>
            </label>
            {[
              ["productName", copy("New product name", "Yeni ürün adı"), "", "text"],
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
                <span>{copy("Machine selection", "Makine seçimi")}</span>
                <p>{copy("Enter which machine will be used and how many hours per day it will run for the product.", "Ürünü üretirken hangi makinenin günde kaç saat kullanılacağını girin.")}</p>
              </div>
              <button type="button" onClick={() => addOperationPlanRow("machineRows", defaultMachineRow)}>
                {copy("Add Machine", "Makine Ekle")}
              </button>
            </div>
            <div className="resource-row-list">
              {machineRows.length ? machineRows.map((row, index) => {
                const selectedMachine = operationsWorkspace.machines.find((machine) => machine.id === row.machineId);

                return (
                  <div className="resource-row-grid machine-plan-row" key={`machine-${index}`}>
                    <label>
                      <span>{copy("Machine", "Makine")}</span>
                      <select value={row.machineId || ""} onChange={(event) => updateOperationPlanRow("machineRows", index, "machineId", event.target.value)}>
                        <option value="">{copy("Select machine", "Makine seç")}</option>
                        {operationsWorkspace.machines.map((machine) => (
                          <option value={machine.id} key={machine.id}>
                            {machine.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{copy("Daily hours", "Günlük saat")}</span>
                      <input
                        min="0"
                        step="0.25"
                        type="number"
                        value={row.dailyHours ?? ""}
                        onChange={(event) => updateOperationPlanRow("machineRows", index, "dailyHours", event.target.value)}
                      />
                    </label>
                    <div className="resource-row-meta">
                      <strong>{selectedMachine ? `${formatNumber(selectedMachine.hourly_energy_consumption_kwh, 2)} ${copy("kWh/hour", "kWh/saat")}` : "-"}</strong>
                      <small>{selectedMachine ? `${copy("Machine price", "Makine fiyatı")} ${formatLira(selectedMachine.price)}` : copy("No record selected", "Kayıt seçilmedi")}</small>
                    </div>
                    <button type="button" className="resource-remove-button" onClick={() => removeOperationPlanRow("machineRows", index)}>
                      {copy("Delete", "Sil")}
                    </button>
                  </div>
                );
              }) : (
                <p className="planner-empty-state">{copy("No machine records yet. Add a real machine from Machines & Equipment first.", "Makine kaydı yok. Önce Makine & Ekipman ekranından gerçek makine ekleyin.")}</p>
              )}
            </div>
          </div>

          <div className="resource-section">
            <div className="resource-section-header">
              <div>
                <span>{copy("Workforce selection", "İşgücü seçimi")}</span>
                <p>{copy("Enter how many people from each role will work and for how many hours per day.", "Hangi rolden kaç kişinin günde kaç saat çalışacağını girin.")}</p>
              </div>
              <button type="button" onClick={() => addOperationPlanRow("workforceRows", defaultWorkforceRow)}>
                {copy("Add Workforce", "İşgücü Ekle")}
              </button>
            </div>
            <div className="resource-row-list">
              {workforceRows.length ? workforceRows.map((row, index) => {
                const selectedWorkforce = operationsWorkspace.workforce.find((workforce) => workforce.id === row.workforceId);

                return (
                  <div className="resource-row-grid workforce-plan-row" key={`workforce-${index}`}>
                    <label>
                      <span>{copy("Role", "Rol")}</span>
                      <select value={row.workforceId || ""} onChange={(event) => updateOperationPlanRow("workforceRows", index, "workforceId", event.target.value)}>
                        <option value="">{copy("Select role", "Rol seç")}</option>
                        {operationsWorkspace.workforce.map((workforce) => (
                          <option value={workforce.id} key={workforce.id}>
                            {workforce.role_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{copy("People", "Kişi")}</span>
                      <input
                        min="0"
                        step="1"
                        type="number"
                        value={row.peopleAssigned ?? ""}
                        onChange={(event) => updateOperationPlanRow("workforceRows", index, "peopleAssigned", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{copy("Daily hours", "Günlük saat")}</span>
                      <input
                        min="0"
                        step="0.25"
                        type="number"
                        value={row.dailyHours ?? ""}
                        onChange={(event) => updateOperationPlanRow("workforceRows", index, "dailyHours", event.target.value)}
                      />
                    </label>
                    <div className="resource-row-meta">
                      <strong>{selectedWorkforce ? `${formatLira(selectedWorkforce.hourly_cost)} / ${copy("hour", "saat")}` : "-"}</strong>
                      <small>{selectedWorkforce ? copy("Hourly cost is read from the Supabase record", "Saatlik maliyet Supabase kaydından okunur") : copy("No record selected", "Kayıt seçilmedi")}</small>
                    </div>
                    <button type="button" className="resource-remove-button" onClick={() => removeOperationPlanRow("workforceRows", index)}>
                      {copy("Delete", "Sil")}
                    </button>
                  </div>
                );
              }) : (
                <p className="planner-empty-state">{copy("No workforce records yet. Add a role from Human Resources first.", "İşgücü kaydı yok. Önce İnsan Kaynağı ekranından rol ekleyin.")}</p>
              )}
            </div>
          </div>

          <div className="resource-section">
            <div className="resource-section-header">
              <div>
                <span>{copy("Product materials", "Ürün malzemeleri")}</span>
                <p>{copy("Material quantities are calculated automatically from the selected product recipe and produced quantity.", "Malzeme miktarları seçilen ürün reçetesinden ve hesaplanan üretim adedinden otomatik hesaplanır.")}</p>
              </div>
            </div>
            <div className="resource-row-list">
              {selectedProductMaterials.length ? selectedProductMaterials.map((row) => (
                  <div className="resource-row-grid material-plan-row" key={row.id || row.material_id}>
                    <div className="resource-row-meta">
                      <strong>{row.material?.name || "-"}</strong>
                      <small>{formatNumber(row.quantity_per_unit, 4)} {row.material?.unit || ""} / {selectedProduct.unit || copy("pcs", "adet")}</small>
                    </div>
                    <div className="resource-row-meta">
                      <strong>{formatLira(row.material?.price_per_unit, 2)}</strong>
                      <small>{copy("Unit price", "Birim fiyat")}</small>
                    </div>
                  </div>
                )) : (
                <p className="planner-empty-state">{copy("This product has no recipe yet. Add required materials on the Products screen first.", "Bu ürün için reçete yok. Önce Ürünler ekranında gerekli malzemeleri ekleyin.")}</p>
              )}
            </div>
          </div>

          <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
            {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save to Supabase and Calculate", "Supabase'e Kaydet ve Hesapla")}
          </button>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </form>

        <article className="operation-card planner-result-card">
          <div className="operation-card-heading">
            <div>
              <span>{latestProcessName || copy("Waiting for backend result", "Backend sonucu bekleniyor")}</span>
              <h2>{copy("Daily cost summary", "Günlük maliyet özeti")}</h2>
            </div>
            <mark className={result ? "ok" : "bad"}>
              {result ? `${formatNumber(result.energyConsumptionKwh, 2)} kWh` : copy("No calculation", "Hesap yok")}
            </mark>
          </div>
          {!result ? (
            <p className="planner-empty-state">
              {copy("When you save the inputs, the calculation will run in the Supabase RPC function and write the result to the operation_resource_plans table.", "Girdileri kaydettiğinizde hesap Supabase RPC fonksiyonunda yapılacak ve sonuç operation_resource_plans tablosuna yazılacak.")}
            </p>
          ) : (
            <>
              <div className="planner-summary-grid">
                <span>{copy("Product", "Ürün")} <strong>{result.productName || "-"}</strong></span>
                <span>{copy("Unit Price", "Birim Fiyat")} <strong>{formatLira(result.productPrice, 2)} / {result.productUnit || copy("pcs", "adet")}</strong></span>
                <span>{copy("Quantity to Produce", "Üretilecek Miktar")} <strong>{formatNumber(result.producedQuantity, 2)} {result.productUnit || copy("pcs", "adet")}</strong></span>
                <span>{copy("Cycle Time", "Çevrim Süresi")} <strong>{formatNumber(result.cycleTimeMinutes, 2)} {copy("min", "dk")}</strong></span>
                <span>{copy("Electricity Consumption", "Elektrik Tüketimi")} <strong>{formatNumber(result.energyConsumptionKwh, 2)} kWh</strong></span>
                <span>{copy("Material Cost", "Malzeme Maliyeti")} <strong>{formatLira(result.materialCost)}</strong></span>
                <span>{copy("Workforce Cost", "İşgücü Maliyeti")} <strong>{formatLira(result.workforceCost)}</strong></span>
              </div>
              <div className="allocation-grid">
                <span>{copy("Machine Hours", "Makine Saati")} <strong>{formatNumber(result.machineHoursUsed, 1)} {copy("hours", "saat")}</strong></span>
                <span>{copy("Workforce Hours", "İşgücü Saati")} <strong>{formatNumber(result.workforceHoursUsed, 1)} {copy("hours", "saat")}</strong></span>
                <span>{copy("Selected Machine Value", "Seçili Makine Değeri")} <strong>{formatLira(result.selectedMachineValue)}</strong></span>
              </div>
              <div className="cost-breakdown">
                <span>{copy("Tracked Daily Cost", "Takip Edilen Günlük Maliyet")} <strong>{formatLira(result.totalTrackedDailyCost)}</strong></span>
                <span>{copy("Saved Product", "Kayıtlı Ürün")} <strong>{result.productName || "-"}</strong></span>
              </div>
              <div className="selected-resource-results">
                <div>
                  <h3>{copy("Machine breakdown", "Makine kırılımı")}</h3>
                  {(result.machineRows || []).map((row) => (
                    <span key={row.machineId}>
                      {row.name} <strong>{formatNumber(row.energyConsumptionKwh, 2)} kWh</strong>
                    </span>
                  ))}
                </div>
                <div>
                  <h3>{copy("Workforce breakdown", "İşgücü kırılımı")}</h3>
                  {(result.workforceRows || []).map((row) => (
                    <span key={row.workforceId}>
                      {row.roleName} <strong>{formatLira(row.cost)}</strong>
                    </span>
                  ))}
                </div>
                <div>
                  <h3>{copy("Material breakdown", "Malzeme kırılımı")}</h3>
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
          {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save to Supabase", "Supabase'e Kaydet")}
        </button>
      </form>
    );
  }

  function updateSemiFinishedForm(field, value) {
    setSemiFinishedForm((current) => ({ ...current, [field]: value }));
  }

  function addSemiFinishedComponentRow() {
    const firstMaterial = operationsWorkspace.materials[0];

    setSemiFinishedForm((current) => ({
      ...current,
      componentRows: [
        ...(current.componentRows || []),
        {
          componentId: firstMaterial?.id || "",
          componentType: "material",
          quantityPerUnit: 0,
        },
      ],
    }));
  }

  function updateSemiFinishedComponentRow(index, field, value) {
    setSemiFinishedForm((current) => ({
      ...current,
      componentRows: (current.componentRows || []).map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: value } : row
      )),
    }));
  }

  function removeSemiFinishedComponentRow(index) {
    setSemiFinishedForm((current) => ({
      ...current,
      componentRows: (current.componentRows || []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function handleSaveSemiFinished(event) {
    event.preventDefault();

    if (!semiFinishedForm.name.trim()) {
      setOperationsStatus(copy("Enter a semi-finished item name first.", "Önce yarı mamül adı girin."));
      return;
    }

    setSemiFinishedItems((current) => [
      ...current,
      {
        ...semiFinishedForm,
        id: `semi-${Date.now()}`,
        componentRows: [...(semiFinishedForm.componentRows || [])],
      },
    ]);
    setSemiFinishedForm({
      componentRows: [],
      name: "",
      pricePerUnit: 0,
      unit: "adet",
    });
    setOperationsStatus(copy("Semi-finished item was added locally.", "Yarı mamül yerel olarak eklendi."));
  }

  function updateServiceForm(field, value) {
    setServiceForm((current) => ({ ...current, [field]: value }));
  }

  function handleSaveService(event) {
    event.preventDefault();

    if (!serviceForm.name.trim()) {
      setOperationsStatus(copy("Enter a service name first.", "Önce hizmet adı girin."));
      return;
    }

    setServiceItems((current) => [
      ...current,
      {
        ...serviceForm,
        id: `service-${Date.now()}`,
      },
    ]);
    setServiceForm({
      initialCost: 0,
      monthlyCost: 0,
      name: "",
      price: 0,
    });
    setOperationsStatus(copy("Service was added locally.", "Hizmet yerel olarak eklendi."));
  }

  function renderResourcesPage() {
    const unitOptions = ["kg", "gr", "mg", "adet", "metre", "litre", "ml"];
    const semiComponentOptions = [
      ...operationsWorkspace.materials.map((material) => ({
        id: material.id,
        label: material.name,
        type: "material",
        unit: material.unit,
      })),
      ...semiFinishedItems.map((item) => ({
        id: item.id,
        label: item.name,
        type: "semi",
        unit: item.unit,
      })),
    ];

    return renderDashboardLayout(
      "operations/resources",
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / {copy("Resources", "Kaynak")}</span>
              <h1>{copy("Resources", "Kaynak")}</h1>
              <p>{copy("Add materials, semi-finished items, and services used by production and costing workflows.", "Üretim ve maliyet akışlarında kullanılan malzeme, yarı mamül ve hizmetleri ekleyin.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="resource-definition-grid">
            <form className="operation-card operation-data-form resource-definition-card" onSubmit={(event) => handleSaveOperationRecord("material", event)}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Add material", "Malzeme ekle")}</span>
                  <h2>{copy("Material", "Malzeme")}</h2>
                </div>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Material name", "Malzeme adı")}</span>
                  <input type="text" value={operationForms.material.name} onChange={(event) => updateOperationForm("material", "name", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Unit", "Birim")}</span>
                  <select value={operationForms.material.unit} onChange={(event) => updateOperationForm("material", "unit", event.target.value)}>
                    {unitOptions.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                  </select>
                </label>
                <label>
                  <span>{copy("Unit price", "Birim fiyat")}</span>
                  <input min="0" step="0.01" type="number" value={operationForms.material.pricePerUnit} onChange={(event) => updateOperationForm("material", "pricePerUnit", event.target.value)} />
                </label>
              </div>
              <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Add Material", "Malzeme Ekle")}
              </button>
            </form>

            <article className="operation-card resource-definition-card resource-list-card">
              <div className="operation-card-heading">
                <h2>{copy("Materials", "Malzemeler")}</h2>
                <span>{operationsWorkspace.materials.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="compact-resource-list">
                {(operationsWorkspace.materials.length ? operationsWorkspace.materials : [{ id: "empty" }]).map((material) => (
                  <span key={material.id}>
                    <strong>{material.id === "empty" ? "-" : material.name}</strong>
                    <small>{material.id === "empty" ? "-" : `${formatLira(material.price_per_unit, 2)} / ${material.unit}`}</small>
                  </span>
                ))}
              </div>
            </article>

            <form className="operation-card operation-data-form resource-definition-card" onSubmit={(event) => handleSaveOperationRecord("workforce", event)}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Add human resource", "İnsan kaynağı ekle")}</span>
                  <h2>{copy("Human Resources", "İnsan Kaynağı")}</h2>
                </div>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Role", "Rol")}</span>
                  <input type="text" value={operationForms.workforce.roleName} onChange={(event) => updateOperationForm("workforce", "roleName", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Hourly cost", "Saatlik maliyet")}</span>
                  <input min="0" step="1" type="number" value={operationForms.workforce.hourlyCost} onChange={(event) => updateOperationForm("workforce", "hourlyCost", event.target.value)} />
                </label>
              </div>
              <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Add Human Resource", "İnsan Kaynağı Ekle")}
              </button>
            </form>

            <article className="operation-card resource-definition-card resource-list-card">
              <div className="operation-card-heading">
                <h2>{copy("Human Resources", "İnsan Kaynağı")}</h2>
                <span>{operationsWorkspace.workforce.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="compact-resource-list">
                {(operationsWorkspace.workforce.length ? operationsWorkspace.workforce : [{ id: "empty" }]).map((workforce) => (
                  <span key={workforce.id}>
                    <strong>{workforce.id === "empty" ? "-" : workforce.role_name}</strong>
                    <small>{workforce.id === "empty" ? "-" : `${formatLira(workforce.hourly_cost, 2)} / ${copy("hour", "saat")}`}</small>
                  </span>
                ))}
              </div>
            </article>

            <form className="operation-card resource-definition-card semi-finished-card" onSubmit={handleSaveSemiFinished}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Add semi-finished item", "Yarı mamül ekle")}</span>
                  <h2>{copy("Semi-finished", "Yarı Mamül")}</h2>
                </div>
                <button type="button" onClick={addSemiFinishedComponentRow}>{copy("Add component", "Bileşen ekle")}</button>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Name", "Ad")}</span>
                  <input type="text" value={semiFinishedForm.name} onChange={(event) => updateSemiFinishedForm("name", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Unit", "Birim")}</span>
                  <select value={semiFinishedForm.unit} onChange={(event) => updateSemiFinishedForm("unit", event.target.value)}>
                    {unitOptions.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                  </select>
                </label>
                <label>
                  <span>{copy("Unit price", "Birim fiyat")}</span>
                  <input min="0" step="0.01" type="number" value={semiFinishedForm.pricePerUnit} onChange={(event) => updateSemiFinishedForm("pricePerUnit", event.target.value)} />
                </label>
              </div>

              <div className="resource-section">
                <div className="resource-section-header">
                  <div>
                    <span>{copy("Inputs per semi-finished unit", "Yarı mamül birimi için girdiler")}</span>
                    <p>{copy("Select materials or other semi-finished items and define the amount needed for one unit.", "Bir birim için gereken malzeme veya diğer yarı mamülleri ve miktarlarını tanımlayın.")}</p>
                  </div>
                </div>
                <div className="resource-row-list">
                  {(semiFinishedForm.componentRows || []).length ? semiFinishedForm.componentRows.map((row, index) => {
                    const availableOptions = semiComponentOptions.filter((option) => option.type === row.componentType);
                    const selectedOption = availableOptions.find((option) => option.id === row.componentId);

                    return (
                      <div className="resource-row-grid material-plan-row" key={`semi-component-${index}`}>
                        <label>
                          <span>{copy("Type", "Tip")}</span>
                          <select
                            value={row.componentType}
                            onChange={(event) => {
                              const nextType = event.target.value;
                              const nextOptions = semiComponentOptions.filter((option) => option.type === nextType);
                              updateSemiFinishedComponentRow(index, "componentType", nextType);
                              updateSemiFinishedComponentRow(index, "componentId", nextOptions[0]?.id || "");
                            }}
                          >
                            <option value="material">{copy("Material", "Malzeme")}</option>
                            <option value="semi">{copy("Semi-finished", "Yarı Mamül")}</option>
                          </select>
                        </label>
                        <label>
                          <span>{copy("Item", "Kalem")}</span>
                          <select value={row.componentId || ""} onChange={(event) => updateSemiFinishedComponentRow(index, "componentId", event.target.value)}>
                            <option value="">{copy("Select item", "Kalem seç")}</option>
                            {availableOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>{copy("Amount", "Miktar")}</span>
                          <input min="0" step="0.0001" type="number" value={row.quantityPerUnit ?? ""} onChange={(event) => updateSemiFinishedComponentRow(index, "quantityPerUnit", event.target.value)} />
                        </label>
                        <div className="resource-row-meta">
                          <strong>{selectedOption?.unit || "-"}</strong>
                          <small>{copy("per unit", "birim başına")}</small>
                        </div>
                        <button type="button" className="resource-remove-button" onClick={() => removeSemiFinishedComponentRow(index)}>
                          {copy("Delete", "Sil")}
                        </button>
                      </div>
                    );
                  }) : (
                    <p className="planner-empty-state">{copy("No input rows yet. Add a component to define the semi-finished recipe.", "Henüz girdi satırı yok. Yarı mamül reçetesini tanımlamak için bileşen ekleyin.")}</p>
                  )}
                </div>
              </div>

              <button className="submit-button planner-save-button" type="submit">{copy("Add Semi-finished", "Yarı Mamül Ekle")}</button>
            </form>

            <article className="operation-card resource-definition-card resource-list-card">
              <div className="operation-card-heading">
                <h2>{copy("Semi-finished records", "Yarı Mamül kayıtları")}</h2>
                <span>{semiFinishedItems.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="compact-resource-list">
                {(semiFinishedItems.length ? semiFinishedItems : [{ id: "empty" }]).map((item) => (
                  <span key={item.id}>
                    <strong>{item.id === "empty" ? "-" : item.name}</strong>
                    <small>{item.id === "empty" ? "-" : `${formatLira(item.pricePerUnit, 2)} / ${item.unit} • ${(item.componentRows || []).length} ${copy("inputs", "girdi")}`}</small>
                  </span>
                ))}
              </div>
            </article>

            <form className="operation-card resource-definition-card service-card" onSubmit={handleSaveService}>
              <div className="operation-card-heading">
                <div>
                  <span>{copy("Add service", "Hizmet ekle")}</span>
                  <h2>{copy("Service", "Hizmet")}</h2>
                </div>
              </div>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Name", "Ad")}</span>
                  <input type="text" value={serviceForm.name} onChange={(event) => updateServiceForm("name", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Price", "Fiyat")}</span>
                  <input min="0" step="0.01" type="number" value={serviceForm.price} onChange={(event) => updateServiceForm("price", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Initial cost", "Başlangıç maliyeti")}</span>
                  <input min="0" step="0.01" type="number" value={serviceForm.initialCost} onChange={(event) => updateServiceForm("initialCost", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Monthly cost", "Aylık maliyet")}</span>
                  <input min="0" step="0.01" type="number" value={serviceForm.monthlyCost} onChange={(event) => updateServiceForm("monthlyCost", event.target.value)} />
                </label>
              </div>
              <button className="submit-button planner-save-button" type="submit">{copy("Add Service", "Hizmet Ekle")}</button>
            </form>

            <article className="operation-card resource-definition-card resource-list-card">
              <div className="operation-card-heading">
                <h2>{copy("Services", "Hizmetler")}</h2>
                <span>{serviceItems.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="compact-resource-list">
                {(serviceItems.length ? serviceItems : [{ id: "empty" }]).map((service) => (
                  <span key={service.id}>
                    <strong>{service.id === "empty" ? "-" : service.name}</strong>
                    <small>{service.id === "empty" ? "-" : `${formatLira(service.price, 2)} • ${copy("Initial", "Başlangıç")}: ${formatLira(service.initialCost, 2)} • ${copy("Monthly", "Aylık")}: ${formatLira(service.monthlyCost, 2)}`}</small>
                  </span>
                ))}
              </div>
            </article>
          </div>
          {operationsStatus && <p className="status-message">{operationsStatus}</p>}
        </section>,
    );
  }

  function renderProductDataPage() {
    const productMaterialRows = operationForms.product.materialRows || [];

    return renderDashboardLayout(
      `operations/${activeOperationsSubmodule.key}`,
        <section className="operations-workspace operations-modern">
          <div className="operations-header">
            <div>
              <span>Operations / {copy("Products", "Ürünler")}</span>
              <h1>{copy("Products", "Ürünler")}</h1>
              <p>{copy("Keep the product recipe, unit, price, and cycle time used in process definition calculations.", "Süreç tanımlama hesaplamasında kullanılacak ürün reçetesini, birimini, fiyatını ve çevrim süresini tutun.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="operation-data-grid">
            <form className="operation-card operation-data-form" onSubmit={(event) => handleSaveOperationRecord("product", event)}>
              <div className="operation-data-fields">
                <label>
                  <span>{copy("Product name", "Ürün adı")}</span>
                  <input
                    type="text"
                    value={operationForms.product.name}
                    onChange={(event) => updateOperationForm("product", "name", event.target.value)}
                  />
                </label>
                <label>
                  <span>{copy("Unit", "Birim")}</span>
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
                  <span>{copy("Price", "Fiyat")}</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={operationForms.product.price}
                    onChange={(event) => updateOperationForm("product", "price", event.target.value)}
                  />
                </label>
                <label>
                  <span>{copy("Cycle time", "Çevrim süresi")}</span>
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
                    <span>{copy("Required materials", "Gerekli malzemeler")}</span>
                    <p>{copy("Enter the materials and quantities required to produce one product unit.", "Bir ürün birimi üretmek için gereken malzemeleri ve miktarları girin.")}</p>
                  </div>
                  <button type="button" onClick={addProductMaterialRow}>{copy("Add Material", "Malzeme Ekle")}</button>
                </div>
                <div className="resource-row-list">
                  {productMaterialRows.length ? productMaterialRows.map((row, index) => {
                    const selectedMaterial = operationsWorkspace.materials.find((material) => material.id === row.materialId);

                    return (
                      <div className="resource-row-grid material-plan-row" key={`product-material-${index}`}>
                        <label>
                          <span>{copy("Material", "Malzeme")}</span>
                          <select value={row.materialId || ""} onChange={(event) => updateProductMaterialRow(index, "materialId", event.target.value)}>
                            <option value="">{copy("Select material", "Malzeme seç")}</option>
                            {operationsWorkspace.materials.map((material) => (
                              <option value={material.id} key={material.id}>{material.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>{copy("Quantity per unit", "Birim başına miktar")}</span>
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
                          <small>{selectedMaterial ? `${formatLira(selectedMaterial.price_per_unit, 2)} / ${selectedMaterial.unit}` : copy("No record selected", "Kayıt seçilmedi")}</small>
                        </div>
                        <button type="button" className="resource-remove-button" onClick={() => removeProductMaterialRow(index)}>
                          {copy("Delete", "Sil")}
                        </button>
                      </div>
                    );
                  }) : (
                    <p className="planner-empty-state">{copy("No recipe materials yet. Add materials on Material Definitions first, then connect them to the product here.", "Henüz reçete malzemesi yok. Önce Malzeme Tanımları ekranında malzeme ekleyin, sonra buradan ürüne bağlayın.")}</p>
                  )}
                </div>
              </div>

              <button className="submit-button planner-save-button" disabled={operationsLoading} type="submit">
                {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save to Supabase", "Supabase'e Kaydet")}
              </button>
            </form>

            <article className="operation-card operation-data-table-card">
              <div className="operation-card-heading">
                <h2>{copy("Records", "Kayıtlar")}</h2>
                <span>{operationsWorkspace.products.length} {copy("records", "kayıt")}</span>
              </div>
              <div className="operation-data-table">
                <div className="operation-data-row operation-data-head" style={{ gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.8fr 1.4fr" }}>
                  <span>{copy("Product", "Ürün")}</span>
                  <span>{copy("Unit", "Birim")}</span>
                  <span>{copy("Price", "Fiyat")}</span>
                  <span>{copy("Cycle", "Çevrim")}</span>
                  <span>{copy("Materials", "Malzemeler")}</span>
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
                    <span>{product.id === "empty" ? "-" : `${formatNumber(product.cycle_time_minutes || 1, 2)} ${copy("min", "dk")}`}</span>
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
              <span>Operations / {copy("Active Processes", "Mevcut Süreçler")}</span>
              <h1>{copy("Active Processes", "Mevcut Süreçler")}</h1>
              <p>{copy("Track production plans saved to Supabase and their calculated production/cost results.", "Supabase'e kaydedilen üretim planlarını ve hesaplanan üretim/maliyet sonuçlarını takip edin.")}</p>
            </div>
            <div className="operations-actions">
              <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
              <button type="button" className="primary" onClick={() => goTo("/operations/data-entry", "login")}>{copy("New Plan", "Yeni Plan")}</button>
            </div>
          </div>

          <div className="process-summary-grid">
            <article className="operation-card process-summary-card">
              <span>{copy("Active Plan", "Aktif Plan")}</span>
              <strong>{activePlans.length}</strong>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Total Production", "Toplam Üretim")}</span>
              <strong>{formatNumber(activePlans.reduce((total, plan) => total + (Number(plan.result?.producedQuantity) || 0), 0), 2)}</strong>
            </article>
            <article className="operation-card process-summary-card">
              <span>{copy("Tracked Cost", "Takip Edilen Maliyet")}</span>
              <strong>{formatLira(activePlans.reduce((total, plan) => total + (Number(plan.result?.totalTrackedDailyCost) || 0), 0))}</strong>
            </article>
          </div>

          <div className="process-list">
            {activePlans.length ? activePlans.map((plan) => {
              const result = plan.result || {};
              const productName = plan.product?.name || result.productName || plan.input?.productName || "-";
              const productUnit = result.productUnit || plan.product?.unit || copy("pcs", "adet");
              const machineRows = Array.isArray(result.machineRows) ? result.machineRows : [];
              const materialRows = Array.isArray(result.materialRows) ? result.materialRows : [];

              return (
                <article className="operation-card process-card" key={plan.id}>
                  <div className="operation-card-heading">
                    <div>
                      <span>{new Date(plan.created_at).toLocaleString(locale)}</span>
                      <h2>{plan.plan_name || copy("Daily production plan", "Günlük üretim planı")}</h2>
                    </div>
                    <mark className="ok">{copy("Active", "Aktif")}</mark>
                  </div>

                  <div className="process-metrics">
                    <span>{copy("Product", "Ürün")} <strong>{productName}</strong></span>
                    <span>{copy("Quantity to Produce", "Üretilecek Miktar")} <strong>{formatNumber(result.producedQuantity, 2)} {productUnit}</strong></span>
                    <span>{copy("Cycle", "Çevrim")} <strong>{formatNumber(result.cycleTimeMinutes, 2)} {copy("min", "dk")}</strong></span>
                    <span>{copy("Main Machine Hours", "Ana Makine Saati")} <strong>{formatNumber(result.primaryMachineDailyHours, 2)} {copy("hours", "saat")}</strong></span>
                    <span>{copy("Energy", "Enerji")} <strong>{formatNumber(result.energyConsumptionKwh, 2)} kWh</strong></span>
                    <span>{copy("Cost", "Maliyet")} <strong>{formatLira(result.totalTrackedDailyCost)}</strong></span>
                  </div>

                  <div className="process-detail-grid">
                    <div>
                      <h3>{copy("Machines", "Makineler")}</h3>
                      {(machineRows.length ? machineRows : [{ machineId: "empty", name: "-", dailyHours: 0 }]).map((row) => (
                        <span key={row.machineId}>
                          {row.name} <strong>{formatNumber(row.dailyHours, 2)} {copy("hours", "saat")}</strong>
                        </span>
                      ))}
                    </div>
                    <div>
                      <h3>{copy("Material Usage", "Malzeme Kullanımı")}</h3>
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
                <p className="planner-empty-state">{copy("No production plans saved to Supabase yet. Save a plan from the process definition screen and it will appear here.", "Henüz Supabase'e kaydedilmiş üretim planı yok. Süreç tanımlama ekranından plan kaydedince burada görünecek.")}</p>
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
    const currentFinancialPage = activeFinancialSubmodule || financialSubmodules[0];
    const investmentTotal = (summary.machinePurchaseCost || 0) + (summary.extraInitialCost || 0);
    const returnOnInvestment = investmentTotal ? `${formatNumber(((summary.netIncome || 0) / investmentTotal) * 100, 1)}%` : "-";
    const financialPageMeta = {
      "product-cost": {
        description: copy("Product cost is calculated from active operation plans, product recipes, machine energy, workforce, materials, and recurring extra costs.", "Ürün maliyeti; aktif operasyon planları, ürün reçeteleri, makine enerjisi, işgücü, malzeme ve tekrarlayan ek giderlerden hesaplanır."),
        title: "Ürün Maliyeti",
      },
      "investment-cost": {
        description: copy("Investment cost combines machine purchase cost and initial extra costs coming from the financial model.", "Yatırım maliyeti; finansal modelden gelen makine satın alma maliyeti ve başlangıç ek giderlerini birleştirir."),
        title: "Yatırım Maliyeti",
      },
      "product-return": {
        description: copy("Product return compares operation-based sales revenue with tracked production expenses and net income.", "Ürün getirisi; operasyon bazlı satış kazançlarını takip edilen üretim giderleri ve net kazançla karşılaştırır."),
        title: "Ürün Getirisi",
      },
      "investment-return": {
        description: copy("Investment return compares net income with the current machine and initial-cost investment base.", "Yatırım getirisi; net kazancı mevcut makine ve başlangıç maliyeti yatırım tabanıyla karşılaştırır."),
        title: "Yatırım Getirisi",
      },
    }[currentFinancialPage.key];
    const metricRowsByPage = {
      "product-cost": [
        [copy("Active Process", "Mevcut Süreç"), summary.planCount],
        [copy("Total Produced", "Toplam Üretim"), formatNumber(summary.totalProduced)],
        [copy("Material Cost", "Malzeme Maliyeti"), formatLira(summary.materialCost)],
        [copy("Total Expense", "Toplam Gider"), formatLira(summary.totalCost)],
      ],
      "investment-cost": [
        [copy("Machine Investment", "Makine Yatırımı"), formatLira(summary.machinePurchaseCost)],
        [copy("Initial Extra Cost", "Başlangıç Ek Gideri"), formatLira(summary.extraInitialCost)],
        [copy("Active Process", "Mevcut Süreç"), summary.planCount],
        [copy("Total Investment", "Toplam Yatırım"), formatLira(investmentTotal)],
      ],
      "product-return": [
        [copy("Sales Revenue", "Satış Kazançları"), formatLira(summary.salesRevenue)],
        [copy("Total Expense", "Toplam Gider"), formatLira(summary.totalCost)],
        [copy("Net Income", "Net Kazanç"), formatLira(summary.netIncome)],
        [copy("Total Produced", "Toplam Üretim"), formatNumber(summary.totalProduced)],
      ],
      "investment-return": [
        [copy("Net Income", "Net Kazanç"), formatLira(summary.netIncome)],
        [copy("Total Investment", "Toplam Yatırım"), formatLira(investmentTotal)],
        [copy("ROI", "Yatırım Getirisi"), returnOnInvestment],
        [copy("Sales Revenue", "Satış Kazançları"), formatLira(summary.salesRevenue)],
      ],
    };
    const isCostPage = currentFinancialPage.key.includes("cost");
    const isInvestmentPage = currentFinancialPage.key.includes("investment");
    const showElectricityPriceInput = currentFinancialPage.key === "product-cost";
    const visibleIncomeRows = (financialModel.incomeRows || []).filter((row) => {
      if (currentFinancialPage.key === "product-cost") return row.kind !== "income" && row.costType !== "initial";
      if (currentFinancialPage.key === "investment-cost") return row.costType === "initial" || row.label === copy("Machine investment", "Makine yatırımı");
      if (currentFinancialPage.key === "product-return") return row.costType !== "initial";
      return true;
    });

    return renderDashboardLayout(
      `financial-modelling/${currentFinancialPage.key}`,
        <section className="financial-workspace">
          <div className="financial-header">
            <div>
              <span>{currentFinancialPage.group} / {copy("Model connected to Operations data", "Operations verisine bağlı model")}</span>
              <h1>{financialPageMeta.title}</h1>
              <p>{financialPageMeta.description}</p>
            </div>
            <button type="button" className="primary" onClick={() => loadFinancialData()}>
              {financialLoading ? copy("Loading...", "Yükleniyor...") : copy("Update Data", "Verileri Güncelle")}
            </button>
          </div>

          {isCostPage && (
            <div className="financial-controls finance-input-panel">
              {showElectricityPriceInput && (
                <form onSubmit={handleSaveFinancialSettings}>
                  <label>
                    <span>{copy("Electricity kW price", "Elektrik kW fiyatı")}</span>
                    <input
                      min="0"
                      step="0.0001"
                      type="number"
                      value={financialSettingsForm.electricityPricePerKwh}
                      onChange={(event) => setFinancialSettingsForm({ electricityPricePerKwh: event.target.value })}
                    />
                  </label>
                  <button type="submit" disabled={financialLoading}>{copy("Save", "Kaydet")}</button>
                </form>
              )}

              <form onSubmit={handleSaveFinancialExtraCost}>
                <label>
                  <span>{copy("Extra cost name", "Ek gider adı")}</span>
                  <input
                    type="text"
                    value={financialExtraCostForm.name}
                    onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label>
                  <span>{copy("Type", "Tip")}</span>
                  <select
                    value={financialExtraCostForm.costType}
                    onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, costType: event.target.value }))}
                  >
                    <option value="initial">{copy("Initial", "Başlangıç")}</option>
                    <option value="recurring">{copy("Recurring", "Tekrarlayan")}</option>
                  </select>
                </label>
                <label>
                  <span>{copy("Amount", "Tutar")}</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={financialExtraCostForm.amount}
                    onChange={(event) => setFinancialExtraCostForm((current) => ({ ...current, amount: event.target.value }))}
                  />
                </label>
                <button type="submit" disabled={financialLoading}>{copy("Add Extra Cost", "Ek Gider Ekle")}</button>
              </form>
            </div>
          )}

          {financialStatus && <p className="status-message">{financialStatus}</p>}

          <div className="finance-metric-grid">
            {metricRowsByPage[currentFinancialPage.key].map(([label, value]) => (
              <article className="finance-metric-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{copy("Supabase calculation result", "Supabase hesap sonucu")}</small>
              </article>
            ))}
          </div>

          <div className="financial-grid">
            <article className="financial-card income-card">
              <div className="financial-card-heading"><h2>{isCostPage ? copy("Cost Calculation Rows", "Maliyet Hesap Satırları") : copy("Return Calculation Rows", "Getiri Hesap Satırları")}</h2></div>
              <div className="income-table simplified-income-table">
                <div className="income-row income-head"><span>{copy("Item", "Kalem")}</span><span>{copy("Type", "Tip")}</span><span>{copy("Amount", "Tutar")}</span></div>
                {visibleIncomeRows.map((row, index) => (
                  <div className="income-row" key={`${row.label}-${index}`}>
                    <strong>{row.label}</strong>
                    <span>{row.kind === "income" ? copy("Income", "Gelir") : row.costType === "initial" ? copy("Initial expense", "Başlangıç gideri") : copy("Expense", "Gider")}</span>
                    <span>{formatLira(row.amount)}</span>
                  </div>
                ))}
                <div className="income-row income-total">
                  <strong>{isCostPage ? copy("Selected cost total", "Seçili maliyet toplamı") : copy("Net income", "Net kazanç")}</strong>
                  <span>{isCostPage ? currentFinancialPage.group : copy("Income - expense", "Gelir - gider")}</span>
                  <span>{isCostPage ? formatLira(isInvestmentPage ? investmentTotal : summary.totalCost) : formatLira(summary.netIncome)}</span>
                </div>
              </div>
            </article>

            <article className="financial-card trend-card">
            <div className="financial-card-heading">
              <h2>{copy("Financial Trends", "Finansal Trendler")}</h2>
              <div className="mini-tabs">
                {[
                  ["6m", copy("6 Months", "6 Ay")],
                  ["1y", copy("1 Year", "1 Yıl")],
                  ["5y", copy("5 Years", "5 Yıl")],
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
            <div className="chart-legend" aria-label={copy("Chart color legend", "Grafik renk açıklaması")}>
              <span className="legend-sales">{copy("Sales revenue", "Satış kazançları")}</span>
              <span className="legend-costs">{copy("Expenses", "Giderler")}</span>
              <span className="legend-net">{copy("Net income", "Net kazanç")}</span>
            </div>
              <svg className="trend-chart finance-model-chart" viewBox="0 0 560 280" role="img" aria-label={copy("Sales revenue, expenses, and net income projection chart", "Satış kazançları, giderler ve net kazanç projeksiyon grafiği")}>
                <text className="axis-label axis-label-y" x="-162" y="18" transform="rotate(-90)">{copy("Amount (TRY)", "Tutar (TRY)")}</text>
                <text className="axis-label axis-label-x" x="272" y="262">{copy("Projection period", "Projeksiyon dönemi")}</text>
                <path className="chart-grid" d="M30 40 H500 M30 82.5 H500 M30 125 H500 M30 167.5 H500 M30 210 H500" />
                <path className="chart-axis" d="M30 30 V210 H500" />
                <text className="chart-tick" x="30" y="214">0</text>
                <text className="chart-tick" x="24" y="44">{copy("High", "Yüksek")}</text>
                <text className="chart-tick" x="30" y="232">{copy("Start", "Başlangıç")}</text>
                <text className="chart-tick chart-tick-end" x="500" y="232">{copy("End", "Bitiş")}</text>
                {chart.salesPath && <path className="trend-line sales" d={chart.salesPath} />}
                {chart.costPath && <path className="trend-line costs" d={chart.costPath} />}
                {chart.netPath && <path className="trend-line net" d={chart.netPath} />}
              </svg>
            </article>

            <article className="financial-card cost-card">
              <h2>{isInvestmentPage ? copy("Investment Structure", "Yatırım Yapısı") : copy("Cost Structure", "Maliyet Yapısı")}</h2>
              <div className="cost-body">
                <div className="donut-chart cost-donut" aria-hidden="true"><span>{formatLira(isInvestmentPage ? investmentTotal : summary.totalCost)}</span></div>
                <div className="cost-list">
                  {(isInvestmentPage
                    ? [
                        { amount: summary.machinePurchaseCost, label: copy("Machine investment", "Makine yatırımı") },
                        { amount: summary.extraInitialCost, label: copy("Initial extra costs", "Başlangıç ek giderleri") },
                      ]
                    : (financialModel.costStructure || [])
                  ).map((item) => (
                    <span key={item.label}>{item.label}<strong>{formatLira(item.amount)}</strong></span>
                  ))}
                </div>
              </div>
            </article>

            <article className="financial-card scenario-card">
              <div className="financial-card-heading"><h2>{isCostPage ? copy("Extra Costs", "Ek Giderler") : copy("Return Notes", "Getiri Notları")}</h2></div>
              <div className="scenario-list">
                {(isCostPage
                  ? (financialModel.extraCosts?.length ? financialModel.extraCosts : [{ id: "empty", name: copy("No extra cost yet", "Henüz ek gider yok"), costType: "-", amount: 0 }])
                  : [
                      { amount: summary.salesRevenue, costType: "income", id: "sales", name: copy("Operation-based sales revenue", "Operasyon bazlı satış kazançları") },
                      { amount: summary.netIncome, costType: "income", id: "net", name: copy("Net return after tracked costs", "Takip edilen maliyetlerden sonra net getiri") },
                    ]
                ).map((cost) => (
                  <div className="scenario-row" key={cost.id}>
                    <div>
                      <strong>{cost.name}</strong>
                      <span>{cost.costType === "initial" ? copy("Initial expense", "Başlangıç gideri") : cost.costType === "recurring" ? copy("Recurring expense", "Tekrarlayan gider") : cost.costType === "income" ? copy("Calculated return", "Hesaplanan getiri") : "-"}</span>
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

  function renderSimulationPage() {
    const variant = activeSimulationVariant || simulationVariants[0];
    const parameters = variant.parameters;
    const numberParam = (field) => Number(parameters[field]) || 0;
    const baseRevenue = numberParam("baseRevenue");
    const priceEffect = numberParam("priceChange") / 100;
    const demandEffect = numberParam("demandChange") / 100;
    const campaignEffect = numberParam("campaignLift") / 100;
    const efficiencyEffect = numberParam("productionEfficiency") / 100;
    const competitorDrag = numberParam("competitorPressure") / 100;
    const volatility = numberParam("volatility") / 100;
    const costVolatility = numberParam("costVolatility") / 100;
    const fixedCost = numberParam("fixedCost");
    const marketingBudget = numberParam("marketingBudget");
    const variableCostRatio = numberParam("variableCostRatio") / 100;
    const grossMargin = numberParam("grossMargin") / 100;
    const currentPrice = Number(salesStrategy.company.baseSalesPrice) || 45;
    const trendAdjustedRevenue = baseRevenue * (1 + demandEffect + priceEffect + campaignEffect + efficiencyEffect * 0.42 - competitorDrag * 0.55);
    const projectedCost = trendAdjustedRevenue * Math.min(variableCostRatio + costVolatility * 0.22, 0.92) + fixedCost + marketingBudget;
    const mostLikelyNet = trendAdjustedRevenue * grossMargin - fixedCost - marketingBudget;
    const outcomeSpread = trendAdjustedRevenue * Math.max(volatility + costVolatility * 0.65 + competitorDrag * 0.35, 0.08);
    const buildOutcome = (key, percentile, label, tone, multiplier) => {
      const revenue = trendAdjustedRevenue + outcomeSpread * multiplier;
      const cost = projectedCost + outcomeSpread * (multiplier < 0 ? Math.abs(multiplier) * 0.45 : -multiplier * 0.18);
      const net = revenue * grossMargin - fixedCost - marketingBudget - (multiplier < 0 ? outcomeSpread * Math.abs(multiplier) * 0.28 : 0);
      return {
        breakEvenUnits: Math.max(0, Math.round((fixedCost + marketingBudget) / Math.max(currentPrice * (1 - variableCostRatio), 1))),
        cost,
        key,
        label,
        net,
        percentile,
        revenue,
        tone,
      };
    };
    const outcomes = [
      buildOutcome("worst", "Worst 5%", copy("Highly Risky Scenario", "Çok Riskli Senaryo"), "danger", -1.32),
      buildOutcome("bad", "20th", copy("Bad Scenario", "Kötü Senaryo"), "bad", -0.72),
      buildOutcome("likely", "50th", copy("Most Likely Scenario", "En Olası Senaryo"), "likely", 0),
      buildOutcome("good", "80th", copy("Good Scenario", "İyi Senaryo"), "good", 0.78),
    ];
    const likelyOutcome = outcomes.find((outcome) => outcome.key === "likely");
    const maxRevenue = Math.max(...outcomes.map((outcome) => outcome.revenue), 1);
    const maxNetAbs = Math.max(...outcomes.map((outcome) => Math.abs(outcome.net)), 1);
    const incomeRows = [
      [copy("Sales revenue", "Satış geliri"), likelyOutcome.revenue],
      [copy("Variable cost", "Değişken gider"), -(likelyOutcome.revenue * variableCostRatio)],
      [copy("Fixed cost", "Sabit gider"), -fixedCost],
      [copy("Marketing budget", "Pazarlama bütçesi"), -marketingBudget],
      [copy("Projected net", "Projeksiyon net"), likelyOutcome.net],
    ];
    const parameterGroups = [
      {
        fields: [
          ["demandChange", copy("Demand change (%)", "Talep değişimi (%)"), -30, 40, 1],
          ["priceChange", copy("Price change (%)", "Fiyat değişimi (%)"), -20, 30, 1],
          ["campaignLift", copy("Marketing campaign lift (%)", "Pazarlama kampanya etkisi (%)"), -10, 35, 1],
          ["productionEfficiency", copy("Production efficiency effect (%)", "Üretim verimliliği etkisi (%)"), -20, 30, 1],
          ["marketShare", copy("Market share (%)", "Pazar payı (%)"), 0, 100, 0.5],
          ["reputationScore", copy("Reputation score", "İtibar skoru"), 0, 100, 1],
        ],
        title: copy("Trend drivers", "Trend sürücüleri"),
      },
      {
        fields: [
          ["volatility", copy("Demand volatility (%)", "Talep oynaklığı (%)"), 0, 60, 1],
          ["costVolatility", copy("Cost volatility (%)", "Maliyet oynaklığı (%)"), 0, 60, 1],
          ["competitorPressure", copy("Competitor pressure (%)", "Rakip baskısı (%)"), 0, 50, 1],
        ],
        title: copy("Risk and uncertainty", "Risk ve belirsizlik"),
      },
      {
        fields: [
          ["baseRevenue", copy("Base revenue", "Baz gelir"), 0, 100000000, 100000],
          ["grossMargin", copy("Gross margin (%)", "Brüt marj (%)"), 0, 80, 1],
          ["variableCostRatio", copy("Variable cost ratio (%)", "Değişken gider oranı (%)"), 0, 95, 1],
          ["fixedCost", copy("Fixed cost", "Sabit gider"), 0, 50000000, 100000],
          ["marketingBudget", copy("Marketing budget", "Pazarlama bütçesi"), 0, 20000000, 50000],
          ["timeHorizonMonths", copy("Time horizon (months)", "Zaman ufku (ay)"), 1, 60, 1],
        ],
        title: copy("Financial base", "Finansal temel"),
      },
    ];
    const usedParameters = [
      [copy("Simulation paths", "Simülasyon yolu"), formatNumber(numberParam("simulationCount"))],
      [copy("Future algorithm", "Gelecek algoritma"), copy("Fractal Brownian motion", "Fractal Brownian motion")],
      [copy("Sales strategy input", "Satış stratejisi girdisi"), copy("Campaign lift, channel pressure, reputation", "Kampanya etkisi, kanal baskısı, itibar")],
      [copy("Operations input", "Operasyon girdisi"), copy("Efficiency, cost volatility, capacity sensitivity", "Verimlilik, maliyet oynaklığı, kapasite hassasiyeti")],
      [copy("Financial input", "Finansal girdi"), copy("Revenue, fixed cost, margin, marketing budget", "Gelir, sabit gider, marj, pazarlama bütçesi")],
    ];

    return renderDashboardLayout(
      `simulation/${variant.id}`,
        <section className="simulation-workspace monte-carlo-workspace">
          <div className="simulation-header">
            <div>
              <span>ARKAS METAL / {copy("Monte Carlo Simulation", "Monte Carlo Simülasyonu")}</span>
              <h1>{variant.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : variant.name}</h1>
              <p>{copy("Frontend-only simulation workspace for the future 10,000-path fractal Brownian motion engine. Parameters are editable now; backend calculations and real Monte Carlo outputs will be connected later.", "Gelecekteki 10.000 yollu fractal Brownian motion motoru için sadece frontend simülasyon alanı. Parametreler şimdilik ekranda düzenlenebilir; backend hesapları ve gerçek Monte Carlo çıktıları daha sonra bağlanacak.")}</p>
            </div>
            <button type="button" className="primary" onClick={addSimulationVariant}>{copy("Add Variant", "Varyant Ekle")}</button>
          </div>

          <div className="simulation-variant-strip" role="tablist" aria-label={copy("Simulation variants", "Simülasyon varyantları")}>
            {simulationVariants.map((item) => (
              <div className={variant.id === item.id ? "simulation-variant-pill active" : "simulation-variant-pill"} key={item.id}>
                <button
                  type="button"
                  onClick={() => goTo(item.path, "login")}
                >
                  {item.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : item.name || item.label}
                </button>
                {item.id !== "current-situation" && (
                  <button
                    type="button"
                    className="variant-delete-button"
                    aria-label={copy("Delete variant", "Varyantı sil")}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteSimulationVariant(item.id);
                    }}
                  >
                    x
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="monte-carlo-summary">
            {[
              [copy("Most likely net", "En olası net"), formatLira(likelyOutcome.net), copy("50th percentile", "50. persentil")],
              [copy("Break-even point", "Başa baş noktası"), `${formatNumber(likelyOutcome.breakEvenUnits)} ${copy("units", "adet")}`, copy("current price basis", "mevcut fiyat bazlı")],
              [copy("Worst 5% net", "En kötü %5 net"), formatLira(outcomes[0].net), copy("highly risky scenario", "çok riskli senaryo")],
              [copy("Revenue range", "Gelir aralığı"), `${formatLira(outcomes[1].revenue)} - ${formatLira(outcomes[3].revenue)}`, copy("20th to 80th percentile", "20-80 persentil")],
            ].map(([label, value, detail]) => (
              <article className="monte-carlo-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <div className="monte-carlo-grid">
            <aside className="simulation-card simulation-parameter-panel">
              <div className="simulation-card-heading">
                <div>
                  <span>{copy("Variant setup", "Varyant kurulumu")}</span>
                  <h2>{copy("Parameters currently being used", "Şu anda kullanılan parametreler")}</h2>
                </div>
              </div>
              <label className="simulation-name-field">
                <span>{copy("Variant name", "Varyant adı")}</span>
                <input value={variant.name} onChange={(event) => updateSimulationVariant(variant.id, "name", event.target.value)} />
              </label>
              {parameterGroups.map((group) => (
                <div className="parameter-group" key={group.title}>
                  <h3>{group.title}</h3>
                  {group.fields.map(([field, label, min, max, step]) => (
                    <label className="sim-input-row" key={field}>
                      <span>{label}</span>
                      <input
                        min={min}
                        max={max}
                        step={step}
                        type="number"
                        value={parameters[field]}
                        onChange={(event) => updateSimulationParameter(variant.id, field, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </aside>

            <main className="monte-carlo-main">
              <article className="simulation-card percentile-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Percentile outcomes", "Persentil çıktıları")}</span>
                    <h2>{copy("Bad, most likely, good and worst 5% scenarios", "Kötü, en olası, iyi ve en kötü %5 senaryolar")}</h2>
                  </div>
                </div>
                <div className="percentile-grid">
                  {outcomes.map((outcome) => (
                    <article className={`percentile-outcome ${outcome.tone}`} key={outcome.key}>
                      <span>{outcome.percentile}</span>
                      <h3>{outcome.label}</h3>
                      <strong>{formatLira(outcome.net)}</strong>
                      <p>{copy("Revenue", "Gelir")}: {formatLira(outcome.revenue)}</p>
                      <p>{copy("Break-even", "Başa baş")}: {formatNumber(outcome.breakEvenUnits)} {copy("units", "adet")}</p>
                    </article>
                  ))}
                </div>
              </article>

              <article className="simulation-card monte-chart-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Break-even graph", "Başa baş grafiği")}</span>
                    <h2>{copy("Revenue, cost and break-even estimate", "Gelir, gider ve başa baş tahmini")}</h2>
                  </div>
                </div>
                <svg className="monte-chart break-even-chart" viewBox="0 0 620 280" role="img" aria-label={copy("Break-even chart", "Başa baş grafiği")}>
                  <path className="chart-grid" d="M42 40 H580 M42 90 H580 M42 140 H580 M42 190 H580 M42 240 H580" />
                  <path className="chart-axis" d="M42 28 V240 H585" />
                  <path className="break-even-cost" d="M50 218 L130 202 L210 184 L290 166 L370 148 L450 130 L570 104" />
                  <path className="break-even-revenue" d="M50 232 L130 206 L210 178 L290 150 L370 122 L450 94 L570 52" />
                  <line className="break-even-marker" x1="285" x2="285" y1="42" y2="240" />
                  <text className="chart-tick" x="294" y="68">{copy("Break-even", "Başa baş")}</text>
                  <text className="chart-tick" x="48" y="262">{copy("Volume", "Hacim")}</text>
                  <text className="chart-tick chart-tick-end" x="502" y="262">{copy("Projected sales", "Projeksiyon satış")}</text>
                </svg>
                <div className="chart-legend">
                  <span className="legend-sales">{copy("Revenue", "Gelir")}</span>
                  <span className="legend-costs">{copy("Cost", "Gider")}</span>
                  <span className="legend-net">{copy("Break-even point", "Başa baş noktası")}</span>
                </div>
              </article>

              <article className="simulation-card income-simulation-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Income statement", "Gelir gider tablosu")}</span>
                    <h2>{copy("Projected gelir gider table and graph", "Projeksiyon gelir gider tablosu ve grafiği")}</h2>
                  </div>
                </div>
                <div className="sim-income-layout">
                  <div className="sim-income-table">
                    {incomeRows.map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{formatLira(value)}</strong>
                      </div>
                    ))}
                  </div>
                  <svg className="monte-chart income-bars-chart" viewBox="0 0 520 250" aria-hidden="true">
                    <path className="chart-grid" d="M34 35 H500 M34 85 H500 M34 135 H500 M34 185 H500" />
                    {incomeRows.map(([label, value], index) => {
                      const height = Math.max(14, (Math.abs(value) / Math.max(maxRevenue, maxNetAbs)) * 165);
                      const x = 58 + index * 88;
                      const y = value >= 0 ? 202 - height : 202;
                      return (
                        <React.Fragment key={label}>
                          <rect className={value >= 0 ? "income-positive" : "income-negative"} x={x} y={y} width="46" height={height} rx="6" />
                          <text className="chart-tick" x={x - 8} y="230">{index + 1}</text>
                        </React.Fragment>
                      );
                    })}
                    <path className="chart-axis" d="M34 22 V202 H500" />
                  </svg>
                </div>
              </article>
            </main>

            <aside className="simulation-side">
              <article className="simulation-card simulation-used-params">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Inputs in use", "Kullanılan girdiler")}</span>
                    <h2>{copy("Parameter sources", "Parametre kaynakları")}</h2>
                  </div>
                </div>
                <div className="used-parameter-list">
                  {usedParameters.map(([label, value]) => (
                    <span key={label}>{label}<strong>{value}</strong></span>
                  ))}
                </div>
              </article>

              <article className="simulation-card path-preview-card">
                <div className="simulation-card-heading">
                  <div>
                    <span>{copy("Path preview", "Yol önizleme")}</span>
                    <h2>{copy("Future fBM trend adjustment", "Gelecek fBM trend ayarı")}</h2>
                  </div>
                </div>
                <svg className="monte-chart path-preview-chart" viewBox="0 0 420 220" aria-hidden="true">
                  <path className="chart-grid" d="M24 42 H396 M24 88 H396 M24 134 H396 M24 180 H396" />
                  <path className="percentile-band" d="M28 166 C76 144 118 154 162 126 S248 108 294 82 360 80 392 58 L392 128 C340 140 312 154 266 166 S178 174 128 188 62 196 28 202 Z" />
                  <path className="path-worst" d="M28 196 C74 184 118 190 164 176 S244 166 294 152 350 150 392 136" />
                  <path className="path-likely" d="M28 168 C82 148 124 158 168 128 S248 118 296 90 352 82 392 68" />
                  <path className="path-good" d="M28 142 C78 112 122 120 168 92 S248 74 296 54 350 46 392 34" />
                </svg>
                <p>{copy("The visual is a frontend placeholder. Later, 10,000 simulated fractal Brownian paths will drive these percentile bands.", "Bu görsel frontend placeholder. Daha sonra 10.000 fractal Brownian simülasyon yolu bu persentil bantlarını oluşturacak.")}</p>
              </article>

              <article className="simulation-card risk-card">
                <h2>{copy("Highly risky scenario", "Çok riskli senaryo")}</h2>
                <p>{copy("The worst 5% outcome is displayed separately because it represents the tail-risk case that can threaten margin, cash flow, and break-even timing.", "En kötü %5 çıktı ayrı gösterilir; marjı, nakit akışını ve başa baş zamanlamasını tehdit edebilecek kuyruk riskini temsil eder.")}</p>
                <strong>{formatLira(outcomes[0].net)}</strong>
              </article>
            </aside>
          </div>
        </section>,
    );
  }

  function renderSalesStrategyPage() {
    const company = salesStrategy.company;
    const average = (items, field) => {
      if (!items.length) return 0;
      return items.reduce((total, item) => total + (Number(item[field]) || 0), 0) / items.length;
    };
    const findHighest = (items, field) => items.reduce((best, item) => ((Number(item[field]) || 0) > (Number(best?.[field]) || 0) ? item : best), items[0] || {});
    const totalCampaignBudget = salesStrategy.campaigns.reduce((total, campaign) => total + (Number(campaign.budget) || 0), 0);
    const totalChannelBudget = salesStrategy.channels.reduce((total, channel) => total + (Number(channel.budget) || 0), 0);
    const averageCompetitorPrice = average(salesStrategy.competitors, "salesPrice");
    const priceGap = (Number(company.baseSalesPrice) || 0) - averageCompetitorPrice;
    const strongestChannel = findHighest(salesStrategy.channels, "successScore");
    const strongestCampaign = findHighest(salesStrategy.campaigns, "successScore");
    const strongestPerson = findHighest(salesStrategy.personnel, "successScore");
    const competitorToWatch = findHighest(salesStrategy.competitors, "threatScore");
    const channelScore = Math.round(average(salesStrategy.channels, "successScore"));
    const campaignScore = Math.round(average(salesStrategy.campaigns, "successScore"));
    const personnelScore = Math.round(average(salesStrategy.personnel, "successScore"));
    const reputationScore = Number(company.reputationScore) || 0;
    const scoreClass = (score) => (Number(score) >= 75 ? "strong" : Number(score) >= 60 ? "watch" : "risk");

    return renderDashboardLayout(
      "sales-strategy",
        <section className="sales-workspace">
          <div className="sales-header">
            <div>
              <span>ARKAS METAL / {copy("Sales Strategy", "Satış Stratejisi")}</span>
              <h1>{copy("Sales Strategy", "Satış Stratejisi")}</h1>
              <p>{copy("Plan how the product is sold, compare channels and campaigns, track competitor moves, and reflect sales personnel performance. This is frontend-only for now; AI retrieval and backend calculations can plug into these fields later.", "Ürünün nasıl satılacağını planlayın, kanal ve kampanyaları karşılaştırın, rakip hamlelerini takip edin ve satış personeli performansını yansıtın. Şimdilik sadece frontend; AI veri çekme ve backend hesaplamaları daha sonra bu alanlara bağlanabilir.")}</p>
            </div>
            <button type="button" className="primary" onClick={() => setSalesStrategy(initialSalesStrategy)}>
              {copy("Reset Demo Data", "Demo Veriyi Sıfırla")}
            </button>
          </div>

          <div className="sales-stat-grid">
            {[
              [copy("Market Share", "Pazar Payı"), `${formatNumber(company.marketShare, 1)}%`, copy("manual company input", "manuel şirket girdisi")],
              [copy("Reputation", "İtibar"), `${formatNumber(reputationScore)}/100`, copy("brand strength", "marka gücü")],
              [copy("Campaign Budget", "Kampanya Bütçesi"), formatLira(totalCampaignBudget), copy("planned spend", "planlanan harcama")],
              [copy("Price vs Competitors", "Rakiplere Göre Fiyat"), averageCompetitorPrice ? `${priceGap >= 0 ? "+" : ""}${formatLira(priceGap)}` : "-", copy("average price gap", "ortalama fiyat farkı")],
            ].map(([label, value, detail]) => (
              <article className="sales-stat-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <div className="sales-grid">
            <article className="sales-card company-position-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Company position", "Şirket pozisyonu")}</span>
                  <h2>{copy("Product, price, market share and reputation", "Ürün, fiyat, pazar payı ve itibar")}</h2>
                </div>
              </div>
              <div className="sales-form-grid">
                <label>
                  <span>{copy("Product", "Ürün")}</span>
                  <input value={company.productName} onChange={(event) => updateSalesCompany("productName", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Target segment", "Hedef segment")}</span>
                  <input value={company.targetSegment} onChange={(event) => updateSalesCompany("targetSegment", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Sales price", "Satış fiyatı")}</span>
                  <input min="0" step="0.01" type="number" value={company.baseSalesPrice} onChange={(event) => updateSalesCompany("baseSalesPrice", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Monthly sales target", "Aylık satış hedefi")}</span>
                  <input min="0" type="number" value={company.monthlyTarget} onChange={(event) => updateSalesCompany("monthlyTarget", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Market share (%)", "Pazar payı (%)")}</span>
                  <input min="0" max="100" step="0.1" type="number" value={company.marketShare} onChange={(event) => updateSalesCompany("marketShare", event.target.value)} />
                </label>
                <label>
                  <span>{copy("Reputation score", "İtibar skoru")}</span>
                  <input min="0" max="100" type="number" value={company.reputationScore} onChange={(event) => updateSalesCompany("reputationScore", event.target.value)} />
                </label>
                <label className="wide-field">
                  <span>{copy("Positioning note", "Konumlandırma notu")}</span>
                  <textarea value={company.positioning} onChange={(event) => updateSalesCompany("positioning", event.target.value)} />
                </label>
              </div>
            </article>

            <article className="sales-card sales-reflection-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Success reflection", "Başarı yansıması")}</span>
                  <h2>{copy("What looks strong right now", "Şu an güçlü görünenler")}</h2>
                </div>
              </div>
              <div className="sales-score-list">
                {[
                  [copy("Channel health", "Kanal sağlığı"), channelScore, strongestChannel.name],
                  [copy("Campaign traction", "Kampanya çekişi"), campaignScore, strongestCampaign.name],
                  [copy("Personnel performance", "Personel performansı"), personnelScore, strongestPerson.name],
                  [copy("Company reputation", "Şirket itibarı"), reputationScore, company.positioning],
                ].map(([label, score, detail]) => (
                  <div className={`sales-score-row ${scoreClass(score)}`} key={label}>
                    <span>{label}</span>
                    <strong>{formatNumber(score)}/100</strong>
                    <div className="sales-score-bar"><i style={{ width: `${Math.min(Number(score) || 0, 100)}%` }} /></div>
                    <small>{detail}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card channels-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Sales channels", "Satış kanalları")}</span>
                  <h2>{copy("Online, retail, distributor and direct sales routes", "Online, retail, distribütör ve direkt satış rotaları")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("channels")}>{copy("Add Channel", "Kanal Ekle")}</button>
              </div>
              <div className="sales-channel-grid">
                {salesStrategy.channels.map((channel) => (
                  <div className="sales-edit-card" key={channel.id}>
                    <label><span>{copy("Channel name", "Kanal adı")}</span><input value={channel.name} onChange={(event) => updateSalesItem("channels", channel.id, "name", event.target.value)} /></label>
                    <label><span>{copy("Type", "Tip")}</span><input value={channel.type} onChange={(event) => updateSalesItem("channels", channel.id, "type", event.target.value)} /></label>
                    <label><span>{copy("Sales price", "Satış fiyatı")}</span><input min="0" step="0.01" type="number" value={channel.price} onChange={(event) => updateSalesItem("channels", channel.id, "price", event.target.value)} /></label>
                    <label><span>{copy("Channel budget", "Kanal bütçesi")}</span><input min="0" step="1000" type="number" value={channel.budget} onChange={(event) => updateSalesItem("channels", channel.id, "budget", event.target.value)} /></label>
                    <label><span>{copy("Revenue share (%)", "Ciro payı (%)")}</span><input min="0" max="100" type="number" value={channel.revenueShare} onChange={(event) => updateSalesItem("channels", channel.id, "revenueShare", event.target.value)} /></label>
                    <label><span>{copy("Conversion (%)", "Dönüşüm (%)")}</span><input min="0" max="100" type="number" value={channel.conversionRate} onChange={(event) => updateSalesItem("channels", channel.id, "conversionRate", event.target.value)} /></label>
                    <label><span>{copy("Success score", "Başarı skoru")}</span><input min="0" max="100" type="number" value={channel.successScore} onChange={(event) => updateSalesItem("channels", channel.id, "successScore", event.target.value)} /></label>
                    <label className="wide-field"><span>{copy("Channel note", "Kanal notu")}</span><textarea value={channel.note} onChange={(event) => updateSalesItem("channels", channel.id, "note", event.target.value)} /></label>
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card campaigns-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Marketing campaigns", "Pazarlama kampanyaları")}</span>
                  <h2>{copy("Budget, campaign type, duration and target channel", "Bütçe, kampanya tipi, süre ve hedef kanal")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("campaigns")}>{copy("Add Campaign", "Kampanya Ekle")}</button>
              </div>
              <div className="sales-table">
                <div className="sales-table-row sales-table-head"><span>{copy("Campaign", "Kampanya")}</span><span>{copy("Type", "Tip")}</span><span>{copy("Channel", "Kanal")}</span><span>{copy("Budget", "Bütçe")}</span><span>{copy("Duration", "Süre")}</span><span>{copy("Success", "Başarı")}</span></div>
                {salesStrategy.campaigns.map((campaign) => (
                  <div className="sales-table-row campaign-row" key={campaign.id}>
                    <label><input value={campaign.name} onChange={(event) => updateSalesItem("campaigns", campaign.id, "name", event.target.value)} /></label>
                    <label><input value={campaign.type} onChange={(event) => updateSalesItem("campaigns", campaign.id, "type", event.target.value)} /></label>
                    <label><input value={campaign.channel} onChange={(event) => updateSalesItem("campaigns", campaign.id, "channel", event.target.value)} /></label>
                    <label><input min="0" step="1000" type="number" value={campaign.budget} onChange={(event) => updateSalesItem("campaigns", campaign.id, "budget", event.target.value)} /></label>
                    <label><input min="0" type="number" value={campaign.durationWeeks} onChange={(event) => updateSalesItem("campaigns", campaign.id, "durationWeeks", event.target.value)} /></label>
                    <label><input min="0" max="100" type="number" value={campaign.successScore} onChange={(event) => updateSalesItem("campaigns", campaign.id, "successScore", event.target.value)} /></label>
                    <textarea value={campaign.goal} onChange={(event) => updateSalesItem("campaigns", campaign.id, "goal", event.target.value)} />
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card competitors-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Competitor intelligence", "Rakip bilgisi")}</span>
                  <h2>{copy("Manual competitor price, campaign and strategy inputs", "Manuel rakip fiyat, kampanya ve strateji girdileri")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("competitors")}>{copy("Add Competitor", "Rakip Ekle")}</button>
              </div>
              <div className="competitor-grid">
                {salesStrategy.competitors.map((competitor) => (
                  <div className="competitor-card" key={competitor.id}>
                    <div className="competitor-title">
                      <input value={competitor.name} onChange={(event) => updateSalesItem("competitors", competitor.id, "name", event.target.value)} />
                      <mark className={scoreClass(competitor.threatScore)}>{copy("Threat", "Tehdit")} {formatNumber(competitor.threatScore)}</mark>
                    </div>
                    <div className="sales-form-grid compact">
                      <label><span>{copy("Sales price", "Satış fiyatı")}</span><input min="0" step="0.01" type="number" value={competitor.salesPrice} onChange={(event) => updateSalesItem("competitors", competitor.id, "salesPrice", event.target.value)} /></label>
                      <label><span>{copy("Market share", "Pazar payı")}</span><input min="0" max="100" type="number" value={competitor.marketShare} onChange={(event) => updateSalesItem("competitors", competitor.id, "marketShare", event.target.value)} /></label>
                      <label><span>{copy("Reputation", "İtibar")}</span><input min="0" max="100" type="number" value={competitor.reputationScore} onChange={(event) => updateSalesItem("competitors", competitor.id, "reputationScore", event.target.value)} /></label>
                      <label><span>{copy("Marketing budget", "Pazarlama bütçesi")}</span><input min="0" step="1000" type="number" value={competitor.marketingBudget} onChange={(event) => updateSalesItem("competitors", competitor.id, "marketingBudget", event.target.value)} /></label>
                      <label><span>{copy("Threat score", "Tehdit skoru")}</span><input min="0" max="100" type="number" value={competitor.threatScore} onChange={(event) => updateSalesItem("competitors", competitor.id, "threatScore", event.target.value)} /></label>
                      <label><span>{copy("Campaign type", "Kampanya tipi")}</span><input value={competitor.campaignType} onChange={(event) => updateSalesItem("competitors", competitor.id, "campaignType", event.target.value)} /></label>
                      <label className="wide-field"><span>{copy("Strategy", "Strateji")}</span><textarea value={competitor.strategy} onChange={(event) => updateSalesItem("competitors", competitor.id, "strategy", event.target.value)} /></label>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card personnel-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Sales personnel", "Satış personeli")}</span>
                  <h2>{copy("Ownership, pipeline, target and performance", "Sahiplik, pipeline, hedef ve performans")}</h2>
                </div>
                <button type="button" onClick={() => addSalesItem("personnel")}>{copy("Add Person", "Personel Ekle")}</button>
              </div>
              <div className="sales-table personnel-table">
                <div className="sales-table-row sales-table-head"><span>{copy("Person", "Kişi")}</span><span>{copy("Role", "Rol")}</span><span>{copy("Channel", "Kanal")}</span><span>{copy("Target", "Hedef")}</span><span>{copy("Pipeline", "Pipeline")}</span><span>{copy("Win rate", "Kazanım")}</span><span>{copy("Success", "Başarı")}</span></div>
                {salesStrategy.personnel.map((person) => (
                  <div className="sales-table-row personnel-row" key={person.id}>
                    <label><input value={person.name} onChange={(event) => updateSalesItem("personnel", person.id, "name", event.target.value)} /></label>
                    <label><input value={person.role} onChange={(event) => updateSalesItem("personnel", person.id, "role", event.target.value)} /></label>
                    <label><input value={person.assignedChannel} onChange={(event) => updateSalesItem("personnel", person.id, "assignedChannel", event.target.value)} /></label>
                    <label><input min="0" type="number" value={person.monthlyTarget} onChange={(event) => updateSalesItem("personnel", person.id, "monthlyTarget", event.target.value)} /></label>
                    <label><input min="0" step="1000" type="number" value={person.pipelineValue} onChange={(event) => updateSalesItem("personnel", person.id, "pipelineValue", event.target.value)} /></label>
                    <label><input min="0" max="100" type="number" value={person.winRate} onChange={(event) => updateSalesItem("personnel", person.id, "winRate", event.target.value)} /></label>
                    <label><input min="0" max="100" type="number" value={person.successScore} onChange={(event) => updateSalesItem("personnel", person.id, "successScore", event.target.value)} /></label>
                  </div>
                ))}
              </div>
            </article>

            <article className="sales-card sales-decision-card">
              <div className="sales-card-heading">
                <div>
                  <span>{copy("Strategy readout", "Strateji okuması")}</span>
                  <h2>{copy("Manual inputs translated into decision signals", "Manuel girdilerden karar sinyalleri")}</h2>
                </div>
              </div>
              <div className="sales-signal-grid">
                <span>{copy("Best channel", "En iyi kanal")} <strong>{strongestChannel.name || "-"}</strong><small>{formatNumber(strongestChannel.successScore)}/100</small></span>
                <span>{copy("Best campaign", "En iyi kampanya")} <strong>{strongestCampaign.name || "-"}</strong><small>{formatLira(totalCampaignBudget)} {copy("total budget", "toplam bütçe")}</small></span>
                <span>{copy("Top salesperson", "En iyi satışçı")} <strong>{strongestPerson.name || "-"}</strong><small>{formatLira(strongestPerson.pipelineValue)} pipeline</small></span>
                <span>{copy("Competitor to watch", "Takip edilecek rakip")} <strong>{competitorToWatch.name || "-"}</strong><small>{competitorToWatch.campaignType || "-"}</small></span>
                <span>{copy("Channel spend", "Kanal harcaması")} <strong>{formatLira(totalChannelBudget)}</strong><small>{copy("manual plan", "manuel plan")}</small></span>
                <span>{copy("Monthly target", "Aylık hedef")} <strong>{formatNumber(company.monthlyTarget)}</strong><small>{company.targetSegment}</small></span>
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
              <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
            </div>
          </div>

          <div className="operation-data-grid">
            {renderOperationRecordForm(entity, fields)}
            <article className="operation-card operation-data-table-card">
              <div className="operation-card-heading">
                <h2>{copy("Records", "Kayıtlar")}</h2>
                <span>{rows.length} {copy("records", "kayıt")}</span>
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
    { label: copy("Daily Production", "Günlük Üretim"), value: "24.580", delta: "+12%", detail: copy("vs yesterday", "düne göre") },
    { label: copy("Capacity Usage", "Kapasite Kullanımı"), value: "78%", delta: "+8%", detail: copy("above target", "hedefin üstünde") },
    { label: copy("Daily Profitability", "Günlük Karlılık"), value: "₺4.2M", delta: "+14%", detail: copy("net operational effect", "net operasyonel etki") },
    { label: copy("Critical Alert", "Kritik Alarm"), value: "3", delta: copy("active", "aktif"), detail: copy("awaiting action", "aksiyon bekliyor") },
  ];

  const factoryLines = [
    { name: "LINE-1", status: copy("active", "aktif"), tone: "teal" },
    { name: "LINE-2", status: copy("active", "aktif"), tone: "teal" },
    { name: "LINE-3", status: copy("maintenance", "bakım"), tone: "amber" },
    { name: "LINE-4", status: copy("critical", "kritik"), tone: "clay" },
    { name: "QC-02", status: copy("active", "aktif"), tone: "cyan" },
  ];

  const dashboardInsights = [
    { title: copy("LINE-2 output limit", "LINE-2 çıktı limiti"), copy: copy("8% extra capacity is possible by shift end.", "Vardiya sonuna kadar %8 ek kapasite mümkün."), tone: "amber" },
    { title: copy("EK-22 material bottleneck", "EK-22 malzeme darboğazı"), copy: copy("Supplier delay increases delivery risk.", "Tedarik gecikmesi termin riskini artırıyor."), tone: "clay" },
    { title: copy("3-shift model looks strong", "3 vardiya modeli iyi"), copy: copy("It appears to be the most balanced route for profitability.", "Karlılık için en dengeli rota görünüyor."), tone: "teal" },
    { title: copy("FX variance effect", "Kur farkı etkisi"), copy: copy("The financial output now needs protection.", "Finansal çıktıda koruma ihtiyacı oluştu."), tone: "navy" },
    { title: copy("Energy use optimized", "Enerji tüketimi optimize"), copy: copy("Night production is pulling cost down.", "Gece üretimi maliyeti aşağı çekiyor."), tone: "cyan" },
  ];

  const dashboardModules = [
    { key: "operations", path: "/operations", label: "Operations" },
    { key: "product-plus", path: "/product-plus", label: "Ürün +" },
    { key: "human-resources-plus", path: "/human-resources-plus", label: copy("Human Resources +", "İnsan Kaynağı +") },
    { key: "financial-modelling", path: "/financial-modelling", label: copy("Financial Modelling", "Finansal Modelleme") },
    { key: "sales-strategy", path: "/sales-strategy", label: copy("Sales Strategy", "Satış Stratejisi") },
    { key: "simulation", path: "/simulation", label: copy("Simulation", "Simülasyon") },
    { key: "ai-insights", path: "/ai-insights", label: copy("AI Insights", "AI İçgörüleri") },
    { key: "reports", path: "/reports", label: copy("Reports", "Raporlar") },
    { key: "settings", path: "/settings", label: copy("Settings", "Ayarlar") },
  ];
  const operationsSubmodules = [
    { key: "resources", path: "/operations/resources", label: copy("Resources", "Kaynak") },
    { key: "products", path: "/operations/products", label: copy("Products", "Ürünler") },
    { key: "machines-equipment", path: "/operations/machines-equipment", label: copy("Machines & Equipment", "Makine & Ekipman") },
    { key: "data-entry", path: "/operations/data-entry", label: copy("Process Definition", "Süreç Tanımlama") },
    { key: "active-processes", path: "/operations/active-processes", label: copy("Active Processes", "Mevcut Süreçler") },
  ];
  const productPlusSubmodules = [
    { key: "product-tree", path: "/product-plus/product-tree", label: copy("Product Tree", "Ürün Ağacı") },
  ];
  const financialSubmodules = [
    { group: "Maliyet Hesaplama", key: "product-cost", path: "/financial-modelling/maliyet-hesaplama/urun-maliyeti", label: "Ürün Maliyeti" },
    { group: "Maliyet Hesaplama", key: "investment-cost", path: "/financial-modelling/maliyet-hesaplama/yatirim-maliyeti", label: "Yatırım Maliyeti" },
    { group: "Getiri Hesaplama", key: "product-return", path: "/financial-modelling/getiri-hesaplama/urun-getirisi", label: "Ürün Getirisi" },
    { group: "Getiri Hesaplama", key: "investment-return", path: "/financial-modelling/getiri-hesaplama/yatirim-getirisi", label: "Yatırım Getirisi" },
  ];

  const activeModule = dashboardModules.find((module) => module.path === path);
  const activeOperationsSubmodule = operationsSubmodules.find((module) => module.path === path);
  const activeProductPlusSubmodule = productPlusSubmodules.find((module) => module.path === path);
  const activeFinancialSubmodule = financialSubmodules.find((module) => module.path === path);
  const activeSimulationVariant = simulationVariants.find((variant) => variant.path === path);
  const isOperationsRoute = path === "/operations" || path.startsWith("/operations/");
  const isProductPlusRoute = path === "/product-plus" || path.startsWith("/product-plus/");
  const isFinancialRoute = path === "/financial-modelling" || path.startsWith("/financial-modelling/");
  const isSimulationRoute = path === "/simulation" || path.startsWith("/simulation/");
  const moduleLabelByKey = Object.fromEntries(dashboardModules.map((module) => [module.key, module.label]));
  const getModuleLabel = (module) => moduleLabelByKey[module.module_key] || module.name;
  const operationSteps = [
    copy("Cutting", "Kesim"),
    copy("Forming", "Şekillendirme"),
    copy("Hole Punching", "Delik Delme"),
    copy("Thickening", "Kalınlama"),
    copy("Surface Treatment", "Yüzey İşleme"),
    copy("Cleaning", "Temizlik"),
    copy("Inspection", "Kontrol"),
    copy("Packaging", "Paketleme"),
    copy("Shipping", "Sevkiyat"),
  ];
  const financeMetrics = [
    { label: copy("Net Sales", "Net Satışlar"), value: "₺28.7M", change: "+11%" },
    { label: copy("Gross Profit", "Brüt Kâr"), value: "₺9.78M", change: "+8" },
    { label: copy("Operating Profit", "Faaliyet Kârı"), value: "₺6.42M", change: "+14" },
    { label: copy("Net Profit", "Net Kâr"), value: "₺4.23M", change: "+10" },
    { label: copy("Cash Position", "Nakit Pozisyonu"), value: "₺12.6M", change: "+16" },
  ];
  const incomeRows = [
    [copy("Net Sales", "Net Satışlar"), "₺28.690.000", "₺25.780.000", "+11.3%", "₺27.500.000", "+4.3%"],
    [copy("Cost of Sales", "Satışların Maliyeti"), "-₺18.912.000", "-₺17.216.000", "+9.9%", "-₺18.300.000", "+3.3%"],
    [copy("Gross Profit", "Brüt Kâr"), "₺9.778.000", "₺8.564.000", "+14.2%", "₺9.200.000", "+6.3%"],
    [copy("Gross Profit Margin", "Brüt Kâr Marjı"), "34.1", "33.2", "+0.9p", "33.5", "+0.6p"],
    [copy("Operating Expenses", "Faaliyet Giderleri"), "-₺3.358.000", "-₺3.200.000", "+4.9%", "-₺3.100.000", "+8.3%"],
    ["FAVÖK", "₺6.420.000", "₺5.371.000", "+19.5%", "₺6.100.000", "+5.2%"],
    [copy("Net Profit", "Net Kâr"), "₺4.230.000", "₺3.810.000", "+11.0%", "₺3.900.000", "+8.5%"],
  ];
  const scenarioCards = [
    { title: copy("Electricity Cost +15%", "Elektrik Maliyeti +15%"), metric: copy("EBITDA Effect", "FAVÖK Etkisi"), value: "-₺1.2M", action: copy("Simulate", "Simüle Et") },
    { title: copy("Move to 3 Shifts", "3 Vardiya Geçişi"), metric: copy("Net Profit Effect", "Net Kâr Etkisi"), value: "+₺2.3M", action: copy("Simulate", "Simüle Et") },
    { title: copy("EK-22 Machine Investment", "Makine EK-22 Yatırımı"), metric: copy("Payback", "Geri Dönüş"), value: copy("14.7 mo", "14.7 ay"), action: copy("Simulate", "Simüle Et") },
    { title: copy("Raw Material Price +10%", "Hammadde Fiyatı +10%"), metric: copy("Margin Effect", "Marj Etkisi"), value: "-₺1.2M", action: copy("Simulate", "Simüle Et") },
  ];
  const simulationParameters = [
    [copy("Demand Change", "Talep Değişimi"), "+15"],
    [copy("Raw Material Price Change", "Hammadde Fiyat Değişimi"), "+10"],
    [copy("Energy Price Change", "Enerji Fiyatı Değişimi"), "-20"],
    [copy("Labor Cost Change", "İşçilik Maliyeti Değişimi"), "+5"],
    [copy("Efficiency Change", "Verimlilik Değişimi"), "+10"],
    [copy("Working Time", "Çalışma Süresi"), copy("3 shifts", "3 vardiya")],
  ];
  const productionLines = [
    ["LINE-1", "72%", "4.120", "+512", "87%", copy("Low", "Düşük")],
    ["LINE-2", "95%", "7.480", "+1.180", "79%", copy("Medium", "Orta")],
    ["LINE-3", "81%", "6.890", "+940", "76%", copy("High", "Yüksek")],
    ["LINE-4", "68%", "3.320", "+420", "63%", copy("Medium", "Orta")],
  ];
  const reportStats = [
    [copy("Total Reports", "Toplam Rapor"), "32", copy("+14 vs this month", "+14 bu aya göre")],
    [copy("Viewed Reports", "Görüntülenen Rapor"), "128", copy("+22 vs this month", "+22 bu aya göre")],
    [copy("Downloaded Reports", "İndirilen Rapor"), "45", copy("+9 vs this month", "+9 bu aya göre")],
    [copy("Automated Reports", "Otomatik Raporlar"), "12", copy("+33 vs this month", "+33 bu aya göre")],
    [copy("Latest Report", "Son Rapor"), copy("Financial Summary Report", "Finansal Özet Raporu"), copy("May 21, 2024 09:15", "21 Mayıs 2024 09:15")],
  ];
  const recentReports = [
    [copy("Financial Summary Report", "Finansal Özet Raporu"), copy("Financial Reports", "Finansal Raporlar"), copy("May 21, 2024 09:15", "21 Mayıs 2024 09:15"), copy("May 01 - May 31 2024", "01 May - 31 May 2024"), "Ahmet Yılmaz"],
    [copy("Production Performance Report", "Üretim Performans Raporu"), copy("Production Reports", "Üretim Raporları"), copy("May 21, 2024 08:45", "21 Mayıs 2024 08:45"), copy("May 01 - May 31 2024", "01 May - 31 May 2024"), copy("System Automatic", "Sistem Otomatik")],
    [copy("Capacity Usage Report", "Kapasite Kullanım Raporu"), copy("Capacity Reports", "Kapasite Raporları"), copy("May 20, 2024 11:30", "20 Mayıs 2024 11:30"), copy("May 01 - May 31 2024", "01 May - 31 May 2024"), "Ahmet Yılmaz"],
    [copy("Sales Profitability Analysis", "Satış Karlılık Analizi"), copy("Sales Reports", "Satış Raporları"), copy("May 20, 2024 11:00", "20 Mayıs 2024 11:00"), copy("May 01 - May 31 2024", "01 May - 31 May 2024"), "Mehmet Kaya"],
    [copy("Machine Maintenance Report", "Makine Bakım Raporu"), copy("Maintenance Reports", "Bakım Raporları"), copy("May 20, 2024 08:00", "20 Mayıs 2024 08:00"), copy("May 01 - May 31 2024", "01 May - 31 May 2024"), copy("System Automatic", "Sistem Otomatik")],
    [copy("Cash Flow Report", "Nakit Akış Raporu"), copy("Financial Reports", "Finansal Raporlar"), copy("May 19, 2024 15:20", "19 Mayıs 2024 15:20"), copy("May 01 - May 31 2024", "01 May - 31 May 2024"), "Ahmet Yılmaz"],
  ];
  const financeWindowLabel =
    financeWindow === "custom"
      ? `${financeDateRange.start || copy("Start", "Başlangıç")} - ${financeDateRange.end || copy("End", "Bitiş")}`
      : {
          today: copy("Today", "Bugün"),
          tomorrow: copy("Tomorrow", "Yarın"),
          week: copy("This week", "Bu hafta"),
          month: copy("This month", "Bu ay"),
        }[financeWindow];

  function renderDashboardLayout(activePage, children) {
    return (
      <main className="dashboard-shell">
        <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
          <div className="dashboard-brand-block">
            <button type="button" className="landing-brand dashboard-brand" onClick={() => goTo("/dashboard", "login")}>
              <img src={logoUrl} alt="Atera logo" />
              <strong>Atera</strong>
            </button>

            <div className="dashboard-controls">
              <label className="language-picker">
                <span>{labels.language}</span>
                <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
                  <option value="en">EN</option>
                  <option value="tr">TR</option>
                </select>
              </label>
              <ThemeToggle />
            </div>
          </div>

          <nav className="dashboard-nav">
            <button
              type="button"
              className={activePage.startsWith("dashboard") ? "active" : ""}
              onClick={() => goTo("/dashboard", "login")}
            >
              {labels.dashboard}
            </button>
            {dashboardModules.map((module) => (
              <React.Fragment key={module.key}>
                <button
                  type="button"
                  className={activePage === module.key || (module.key === "operations" && activePage.startsWith("operations/")) || (module.key === "product-plus" && activePage.startsWith("product-plus/")) || (module.key === "financial-modelling" && activePage.startsWith("financial-modelling/")) || (module.key === "simulation" && activePage.startsWith("simulation/")) ? "active" : ""}
                  onClick={() => goTo(module.key === "operations" ? "/operations/data-entry" : module.key === "product-plus" ? "/product-plus/product-tree" : module.key === "financial-modelling" ? "/financial-modelling/maliyet-hesaplama/urun-maliyeti" : module.key === "simulation" ? "/simulation/current-situation" : module.path, "login")}
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
                {module.key === "product-plus" && (activePage === "product-plus" || activePage.startsWith("product-plus/")) && (
                  <div className="dashboard-subnav" aria-label="Ürün + submodules">
                    {productPlusSubmodules.map((submodule) => (
                      <button
                        type="button"
                        className={activePage === `product-plus/${submodule.key}` ? "active" : ""}
                        onClick={() => goTo(submodule.path, "login")}
                        key={submodule.key}
                      >
                        {submodule.label}
                      </button>
                    ))}
                  </div>
                )}
                {module.key === "financial-modelling" && (activePage === "financial-modelling" || activePage.startsWith("financial-modelling/")) && (
                  <div className="dashboard-subnav" aria-label="Finansal Modelleme submodules">
                    {[...new Set(financialSubmodules.map((submodule) => submodule.group))].map((group) => (
                      <React.Fragment key={group}>
                        <span className="dashboard-subnav-label">{group}</span>
                        {financialSubmodules.filter((submodule) => submodule.group === group).map((submodule) => (
                          <button
                            type="button"
                            className={activePage === `financial-modelling/${submodule.key}` ? "active" : ""}
                            onClick={() => goTo(submodule.path, "login")}
                            key={submodule.key}
                          >
                            {submodule.label}
                          </button>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {module.key === "simulation" && (activePage === "simulation" || activePage.startsWith("simulation/")) && (
                  <div className="dashboard-subnav" aria-label={copy("Simulation variants", "Simülasyon varyantları")}>
                    {simulationVariants.map((variant) => (
                      <div className="simulation-subnav-item" key={variant.id}>
                        <button
                          type="button"
                          className={activePage === `simulation/${variant.id}` ? "active" : ""}
                          onClick={() => goTo(variant.path, "login")}
                        >
                          {variant.id === "current-situation" ? copy("Current Situation", "Mevcut Durum") : variant.name || variant.label}
                        </button>
                        {variant.id !== "current-situation" && (
                          <button
                            type="button"
                            className="variant-delete-button"
                            aria-label={copy("Delete variant", "Varyantı sil")}
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteSimulationVariant(variant.id);
                            }}
                          >
                            x
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addSimulationVariant}>
                      + {copy("Add Variant", "Varyant Ekle")}
                    </button>
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
                <strong>{labels.dataSync}</strong>
                <small>{labels.live}</small>
              </div>
            </div>
            <button type="button" className="link-button dashboard-logout" onClick={handleLogout}>
              {labels.logout}
            </button>
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

          <div className="landing-controls">
            <label className="language-picker">
              <span>{labels.language}</span>
              <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
                <option value="en">EN</option>
                <option value="tr">TR</option>
              </select>
            </label>
            <ThemeToggle />
          </div>
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
              <span className="who-node node-plan">{copy("Plan", "Planla")}</span>
              <span className="who-node node-test">{copy("Test", "Dene")}</span>
              <span className="who-node node-decide">{copy("Decide", "Karar ver")}</span>
              <span className="who-node node-scale">{copy("Scale", "Büyüt")}</span>
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
      "dashboard/overview",
        <section className="command-dashboard" aria-label="Atera command dashboard">
          <div className="command-topbar">
            <div className="command-context">
              <strong>ARKAS METAL</strong>
              <span>{copy("Automotive Gasket Production", "Otomotiv Conta Üretimi")}</span>
            </div>
            <div className="command-live">
              <span className="live-dot" />
              <strong>{copy("System Healthy", "Sistem Sağlıklı")}</strong>
            </div>
            <div className="command-user">
              <span>{currentProfile?.username || form.username || "Atera"}</span>
              <small>{copy("Admin", "Admin")}</small>
            </div>
            <button type="button" className="command-run-button">{copy("Simulation Running", "Simülasyon Çalışıyor")}</button>
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
                  <span>{copy("Digital Factory Map", "Dijital Fabrika Haritası")}</span>
                  <h2>{copy("Production floor", "Üretim sahası")}</h2>
                </div>
                <button type="button">{copy("Full screen", "Tam ekran")}</button>
              </div>
              <div className="factory-map" aria-label={copy("Mock digital factory map", "Örnek dijital fabrika haritası")}>
                {factoryLines.map((line, index) => (
                  <div className={`factory-node ${line.tone} node-${index + 1}`} key={line.name}>
                    <strong>{line.name}</strong>
                    <span>{line.status}</span>
                  </div>
                ))}
                <div className="factory-building building-a">{copy("Cutting", "Kesim")}</div>
                <div className="factory-building building-b">{copy("Press", "Pres")}</div>
                <div className="factory-building building-c">{copy("Packaging", "Paketleme")}</div>
              </div>
              <div className="factory-metrics">
                <span>{copy("Total Lines", "Toplam Hatlar")} <strong>42</strong></span>
                <span>{copy("Running Machines", "Çalışan Makine")} <strong>38</strong></span>
                <span>{copy("Stops", "Duraklama")} <strong>3</strong></span>
                <span>{copy("Quality NOK", "Kalite NOK")} <strong>1</strong></span>
              </div>
            </article>

            <article className="command-card finance-card">
              <div className="card-heading">
                <div>
                  <span>{copy("Financial Impact Panel", "Finansal Etki Paneli")}</span>
                  <h2>{financeWindowLabel} {copy("impact", "etkisi")}</h2>
                </div>
                <div className="finance-date-controls" aria-label={copy("Financial impact date range", "Finansal etki tarih aralığı")}>
                  <select value={financeWindow} onChange={(event) => setFinanceWindow(event.target.value)}>
                    <option value="today">{copy("Today", "Bugün")}</option>
                    <option value="tomorrow">{copy("Tomorrow", "Yarın")}</option>
                    <option value="week">{copy("This week", "Bu hafta")}</option>
                    <option value="month">{copy("This month", "Bu ay")}</option>
                    <option value="custom">{copy("Custom range", "Özel aralık")}</option>
                  </select>
                  <input
                    aria-label={copy("Start date", "Başlangıç tarihi")}
                    type="date"
                    value={financeDateRange.start}
                    onChange={(event) => updateFinanceDateRange("start", event.target.value)}
                  />
                  <input
                    aria-label={copy("End date", "Bitiş tarihi")}
                    type="date"
                    value={financeDateRange.end}
                    onChange={(event) => updateFinanceDateRange("end", event.target.value)}
                  />
                </div>
              </div>
              <div className="finance-kpis">
                <span>{copy("Estimated Revenue", "Tahmini Ciro")} <strong>₺28.7M</strong></span>
                <span>{copy("Estimated Cost", "Tahmini Maliyet")} <strong>₺24.5M</strong></span>
                <span>{copy("Net Profit", "Net Kâr")} <strong>₺4.2M</strong></span>
              </div>
              <div className="finance-chart" aria-hidden="true">
                <svg viewBox="0 0 420 180">
                  <path className="chart-grid" d="M20 30 H400 M20 75 H400 M20 120 H400 M20 165 H400" />
                  <path className="chart-line" d="M24 154 L58 138 L82 146 L108 112 L136 120 L166 92 L194 104 L226 72 L256 86 L286 54 L316 66 L346 42 L392 48" />
                  <path className="chart-dash" d="M316 66 L346 68 L376 62 L400 70" />
                </svg>
              </div>
              <div className="risk-list">
                <span>{copy("FX effect", "Kur etkisi")} <strong>-₺1.2M</strong></span>
                <span>{copy("Supply pressure", "Tedarik baskısı")} <strong>+₺0.8M</strong></span>
                <span>{copy("Energy advantage", "Enerji avantajı")} <strong>+₺2.1M</strong></span>
              </div>
            </article>
          </div>

          <section className="insight-strip" aria-label="AI insights">
            <div className="card-heading">
              <div>
                <span>{copy("AI insights", "AI içgörüleri")}</span>
                <h2>{copy("Live recommendations", "Canlı öneriler")}</h2>
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
                  <span>{copy("Review details", "Detayları incele")}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-detail-page dashboard-section-block" aria-label="Risk, profitability, and current status">
            <div className="detail-heading">
              <span>{copy("Risk and margin control", "Risk ve marj kontrolü")}</span>
              <h1>Riskler, karlılık ve mevcut durum</h1>
              <p>{copy("A focused view for the risks that can affect delivery promises, margin, and today's production health.", "Termin sözünü, marjı ve bugünün üretim sağlığını etkileyebilecek riskler için odaklanmış görünüm.")}</p>
            </div>

            <div className="command-stat-grid">
              {[
                { label: copy("Open Risk", "Açık Risk"), value: "7", delta: copy("3 critical", "3 kritik"), detail: copy("requires decision", "karar bekliyor") },
                { label: copy("Net Profit", "Net Kâr"), value: "₺4.2M", delta: "+10%", detail: copy("vs plan", "plana göre") },
                { label: copy("Margin Risk", "Marj Riski"), value: "-₺1.2M", delta: copy("FX", "Kur"), detail: copy("main pressure", "ana baskı") },
                { label: copy("Current Status", "Mevcut Durum"), value: "78%", delta: copy("healthy", "sağlıklı"), detail: copy("capacity usage", "kapasite kullanımı") },
              ].map((stat, index) => (
                <article className={`command-card stat-card stat-card-${index + 1}`} key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <small>{stat.delta} {stat.detail}</small>
                </article>
              ))}
            </div>

            <div className="command-main-grid">
              <article className="command-card risk-focus-card">
                <div className="card-heading">
                  <div>
                    <span>{copy("Risk register", "Risk kayıtları")}</span>
                    <h2>{copy("Priority watchlist", "Öncelikli takip listesi")}</h2>
                  </div>
                </div>
                <div className="risk-list risk-detail-list">
                  {dashboardInsights.slice(0, 4).map((item) => (
                    <span key={item.title}>
                      {item.title}
                      <strong>{item.tone === "clay" ? copy("High", "Yüksek") : item.tone === "amber" ? copy("Medium", "Orta") : copy("Controlled", "Kontrollü")}</strong>
                    </span>
                  ))}
                </div>
              </article>

              <article className="command-card finance-card">
                <div className="card-heading">
                  <div>
                    <span>{copy("Profitability", "Karlılık")}</span>
                    <h2>{copy("Today's margin bridge", "Bugünün marj köprüsü")}</h2>
                  </div>
                </div>
                <div className="finance-kpis">
                  <span>{copy("Estimated Revenue", "Tahmini Ciro")} <strong>₺28.7M</strong></span>
                  <span>{copy("Estimated Cost", "Tahmini Maliyet")} <strong>₺24.5M</strong></span>
                  <span>{copy("Net Profit", "Net Kâr")} <strong>₺4.2M</strong></span>
                </div>
                <div className="risk-list">
                  <span>{copy("FX effect", "Kur etkisi")} <strong>-₺1.2M</strong></span>
                  <span>{copy("Supply pressure", "Tedarik baskısı")} <strong>+₺0.8M</strong></span>
                  <span>{copy("Energy advantage", "Enerji avantajı")} <strong>+₺2.1M</strong></span>
                </div>
              </article>
            </div>
          </section>

          <section className="dashboard-detail-page dashboard-section-block" aria-label="Short summary">
            <div className="detail-heading">
              <span>{copy("Executive snapshot", "Yönetici özeti")}</span>
              <h1>Kısa özet</h1>
              <p>{copy("The few signals worth reading before the next production or finance decision.", "Bir sonraki üretim ya da finans kararından önce okunması gereken kısa sinyaller.")}</p>
            </div>

            <div className="summary-grid">
              {[
                [copy("Production", "Üretim"), copy("Daily output is above plan, but LINE-4 remains the main watch point.", "Günlük çıktı planın üstünde, ancak LINE-4 ana takip noktası.")],
                [copy("Profitability", "Karlılık"), copy("Net profit holds at ₺4.2M with energy savings offsetting FX pressure.", "Net kâr ₺4.2M seviyesinde; enerji avantajı kur baskısını dengeliyor.")],
                [copy("Risk", "Risk"), copy("Supplier delay on EK-22 can affect delivery promises unless a backup route is selected.", "EK-22 tedarik gecikmesi alternatif rota seçilmezse termin sözlerini etkileyebilir.")],
                [copy("Recommendation", "Öneri"), copy("Keep the 3-shift model active and review material allocation before the next quote.", "3 vardiya modelini aktif tutun ve sıradaki teklif öncesi malzeme dağılımını gözden geçirin.")],
              ].map(([title, summary]) => (
                <article className="command-card summary-card" key={title}>
                  <span>{title}</span>
                  <p>{summary}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="dashboard-logo-row" aria-label={copy("Company and Atera logos", "Şirket ve Atera logoları")}>
            <div className="customer-logo-mark" aria-label="ARKAS METAL logo">
              <strong>AM</strong>
              <span>ARKAS METAL</span>
            </div>
            <div className="atera-logo-mark" aria-label="Atera logo">
              <img src={logoUrl} alt="" />
              <span>Atera</span>
            </div>
          </div>
        </section>,
    );
  }

  if (session && path === "/dashboard/riskler-karlilik-mevcut-durum") {
    goTo("/dashboard", "login");
    return null;
  }

  if (session && path === "/dashboard/kisa-ozet") {
    goTo("/dashboard", "login");
    return null;
  }

  if (session && (activeModule || isOperationsRoute || isProductPlusRoute || isFinancialRoute || isSimulationRoute)) {
    if (path === "/operations") {
      goTo("/operations/data-entry", "login");
      return null;
    }

    if (isOperationsRoute && !activeOperationsSubmodule) {
      goTo(["/operations/material-definitions", "/operations/human-resources"].includes(path) ? "/operations/resources" : "/operations/data-entry", "login");
      return null;
    }

    if (path === "/product-plus") {
      goTo("/product-plus/product-tree", "login");
      return null;
    }

    if (isProductPlusRoute && !activeProductPlusSubmodule) {
      goTo("/product-plus/product-tree", "login");
      return null;
    }

    if (activeOperationsSubmodule?.key === "data-entry") {
      return renderDashboardLayout(
        `operations/${activeOperationsSubmodule.key}`,
          <section className="operations-workspace operations-modern">
            <div className="operations-header">
              <div>
                <span>Operations / {copy("Process Definition", "Süreç Tanımlama")}</span>
                <h1>{copy("Process Definition", "Süreç Tanımlama")}</h1>
              </div>
              <div className="operations-actions">
                <button type="button" onClick={loadOperationsData}>{copy("Refresh Data", "Verileri Yenile")}</button>
              </div>
            </div>
            {renderOperationPlanner()}
          </section>,
      );
    }

    if (activeOperationsSubmodule?.key === "resources") {
      return renderResourcesPage();
    }

    if (activeOperationsSubmodule?.key === "active-processes") {
      return renderActiveProcessesPage();
    }

    if (activeOperationsSubmodule?.key === "machines-equipment") {
      return renderOperationDataPage({
        columns: [
          { header: copy("Machine", "Makine"), render: (row) => row.name },
          { header: copy("Price", "Fiyat"), render: (row) => formatLira(row.price) },
          { header: copy("Hourly Energy", "Saatlik Enerji"), render: (row) => `${formatNumber(row.hourly_energy_consumption_kwh, 2)} kWh` },
        ],
        description: copy("Keep only the name, price, and hourly energy consumption for the machine selected in production.", "Sadece üretimde seçilecek makinenin adını, fiyatını ve saatlik enerji tüketimini tutun."),
        entity: "machine",
        fields: [
          { name: "name", label: copy("Machine name", "Makine adı") },
          { name: "price", label: copy("Machine price", "Makine fiyatı"), step: "0.01", type: "number" },
          { name: "hourlyEnergyConsumptionKwh", label: copy("Hourly energy consumption", "Saatlik enerji tüketimi"), step: "0.01", type: "number" },
        ],
        rows: operationsWorkspace.machines,
        title: copy("Machines & Equipment", "Makine & Ekipman"),
      });
    }

    if (activeOperationsSubmodule?.key === "products") {
      return renderProductDataPage();
    }

    if (activeProductPlusSubmodule?.key === "product-tree") {
      return renderDashboardLayout(
        `product-plus/${activeProductPlusSubmodule.key}`,
          <section className="operations-workspace">
            <div className="operations-header">
              <div>
                <span>{copy("Product Tree / Product Detail", "Ürün Ağacı / Ürün Detayı")}</span>
                <h1>{operationsWorkspace.product?.name || copy("Operational Definition", "Operasyonel Tanımlama")}</h1>
              </div>
              <div className="operations-actions">
                <button type="button">{copy("Back", "Geri")}</button>
                <button type="button">{copy("Copy", "Kopyala")}</button>
                <button type="button">{copy("Revision History", "Revizyon Geçmişi")}</button>
                <button type="button" className="primary">{copy("Edit", "Düzenle")}</button>
              </div>
            </div>

            <div className="operations-tabs" role="tablist" aria-label={copy("Operation detail tabs", "Operasyon detay sekmeleri")}>
              {[
                copy("General Information", "Genel Bilgiler"),
                copy("Technical Specs", "Teknik Özellikler"),
                copy("Materials & Components", "Malzeme & Bileşenler"),
                copy("Operation Sequence", "Operasyon Sırası"),
                copy("Process Flow", "Süreç Akışı"),
                copy("Quality", "Kalite"),
                copy("Documents", "Dokümanlar"),
                copy("Notes", "Notlar"),
              ].map((tab, index) => (
                <button type="button" className={index === 0 ? "active" : ""} key={tab}>{tab}</button>
              ))}
            </div>

            <div className="operations-grid">
              <article className="operation-card part-visual-card">
                <div className="part-blueprint" aria-label={copy("Gasket technical visual", "Conta teknik görseli")}>
                  <div className="gasket-shape">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="part-status-row">
                  <span>{copy("Weight", "Ağırlık")} <strong>{operationsWorkspace.product?.weight_kg || "-"}kg</strong></span>
                  <span>{copy("Size", "Boyut")} <strong>{operationsWorkspace.product?.dimensions || "-"}</strong></span>
                  <span>{copy("Material", "Malzeme")} <strong>{operationsWorkspace.product?.material_name || "-"}</strong></span>
                  <span>{copy("Quality", "Kalite")} <strong>{operationsWorkspace.product?.quality_grade || "-"}</strong></span>
                  <span>{copy("Cycle", "Çevrim")} <strong>{operationsWorkspace.product?.cycle_time_seconds || "-"} {copy("sec", "sn")}</strong></span>
                </div>
              </article>

              <article className="operation-card part-info-card">
                <div className="part-title">
                  <span>{operationsWorkspace.product?.status || copy("Active", "Aktif")}</span>
                  <h2>{operationsWorkspace.product?.product_code || "CONTA-0478-A"}</h2>
                </div>
                <dl>
                  <div><dt>{copy("Product Code", "Ürün Kodu")}</dt><dd>{operationsWorkspace.product?.product_code || "-"}</dd></div>
                  <div><dt>{copy("Product Name", "Ürün Adı")}</dt><dd>{operationsWorkspace.product?.name || "-"}</dd></div>
                  <div><dt>{copy("Product Group", "Ürün Grubu")}</dt><dd>{operationsWorkspace.product?.product_group || "-"}</dd></div>
                  <div><dt>{copy("Revision", "Revizyon")}</dt><dd>{operationsWorkspace.product?.revision || "-"}</dd></div>
                  <div><dt>{copy("Status", "Durum")}</dt><dd>{operationsWorkspace.product?.status || "-"}</dd></div>
                  <div><dt>{copy("Created Date", "Oluşturma Tarihi")}</dt><dd>{operationsWorkspace.product?.created_at ? new Date(operationsWorkspace.product.created_at).toLocaleDateString(locale) : "-"}</dd></div>
                  <div><dt>{copy("Last Update", "Son Güncelleme")}</dt><dd>{operationsWorkspace.product?.updated_at ? new Date(operationsWorkspace.product.updated_at).toLocaleString(locale) : "-"}</dd></div>
                  <div><dt>{copy("Description", "Açıklama")}</dt><dd>{operationsWorkspace.product?.description || "-"}</dd></div>
                </dl>
              </article>

              <article className="operation-card machine-card">
                <div className="operation-card-heading">
                  <h2>{copy("Machine Pool", "Makine Havuzu")}</h2>
                  <span>{copy("Machine pool", "Makine havuzu")}</span>
                </div>
                <div className="machine-table">
                  <div className="machine-row machine-head"><span>{copy("Machine", "Makine")}</span><span>{copy("Price", "Fiyat")}</span><span>{copy("Energy", "Enerji")}</span><span>{copy("Status", "Durum")}</span></div>
                  {operationsWorkspace.machines.map((machine) => (
                    <div className="machine-row" key={machine.id}>
                      <strong>{machine.name}</strong>
                      <span>{formatLira(machine.price)}</span>
                      <span>{formatNumber(machine.hourly_energy_consumption_kwh, 2)} {copy("kWh/hour", "kWh/saat")}</span>
                      <mark className="ok">{copy("Defined", "Tanımlı")}</mark>
                    </div>
                  ))}
                </div>
              </article>

              <article className="operation-card technical-card">
                <h2>{copy("Technical Specs", "Teknik Özellikler")}</h2>
                <div className="technical-grid">
                  {[
                    [copy("Thickness", "Kalınlık"), "1.20 mm"],
                    [copy("Hole Diameter", "Çap Delik"), "82.00 mm"],
                    [copy("Hole Count", "Delik Sayısı"), "4"],
                    [copy("Compression", "Sıkıştırılma"), "0.35 mm"],
                    [copy("Steel Grade", "Çelik Sınıfı"), "316"],
                    [copy("Operating Temperature", "Çalışma Sıcaklığı"), "-40 / +300°C"],
                    [copy("Max Pressure", "Maks. Basınç"), "120 bar"],
                    [copy("Surface Coating", "Yüzey Kaplama"), copy("Uncoated", "Kaplamasız")],
                    [copy("Test Pressure", "Test Basıncı"), "90 bar"],
                    [copy("Surface Quality", "Yüzey Kalitesi"), copy("Uncoated", "Kaplamasız")],
                  ].map(([label, value]) => (
                    <div key={label}><span>{label}</span><strong>{value}</strong></div>
                  ))}
                </div>
              </article>

              <article className="operation-card finance-impact-card">
                <div className="operation-card-heading">
                  <h2>{copy("Financial Impact", "Finansal Etki")}</h2>
                  <select defaultValue="mayıs">
                    <option value="mayıs">{copy("May 2024", "Mayıs 2024")}</option>
                    <option value="haziran">{copy("June 2024", "Haziran 2024")}</option>
                    <option value="ceyrek">{copy("This quarter", "Bu çeyrek")}</option>
                  </select>
                </div>
                <div className="impact-kpis">
                  <span>{copy("Unit Sale Price", "Birim Satış Fiyatı")} <strong>₺45,00</strong></span>
                  <span>{copy("Daily Cost", "Günlük Maliyet")} <strong>{operationPlanResult ? formatLira(operationPlanResult.totalTrackedDailyCost) : "-"}</strong></span>
                  <span>{copy("Unit Profit", "Birim Kâr")} <strong>₺17,65</strong></span>
                  <span>{copy("Profit Margin", "Kâr Marjı")} <strong>39.2%</strong></span>
                </div>
                <div className="impact-body">
                  <div className="donut-chart" aria-hidden="true"><span>{operationPlanResult ? formatLira(operationPlanResult.totalTrackedDailyCost) : "-"}</span></div>
                  <div className="monthly-impact">
                    <span>{copy("Product", "Ürün")} <strong>{operationPlanResult?.productName || "-"}</strong></span>
                    <span>{copy("Estimated Revenue", "Tahmini Ciro")} <strong>₺1.10M</strong></span>
                    <span>{copy("Estimated Cost", "Tahmini Maliyet")} <strong>{operationPlanResult ? formatLira(operationPlanResult.totalTrackedDailyCost) : "-"}</strong></span>
                    <span>{copy("Net Profit Margin", "Net Kâr Marjı")} <strong>39.2%</strong></span>
                  </div>
                </div>
              </article>

              <article className="operation-card notes-card">
                <div className="operation-card-heading">
                  <h2>{copy("Notes", "Notlar")}</h2>
                  <button type="button">{copy("New Note", "Yeni Not")}</button>
                </div>
                {(operationsWorkspace.notes.length ? operationsWorkspace.notes : [{ id: "empty", note: copy("No product note yet.", "Henüz ürün notu yok."), created_at: new Date().toISOString() }]).map((note) => (
                  <p key={note.id}>{new Date(note.created_at).toLocaleDateString(locale)}: {note.note}</p>
                ))}
              </article>
            </div>

            <article className="operation-card operation-flow">
              <div className="operation-card-heading">
                <h2>{copy("Operation Flow", "Operasyon Akışı")}</h2>
                <button type="button">{copy("View Flow Diagram", "Akış Diyagramını Gör")}</button>
              </div>
              <div className="flow-steps">
                {operationSteps.map((name, index) => ({ id: name, step_order: index + 1, name, station: index % 2 === 0 ? copy("Laser Cutting", "Lazer Kesim") : copy("Process", "Proses") })).map((step) => (
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
              <span>{copy("Operations placeholder", "Operations boş durum")}</span>
              <h1>{activeOperationsSubmodule.label}</h1>
              <p>{copy("This subpage is prepared under the Operations module. Content and business logic will be added later.", "Bu alt sayfa Operations modülü altında hazırlandı. İçerik ve iş mantığı daha sonra eklenecek.")}</p>
            </div>
            <div className="placeholder-grid">
              <article>
                <strong>{copy("Submodule", "Alt Modül")}</strong>
                <p>{copy("The screen structure for", "Ekran yapısı")} {activeOperationsSubmodule.label} {copy("will be developed here.", "için burada geliştirilecek.")}</p>
              </article>
              <article>
                <strong>{copy("Status", "Durum")}</strong>
                <p>{copy("For now, only frontend routing and the empty state screen are available.", "Şimdilik sadece frontend routing ve boş durum ekranı mevcut.")}</p>
              </article>
            </div>
          </section>,
      );
    }

    if (path === "/financial-modelling") {
      goTo("/financial-modelling/maliyet-hesaplama/urun-maliyeti", "login");
      return null;
    }

    if (isFinancialRoute && !activeFinancialSubmodule) {
      goTo("/financial-modelling/maliyet-hesaplama/urun-maliyeti", "login");
      return null;
    }

    if (activeModule?.key === "financial-modelling" || activeFinancialSubmodule) {
      return renderFinancialModellingPage();
    }

    if (isSimulationRoute) {
      if (path === "/simulation" || !activeSimulationVariant) {
        goTo("/simulation/current-situation", "login");
        return null;
      }

      return renderSimulationPage();
    }

    if (activeModule?.key === "sales-strategy") {
      return renderSalesStrategyPage();
    }

    if (activeModule?.key === "simulation") {
      return renderDashboardLayout(
        activeModule.key,
          <section className="simulation-workspace">
            <div className="simulation-header">
              <div>
                <span>ARKAS METAL / {copy("Automotive Gasket Production", "Otomotiv Conta Üretimi")}</span>
                <h1>{copy("Simulation & Scenario Analysis", "Simülasyon & Senaryo Analizi")}</h1>
                <p>{copy("See the outcome before making a decision.", "Karar vermeden önce sonucu görün.")}</p>
              </div>
              <button type="button" className="primary">{copy("Run Simulation", "Simülasyonu Çalıştır")}</button>
            </div>

            <div className="scenario-management">
              <article className="scenario-choice active"><span>{copy("Good Scenario", "İyi Senaryo")}</span><strong>85/100</strong><p>{copy("Demand increase, efficiency improvement, and energy optimization.", "Talep artışı, verimlilik iyileşmesi ve enerji optimizasyonu.")}</p></article>
              <article className="scenario-choice"><span>{copy("Medium Scenario", "Orta Senaryo")}</span><strong>60/100</strong><p>{copy("Production target under current conditions.", "Mevcut koşullarda üretim hedefi.")}</p></article>
              <article className="scenario-choice warning"><span>{copy("Bad Scenario", "Kötü Senaryo")}</span><strong>30/100</strong><p>{copy("Cost increase, demand decline, and efficiency loss.", "Maliyet artışı, talep düşüşü ve verim kaybı.")}</p></article>
              <button type="button" className="new-scenario">+ {copy("New Scenario", "Yeni Senaryo")}</button>
            </div>

            <div className="simulation-tabs" role="tablist" aria-label={copy("Simulation tabs", "Simülasyon sekmeleri")}>
              {[copy("Scenario Setup", "Senaryo Kurulumu"), copy("Production Impact", "Üretim Etkisi"), copy("Financial Impact", "Finansal Etki"), copy("Comparison", "Karşılaştırma"), copy("Sensitivity Analysis", "Duyarlılık Analizi")].map((tab, index) => (
                <button type="button" className={index === 0 ? "active" : ""} key={tab}>{tab}</button>
              ))}
            </div>

            <div className="simulation-grid">
              <aside className="simulation-card parameter-card">
                <h2>{copy("Scenario Parameters", "Senaryo Parametreleri")}</h2>
                <p>{copy("Change the parameters below to see the scenario effect.", "Aşağıdaki parametreleri değiştirerek senaryo etkisini görün.")}</p>
                {simulationParameters.map(([label, value], index) => (
                  <label className="sim-slider" key={label}>
                    <span>{label}<strong>{value}{index < 5 ? "%" : ""}</strong></span>
                    <input type="range" min="-30" max="30" defaultValue={index === 5 ? 10 : Number.parseInt(value, 10) || 0} />
                  </label>
                ))}
                <div className="scenario-version">
                  <span>{copy("Scenario", "Senaryo")}</span>
                  <select defaultValue="best"><option value="best">{copy("Good Scenario", "İyi Senaryo")}</option><option value="base">{copy("Medium Scenario", "Orta Senaryo")}</option><option value="bad">{copy("Bad Scenario", "Kötü Senaryo")}</option></select>
                </div>
                <button type="button" className="wide-action">{copy("Update Scenario", "Senaryoyu Güncelle")}</button>
              </aside>

              <main className="simulation-main">
                <article className="simulation-card production-impact">
                  <div className="simulation-card-heading">
                    <div><span>{copy("Production Impact", "Üretim Etkisi")}</span><h2>{copy("Scenario impact on production performance", "Senaryonun üretim performansına etkisi")}</h2></div>
                  </div>
                  <div className="impact-summary">
                    <span>{copy("Total Production", "Toplam Üretim")} <strong>27.850 {copy("pcs", "adet")}</strong><small>+15.2%</small></span>
                    <span>{copy("Capacity Usage", "Kapasite Kullanımı")} <strong>86%</strong><small>+8.1%</small></span>
                    <span>{copy("Average OEE", "Ortalama OEE")} <strong>78.3%</strong><small>+10.1%</small></span>
                    <span>{copy("Cycle Time", "Çevrim Süresi")} <strong>45.2 {copy("sec", "sn")}</strong><small>-8.4%</small></span>
                  </div>
                  <div className="line-impact-table">
                    <div className="line-impact-row line-impact-head"><span>{copy("Line", "Hat")}</span><span>{copy("Capacity", "Kapasite")}</span><span>{copy("Production", "Üretim")}</span><span>OEE</span><span>{copy("Bottleneck Risk", "Darboğaz Riski")}</span></div>
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
                  <h2>{copy("Production Flow Simulation", "Üretim Akışı Simülasyonu")}</h2>
                  <div className="flow-impact-grid">
                    {[copy("Raw Material", "Hammadde"), copy("Cutting", "Kesim"), copy("Forming", "Şekillendirme"), copy("Coating", "Kaplama"), copy("Inspection", "Kontrol"), copy("Packaging", "Paketleme")].map((step, index) => (
                      <div className={index === 3 ? "flow-impact-item risk" : "flow-impact-item"} key={step}>
                        <strong>{step}</strong>
                        <span>{[18500, 27300, 24000, 22950, 27050, 26030][index]} {copy("pcs", "adet")}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </main>

              <aside className="simulation-side">
                <article className="simulation-card sim-financial">
                  <div className="simulation-card-heading">
                    <h2>{copy("Financial Impact (Summary)", "Finansal Etki (Özet)")}</h2>
                    <select defaultValue="try"><option value="try">TRY</option><option value="usd">USD</option></select>
                  </div>
                  <div className="sim-financial-table">
                    {[copy("Net Sales", "Net Satışlar"), copy("Gross Profit", "Brüt Kâr"), "FAVÖK", copy("Net Profit", "Net Kâr"), copy("Cash Flow", "Nakit Akışı"), copy("Net Profit Margin", "Net Kâr Marjı")].map((item, index) => (
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
                  <div className="simulation-card-heading"><h2>{copy("Scenario Comparison", "Senaryo Karşılaştırma")}</h2><button type="button">{copy("Critical Pains", "Kritik Ağrılar")}</button></div>
                  <div className="compare-table">
                    <div><span>{copy("Total Score", "Toplam Skor")}</span><strong>100%</strong><b>85</b><b>60</b><b>30</b></div>
                    <div><span>{copy("Cash Flow", "Nakit Akışı")}</span><strong>20%</strong><b>80</b><b>58</b><b>22</b></div>
                    <div><span>{copy("Operational Risk", "Operasyonel Risk")}</span><strong>15%</strong><b>88</b><b>60</b><b>23</b></div>
                    <div><span>{copy("Investment Need", "Yatırım İhtiyacı")}</span><strong>10%</strong><b>90</b><b>58</b><b>20</b></div>
                  </div>
                </article>
              </aside>
            </div>

            <div className="simulation-bottom">
              <article className="simulation-card"><h2>{copy("AI Recommendation", "AI Önerisi")}</h2><p>{copy("The good scenario may require investment in week 3 due to bottleneck risk. Capacity control is recommended for the EK-22 line.", "İyi senaryo 3. haftada darboğaz riski nedeniyle yatırım gerektirebilir. EK-22 hattı için kapasite kontrolü önerilir.")}</p><button type="button">{copy("Detailed Analysis", "Detaylı Analiz")}</button></article>
              <article className="simulation-card"><h2>{copy("Critical Findings", "Kritik Bulgular")}</h2><p>{copy("LINE-3 may become a bottleneck. Energy consumption creates a 12% advantage. The 3-shift model increases profitability.", "LINE-3 hattı darboğaz olabilir. Enerji tüketiminde %12 avantaj oluşuyor. 3 vardiya modeli kârlılığı artırıyor.")}</p></article>
              <article className="simulation-card risk-card"><h2>{copy("Risk Alerts", "Risk Uyarıları")}</h2><p>{copy("Raw material price increase and capacity stress are approaching critical levels in the simulation.", "Hammadde fiyatındaki artış ve kapasite stresi simülasyonda kritik seviyeye yaklaşıyor.")}</p><button type="button">{copy("View All Risks", "Tüm Riskleri Gör")}</button></article>
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
                <span>ARKAS METAL / {copy("Automotive Gasket Production", "Otomotiv Conta Üretimi")}</span>
                <h1>{copy("Reports", "Raporlar")}</h1>
                <p>{copy("Analyze your performance, discover insights, and make the right decisions.", "Performansınızı analiz edin, içgörüleri keşfedin ve doğru kararlar alın.")}</p>
              </div>
            </div>

            <div className="reports-tabs" role="tablist" aria-label={copy("Report types", "Rapor türleri")}>
              {[copy("All Reports", "Tüm Raporlar"), copy("Production Reports", "Üretim Raporları"), copy("Financial Reports", "Finansal Raporlar"), copy("Sales Reports", "Satış Raporları"), copy("Capacity Reports", "Kapasite Raporları"), copy("Maintenance Reports", "Bakım Raporları"), copy("Custom Reports", "Özel Raporlar")].map((tab, index) => (
                <button type="button" className={index === 0 ? "active" : ""} key={tab}>{tab}</button>
              ))}
            </div>

            <div className="reports-controls">
              <label><span>{copy("Search reports", "Rapor ara")}</span><input placeholder={copy("Search reports...", "Rapor ara...")} /></label>
              <button type="button">{copy("Filters", "Filtreler")}</button>
              <select defaultValue="may"><option value="may">{copy("May 01, 2024 - May 31, 2024", "01 Mayıs 2024 - 31 Mayıs 2024")}</option><option value="q2">Q2 2024</option></select>
              <button type="button" className="primary">{copy("Export", "Dışa Aktar")}</button>
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
                <h2>{copy("Distribution by Report Category", "Rapor Kategorilerine Göre Dağılım")}</h2>
                <div className="distribution-body">
                  <div className="donut-chart report-donut" aria-hidden="true"><span>32<small>{copy("Total", "Toplam")}</small></span></div>
                  <div className="report-category-list">
                    {[copy("Production Reports", "Üretim Raporları"), copy("Financial Reports", "Finansal Raporlar"), copy("Sales Reports", "Satış Raporları"), copy("Capacity Reports", "Kapasite Raporları"), copy("Maintenance Reports", "Bakım Raporları"), copy("Custom Reports", "Özel Raporlar")].map((item, index) => (
                      <span key={item}>{item}<strong>{[37, 23, 15, 10, 6, 4][index]}%</strong></span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="reports-card usage-card">
                <div className="reports-card-heading"><h2>{copy("Report Usage Trend", "Rapor Kullanım Trendi")}</h2><select defaultValue="daily"><option value="daily">{copy("Daily", "Günlük")}</option><option value="weekly">{copy("Weekly", "Haftalık")}</option></select></div>
                <svg className="reports-trend" viewBox="0 0 620 230" aria-hidden="true">
                  <path className="chart-grid" d="M30 42 H590 M30 92 H590 M30 142 H590 M30 192 H590" />
                  <path className="trend-line sales" d="M34 166 L72 146 L108 156 L146 126 L184 142 L222 118 L260 132 L298 104 L336 122 L374 92 L412 110 L450 82 L488 102 L526 76 L586 54" />
                  <path className="trend-line gross" d="M34 188 L72 176 L108 168 L146 160 L184 156 L222 148 L260 142 L298 132 L336 126 L374 120 L412 114 L450 106 L488 96 L526 90 L586 72" />
                  <path className="trend-line net" d="M34 204 L72 202 L108 198 L146 196 L184 194 L222 190 L260 192 L298 184 L336 186 L374 178 L412 182 L450 174 L488 176 L526 170 L586 164" />
                </svg>
              </article>

              <article className="reports-card recent-reports-card">
                <div className="reports-card-heading"><h2>{copy("Recent Reports", "Son Raporlar")}</h2><button type="button">{copy("View All", "Tümünü Gör")}</button></div>
                <div className="recent-report-table">
                  <div className="recent-report-row report-head"><span>{copy("Report Name", "Rapor Adı")}</span><span>{copy("Category", "Kategori")}</span><span>{copy("Created Date", "Oluşturulma Tarihi")}</span><span>{copy("Period", "Dönem")}</span><span>{copy("Created By", "Oluşturan")}</span><span>{copy("Actions", "İşlemler")}</span></div>
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
                  <div className="reports-card-heading"><h2>{copy("Automated Report Schedule", "Otomatik Rapor Takvimi")}</h2><button type="button">{copy("View All", "Tümünü Gör")}</button></div>
                  {[copy("Daily Production Summary", "Günlük Üretim Özeti"), copy("Weekly Financial Summary", "Haftalık Finansal Özet"), copy("Monthly Management Report", "Aylık Yönetim Raporu"), copy("Monthly Profitability Analysis", "Aylık Karlılık Analizi")].map((item, index) => (
                    <div className="schedule-row" key={item}>
                      <strong>{item}</strong>
                      <span>{[copy("Every day 08:00", "Her gün 08:00"), copy("Every Monday 09:00", "Her Pazartesi 09:00"), copy("1st day of each month 10:00", "Her ayın 1. günü 10:00"), copy("5th day of each month 10:30", "Her ayın 5. günü 10:30")][index]}</span>
                      <mark>{copy("Active", "Aktif")}</mark>
                    </div>
                  ))}
                </article>

                <article className="reports-card quick-report-card">
                  <h2>{copy("Create Quick Report", "Hızlı Rapor Oluştur")}</h2>
                  <div className="quick-report-grid">
                    {[copy("Production Report", "Üretim Raporu"), copy("Financial Summary", "Finansal Özet"), copy("Sales Analysis", "Satış Analizi"), copy("Capacity Analysis", "Kapasite Analizi"), copy("Custom Report", "Özel Rapor")].map((item) => (
                      <button type="button" key={item}>{item}</button>
                    ))}
                  </div>
                </article>
              </aside>
            </div>
          </section>,
      );
    }

    if (activeModule.key === "human-resources-plus") {
      return renderDashboardLayout(
        activeModule.key,
          <section className="module-placeholder">
            <div>
              <span>{copy("Workforce module", "İnsan kaynağı modülü")}</span>
              <h1>{activeModule.label}</h1>
              <p>{copy("This workspace is ready for workforce definitions, skills, labor capacity, and planning across operations.", "Bu çalışma alanı iş gücü tanımları, yetkinlikler, işçilik kapasitesi ve operasyon geneli planlama için hazırlandı.")}</p>
            </div>
            <div className="placeholder-grid">
              <article>
                <strong>{copy("Workforce Planning", "İş Gücü Planlama")}</strong>
                <p>{copy("Connect roles, operators, and capacity needs to production workflows.", "Rolleri, operatörleri ve kapasite ihtiyaçlarını üretim iş akışlarına bağlayın.")}</p>
              </article>
              <article>
                <strong>{copy("Status", "Durum")}</strong>
                <p>{copy("Frontend routing is active; data tables and business logic can be added next.", "Frontend routing aktif; veri tabloları ve iş mantığı sonraki adımda eklenebilir.")}</p>
              </article>
            </div>
          </section>,
      );
    }

    return renderDashboardLayout(
      activeModule.key,
        <section className="module-placeholder">
          <div>
            <span>{copy("Module placeholder", "Modül boş durumu")}</span>
            <h1>{activeModule.label}</h1>
            <p>{copy("This module is visible in the dashboard navigation and is ready for its frontend workflow.", "Bu modül dashboard navigasyonunda görünür ve frontend iş akışı için hazırdır.")}</p>
          </div>
          <div className="placeholder-grid">
            <article>
              <strong>{copy("Workspace", "Çalışma Alanı")}</strong>
              <p>{copy("Empty state for upcoming tools, tables, and decision screens.", "Yakında eklenecek araçlar, tablolar ve karar ekranları için boş durum.")}</p>
            </article>
            <article>
              <strong>{copy("Status", "Durum")}</strong>
              <p>{copy("No backend, database, or algorithm behavior is connected yet.", "Henüz backend, veritabanı veya algoritma davranışı bağlanmadı.")}</p>
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
                              <span>{getModuleLabel(module)}</span>
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
              <span>{copy("Commodity Workspace", "Emtia Çalışma Alanı")}</span>
            </div>
          </div>

          <div className="auth-controls">
            <label className="language-picker">
              <span>{labels.language}</span>
              <select value={form.language} onChange={(event) => updateField("language", event.target.value)}>
                <option value="en">EN</option>
                <option value="tr">TR</option>
              </select>
            </label>
            <ThemeToggle />
          </div>
        </header>

        <div className="avatar-zone">
          <div className="avatar">
            {profilePreview ? <img src={profilePreview} alt={copy("Profile preview", "Profil önizlemesi")} /> : <span>{initials}</span>}
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
                  aria-label={showPassword ? labels.hidePassword : labels.showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? labels.hide : labels.show}
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
                  aria-label={showConfirmPassword ? labels.hidePassword : labels.showPassword}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? labels.hide : labels.show}
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
                  aria-label={showPassword ? labels.hidePassword : labels.showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? labels.hide : labels.show}
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
                    <option value="user">{copy("User", "Kullanıcı")}</option>
                    <option value="manager">{copy("Manager", "Yönetici")}</option>
                    <option value="admin">{copy("Admin", "Admin")}</option>
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
