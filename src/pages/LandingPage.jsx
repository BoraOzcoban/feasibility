import React from "react";
import logoUrl from "../assets/atera-logo.svg";
import { PersonaAvatar } from "../components/PersonaAvatar";
import { useAppContext } from "../app/AppContext";
import AteraOrbit from "../components/AteraOrbit";
import ThemeToggle from "../components/ThemeToggle";

export default function LandingPage() {
  const { copy, form, goTo, handleUseAtera, labels, personas, references, updateField } = useAppContext();

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
          <span className="hero-eyebrow">
            {copy("The operating layer behind feasible factories", "Fizibl fabrikaların arkasındaki operasyon katmanı")}
          </span>
          <h1>{labels.heroTitle}</h1>
          <p>{labels.heroCopy}</p>
          <div className="hero-actions">
            <button type="button" className="submit-button landing-login" onClick={handleUseAtera}>
              {labels.goToLogin}
            </button>
            <a className="hero-secondary-link" href="#solutions">
              {copy("Discover the model", "Modeli keşfet")}
            </a>
          </div>
          <div className="hero-proof-strip" aria-label={copy("Atera model signals", "Atera model sinyalleri")}>
            <span>{copy("Capacity", "Kapasite")}</span>
            <span>{copy("Cash", "Nakit")}</span>
            <span>{copy("Margin", "Marj")}</span>
            <span>{copy("Delivery", "Termin")}</span>
          </div>
        </div>
        <div className="landing-hero-stage" aria-hidden="true">
          {<AteraOrbit className="hero-orbit" />}
          <div className="hero-product-card hero-product-card-main">
            <span>{copy("Decision engine", "Karar motoru")}</span>
            <strong>{copy("Feasibility live", "Fizibilite canlı")}</strong>
            <div className="hero-card-bars">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="hero-product-card hero-product-card-side">
            <span>{copy("Scenario delta", "Senaryo farkı")}</span>
            <strong>+18%</strong>
          </div>
          <div className="hero-app-chip chip-finance">FM</div>
          <div className="hero-app-chip chip-ops">OP</div>
        </div>
      </section>

      <section className="landing-sections" aria-label="Atera information">
        <article id="who" className="landing-section">
          <div className="section-kicker">
            <span>{labels.who}</span>
            <h2>{labels.who}</h2>
          </div>
          <div className="who-content">
            <div className="who-copy-block">
              <p>{labels.whoCopy}</p>
              <div className="who-signal-grid" aria-label={copy("Atera decision signals", "Atera karar sinyalleri")}>
                <span>{copy("Capacity pressure", "Kapasite baskısı")}</span>
                <span>{copy("Cash exposure", "Nakit riski")}</span>
                <span>{copy("Margin impact", "Marj etkisi")}</span>
                <span>{copy("Delivery confidence", "Termin güveni")}</span>
              </div>
            </div>
            <div className="who-visual-panel">
              {<AteraOrbit className="who-section-orbit" />}
              <div className="who-panel-caption">
                <strong>{copy("Scenario command layer", "Senaryo komuta katmanı")}</strong>
                <span>
                  {copy(
                    "From assumption to decision without spreadsheet fog.",
                    "Varsayımdan karara Excel sisine girmeden.",
                  )}
                </span>
              </div>
            </div>
          </div>
        </article>

        <article id="solutions" className="landing-section solutions-section">
          <div className="section-kicker">
            <h2>{labels.solutions}</h2>
            <p>{copy("Plan. Model. Decide. Scale.", "Planla. Modelle. Karar ver. Büyüt.")}</p>
          </div>
          <div className="solutions-content">
            <p>{labels.solutionsCopy}</p>
            <div className="solution-signal-row" aria-label={copy("Atera solution modules", "Atera çözüm modülleri")}>
              <span>{copy("Operational planning", "Operasyon planlama")}</span>
              <span>{copy("Financial feasibility", "Finansal fizibilite")}</span>
              <span>{copy("Sales simulation", "Satış simülasyonu")}</span>
            </div>
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
          <div className="section-kicker">
            <h2>{labels.references}</h2>
            <p>
              {copy(
                "One loop for the decisions that usually live apart.",
                "Genelde ayrı yaşayan kararlar için tek döngü.",
              )}
            </p>
          </div>
          <div className="references-content">
            <div className="reference-carousel" aria-label="Reference company logos">
              <div className="reference-track">
                {references.length ? (
                  [...references, ...references].map((reference, index) => (
                    <article className={`reference-logo-card ${reference.tone}`} key={`${reference.name}-${index}`}>
                      <div className="reference-mark">{reference.mark}</div>
                      <strong>{reference.name}</strong>
                    </article>
                  ))
                ) : (
                  <article className="reference-logo-card teal">
                    <div className="reference-mark">DB</div>
                    <strong>{copy("No reference records yet", "Henüz referans kaydı yok")}</strong>
                  </article>
                )}
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
            <div className="contact-card">
              <div className="contact-card-mark" aria-hidden="true">
                A
              </div>
              <address className="contact-details">
                {labels.contactPhone && (
                  <a href={`tel:${labels.contactPhone.replaceAll(" ", "")}`}>{labels.contactPhone}</a>
                )}
                <a href={`mailto:${labels.contactEmail}`}>{labels.contactEmail}</a>
                <span>{labels.contactLocation}</span>
              </address>
              <div className="contact-status" aria-hidden="true">
                <span />
                {copy("Open for onboarding conversations", "Onboarding görüşmeleri için açık")}
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
