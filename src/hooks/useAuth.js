// Sign-in state: login/reset forms, session, theme and language.
import { useEffect, useState } from "react";
import { text } from "../i18n/text";
import { emptyForm } from "../lib/appDefaults";
import { supabase } from "../lib/supabaseClient";

export function useAuth({ goTo }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(emptyForm);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useState("light");
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const labels = text[form.language] || text.en;
  const copy = (en, tr) => (form.language === "tr" ? tr : en);
  const locale = form.language === "tr" ? "tr-TR" : "en-US";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = form.language;
  }, [form.language]);

  useEffect(() => {
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

  function updateField(field, value) {
    if (field === "language") {
      if (supabase && session?.user?.id) {
        supabase
          .from("profiles")
          .update({ language: value })
          .eq("id", session.user.id)
          .then(({ error }) => {
            if (error) console.warn("Language preference could not be saved.", error);
          });
      }
    }
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";

      if (supabase && session?.user?.id) {
        supabase
          .from("profiles")
          .update({ theme: nextTheme })
          .eq("id", session.user.id)
          .then(({ error }) => {
            if (error) console.warn("Theme preference could not be saved.", error);
          });
      }

      return nextTheme;
    });
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
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (error) throw error;

      // Admins can read every profile in their company, so filter to our own.
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("language, theme")
        .eq("id", signInData.user.id)
        .maybeSingle();

      if (userProfile?.language && ["en", "tr"].includes(userProfile.language)) {
        setForm((current) => ({ ...current, language: userProfile.language }));
      }
      if (userProfile?.theme && ["light", "dark"].includes(userProfile.theme)) {
        setTheme(userProfile.theme);
      }
      // The new session moves /login on to the dashboard; any other URL stays.
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

    goTo("/login");
    setStatus(labels.passwordUpdated);
    updateField("password", "");
    setConfirmPassword("");
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    goTo("/login", { force: true });
  }

  return {
    confirmPassword,
    copy,
    form,
    handleForgotPassword,
    handleLogin,
    handleLogout,
    handleResetPassword,
    labels,
    loading,
    locale,
    mode,
    session,
    setConfirmPassword,
    setForm,
    setMode,
    setShowConfirmPassword,
    setShowPassword,
    setStatus,
    setTheme,
    showConfirmPassword,
    showPassword,
    status,
    theme,
    toggleTheme,
    updateField,
  };
}
