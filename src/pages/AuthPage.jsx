import React from "react";
import logoUrl from "../assets/atera-logo.svg";
import { useAppContext } from "../app/AppContext";
import ThemeToggle from "../components/ThemeToggle";

export default function AuthPage() {
  const {
    confirmPassword,
    copy,
    form,
    handleForgotPassword,
    handleLogin,
    handleLogout,
    handleResetPassword,
    labels,
    loading,
    mode,
    profilePreview,
    session,
    setConfirmPassword,
    setShowConfirmPassword,
    setShowPassword,
    showConfirmPassword,
    showPassword,
    status,
    updateField,
  } = useAppContext();

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label="Atera authentication">
        <header className="brand-bar">
          <div className="brand-mark">
            <img src={logoUrl} alt="Atera logo" />
            <div>
              <strong>Atera</strong>
              <span>{copy("Production feasibility", "Üretim fizibilitesi")}</span>
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

        {profilePreview && (
          <div className="avatar-zone">
            <div className="avatar">
              <img src={profilePreview} alt={copy("Profile preview", "Profil önizlemesi")} />
            </div>
          </div>
        )}

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
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>{labels.loginEmail}</span>
              <input
                autoComplete="email"
                required
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>

            <label>
              <span>{labels.password}</span>
              <div className="password-field">
                <input
                  autoComplete="current-password"
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

            <div className="form-options">
              <span>{labels.adminProvisionedAccess}</span>
              <button type="button" className="link-button" onClick={handleForgotPassword}>
                {labels.forgot}
              </button>
            </div>

            <button className="submit-button" disabled={loading} type="submit">
              {loading ? "..." : labels.submitLogin}
            </button>
          </form>
        )}

        {status && <p className="status-message">{status}</p>}
      </section>
    </main>
  );
}
