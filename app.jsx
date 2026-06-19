/* =============================================================
   Nahel Ruiz — portfolio (React, sans étape de build)
   - charge data/cv-<lang>.xml selon la langue
   - le transforme en objet JS
   - l'affiche en ajoutant les attributs RDFa (schema.org/Person)
   React et ReactDOM sont fournis en UMD via CDN (globals).
   ============================================================= */

const { useState, useEffect, useCallback } = React;

/* Langues disponibles. L'ordre définit l'ordre du sélecteur. */
const LANGS = {
  fr: { dir: "ltr", file: "data/cv-fr.xml", short: "FR", name: "Français" },
  en: { dir: "ltr", file: "data/cv-en.xml", short: "EN", name: "English" },
  ar: { dir: "rtl", file: "data/cv-ar.xml", short: "ع", name: "العربية" },
};

/* ---------- Lecture / transformation du XML ---------- */

function txt(parent, tag) {
  if (!parent) return "";
  const node = parent.getElementsByTagName(tag)[0];
  return node ? node.textContent.trim() : "";
}
function children(parent, tag) {
  return parent ? Array.from(parent.getElementsByTagName(tag)) : [];
}
function bulletsOf(node) {
  return children(node, "bullet").map((b) => b.textContent.trim());
}

function parseCV(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("XML mal formé");
  }
  const root = doc.getElementsByTagName("cv")[0];
  const personEl = root.getElementsByTagName("person")[0];
  const phoneEl = personEl.getElementsByTagName("phone")[0];
  const uiEl = root.getElementsByTagName("ui")[0];

  // Libellés d'interface
  const metaLabels = {};
  children(uiEl, "metaLabel").forEach((m) => {
    metaLabels[m.getAttribute("key")] = m.textContent.trim();
  });
  const actions = {};
  children(uiEl, "action").forEach((a) => {
    actions[a.getAttribute("key")] = a.textContent.trim();
  });

  // Sections (dans l'ordre du document)
  const sections = children(root, "section").map((sec) => {
    const id = sec.getAttribute("id");
    const base = { id, title: sec.getAttribute("title") };

    if (id === "experience") {
      base.items = children(sec, "job").map((j) => ({
        role: txt(j, "role"),
        org: txt(j, "org"),
        period: txt(j, "period"),
        current: j.getAttribute("current") === "true",
        bullets: bulletsOf(j),
      }));
    } else if (id === "education") {
      base.items = children(sec, "school").map((s) => ({
        role: txt(s, "degree"),
        org: txt(s, "org"),
        period: txt(s, "period"),
        type: s.getAttribute("type") || "university",
        bullets: bulletsOf(s),
      }));
    } else if (id === "skills") {
      base.items = children(sec, "skill").map((s) => ({
        name: s.getAttribute("name"),
        desc: s.textContent.trim(),
      }));
    } else if (id === "languages") {
      base.items = children(sec, "language").map((l) => ({
        name: l.getAttribute("name"),
        level: l.getAttribute("level"),
        label: l.textContent.trim(),
      }));
    }
    return base;
  });

  return {
    person: {
      name: txt(personEl, "name"),
      headline: txt(personEl, "headline"),
      summary: txt(personEl, "summary"),
      location: txt(personEl, "location"),
      email: txt(personEl, "email"),
      phoneDisplay: phoneEl ? phoneEl.getAttribute("display") : "",
      phoneTel: phoneEl ? phoneEl.getAttribute("tel") : "",
    },
    ui: { metaLabels, actions, footer: txt(uiEl, "footer") },
    sections,
  };
}

/* ---------- Schema.org : type d'établissement pour alumniOf ---------- */
function schoolType(type) {
  return type === "highschool" ? "HighSchool" : "CollegeOrUniversity";
}

/* ---------- Composants ---------- */

function Header({ lang, onSwitch, printLabel }) {
  return (
    <header className="cv-header">
      <div className="cv-header-inner">
        <span className="brand">Nahel Ruiz<span className="brand-dot">.</span></span>
        <div className="header-tools">
          <div className="lang-switch" role="group" aria-label="Langue / Language / اللغة">
            {Object.keys(LANGS).map((code) => (
              <button
                key={code}
                type="button"
                className="lang-btn"
                aria-pressed={lang === code}
                aria-label={LANGS[code].name}
                onClick={() => onSwitch(code)}
              >
                {LANGS[code].short}
              </button>
            ))}
          </div>
          <button type="button" className="print-btn" onClick={() => window.print()}>
            {printLabel || "Print"}
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ person, labels }) {
  return (
    <section className="hero animate">
      <h1 className="hero-name" property="name">{person.name}</h1>
      <p className="hero-headline" property="jobTitle">{person.headline}</p>
      <p className="hero-summary" property="description">{person.summary}</p>

      <div className="meta">
        <span className="meta-item">
          <span className="meta-key">{labels.location || "Localisation"}</span>
          <span className="meta-val" property="address">{person.location}</span>
        </span>
        <span className="meta-item">
          <span className="meta-key">{labels.email || "Email"}</span>
          <span className="meta-val">
            <a href={`mailto:${person.email}`} property="email">{person.email}</a>
          </span>
        </span>
        <span className="meta-item">
          <span className="meta-key">{labels.phone || "Tél."}</span>
          <span className="meta-val">
            <a href={`tel:${person.phoneTel}`} property="telephone">{person.phoneDisplay}</a>
          </span>
        </span>
      </div>
    </section>
  );
}

function TimelineSection({ section, delay }) {
  const isEdu = section.id === "education";
  return (
    <section className="section animate" style={{ animationDelay: `${delay}s` }}>
      <h2 className="section-eyebrow">{section.title}</h2>
      <div className="timeline">
        {section.items.map((it, i) => {
          // RDFa : worksFor (poste actuel) / alumniOf (formation)
          let org;
          if (isEdu) {
            org = (
              <p className="entry-org" property="alumniOf" typeof={schoolType(it.type)}>
                <span property="name">{it.org}</span>
              </p>
            );
          } else if (it.current) {
            org = (
              <p className="entry-org" property="worksFor" typeof="Organization">
                <span property="name">{it.org}</span>
              </p>
            );
          } else {
            org = <p className="entry-org">{it.org}</p>;
          }

          return (
            <div className={`entry${it.current ? " is-current" : ""}`} key={i}>
              <p className="entry-period">{it.period}</p>
              <h3 className="entry-title">{it.role}</h3>
              {org}
              {it.bullets.length > 0 && (
                <ul className="entry-bullets">
                  {it.bullets.map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SkillsSection({ section, delay }) {
  return (
    <section className="section animate" style={{ animationDelay: `${delay}s` }}>
      <h2 className="section-eyebrow">{section.title}</h2>
      <div className="skills-grid">
        {section.items.map((s, i) => (
          <div className="skill" key={i}>
            <span className="skill-name" property="knowsAbout">{s.name}</span>
            <span className="skill-desc">{s.desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LanguagesSection({ section, delay }) {
  return (
    <section className="section animate" style={{ animationDelay: `${delay}s` }}>
      <h2 className="section-eyebrow">{section.title}</h2>
      <div className="langs">
        {section.items.map((l, i) => (
          <div className="lang-row" key={i}>
            <span className="lang-name" property="knowsLanguage" typeof="Language">
              <span property="name">{l.name}</span>
            </span>
            <span className="lang-level">{l.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Section({ section, delay }) {
  if (section.id === "skills") return <SkillsSection section={section} delay={delay} />;
  if (section.id === "languages") return <LanguagesSection section={section} delay={delay} />;
  return <TimelineSection section={section} delay={delay} />;
}

function ErrorState() {
  return (
    <div className="error-state">
      <p>Impossible de charger les données du CV.</p>
      <p>
        Ce site doit être <strong>servi via HTTP</strong> (et non ouvert directement
        depuis le disque). En local : <code>python3 -m http.server</code> puis ouvrez
        <code> http://localhost:8000</code>.
      </p>
      <p style={{ color: "var(--faint)" }}>
        This site must be served over HTTP, not opened from the file system.
      </p>
    </div>
  );
}

/* ---------- Application ---------- */

function App() {
  const [lang, setLang] = useState("fr");
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const conf = LANGS[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = conf.dir;

    let cancelled = false;
    setError(false);

    fetch(conf.file, { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = parseCV(text);
        setData(parsed);
        document.title = `${parsed.person.name} — ${parsed.person.headline}`;
      })
      .catch((e) => {
        console.error("Chargement du CV impossible :", e);
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [lang]);

  const onSwitch = useCallback((code) => setLang(code), []);

  if (error) return <ErrorState />;
  if (!data) return <div className="boot">Chargement…</div>;

  const printLabel = data.ui.actions.print;

  return (
    <React.Fragment>
      <Header lang={lang} onSwitch={onSwitch} printLabel={printLabel} />
      <main className="cv">
        <Hero person={data.person} labels={data.ui.metaLabels} />
        {data.sections.map((sec, i) => (
          <Section key={sec.id} section={sec} delay={0.08 + i * 0.06} />
        ))}
        <footer className="cv-footer">
          <div className="gen">{data.ui.footer}</div>
          <div className="copy">© {new Date().getFullYear()} Nahel Ruiz</div>
        </footer>
      </main>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
