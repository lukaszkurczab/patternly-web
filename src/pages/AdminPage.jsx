import { useEffect, useState } from "react";
import { getAdminConfigurationError } from "../adminConfig";
import { buildAdminReportView } from "../adminReportView";
import { Brand } from "../components/Brand";

const config = globalThis.PATTERNLY_ADMIN_CONFIG;
const apiOrigin = globalThis.PATTERNLY_ADMIN_API_ORIGIN || "";

function Report({ report }) {
  const reportView = buildAdminReportView(report);

  return (
    <article className="admin-report">
      <h3>{reportView.heading}</h3>
      <p>{reportView.description}</p>
      <dl>{reportView.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </article>
  );
}

export function AdminPage() {
  const [configError] = useState(() => getAdminConfigurationError(config, apiOrigin));
  const [initializationState, setInitializationState] = useState(() => (configError ? "error" : "loading"));
  const [initializationError, setInitializationError] = useState("");
  const [authActions, setAuthActions] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authStatusKind, setAuthStatusKind] = useState("");
  const [queue, setQueue] = useState([]);
  const [queueStatus, setQueueStatus] = useState("");
  const [queueStatusKind, setQueueStatusKind] = useState("");

  useEffect(() => {
    if (configError) return undefined;

    let disposed = false;
    let unsubscribe = () => {};

    const loadQueue = async (nextUser) => {
      setQueueStatus("Odczytywanie kolejki…");
      setQueueStatusKind("");
      setQueue([]);
      const token = await nextUser.getIdToken();
      const response = await fetch(`${apiOrigin.replace(/\/$/u, "")}/v1/admin/content-reports`, { headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      if (response.status === 403) throw new Error("Backend odrzucił dostęp administratora.");
      if (!response.ok || !payload || !Array.isArray(payload.reports)) throw new Error("Nie udało się odczytać kolejki zgłoszeń.");
      setQueue(payload.reports);
      setQueueStatus(payload.reports.length ? `Odczytano ${payload.reports.length} zgłoszeń.` : "Kolejka jest pusta.");
      setQueueStatusKind("success");
    };

    const start = async () => {
      try {
        const [{ getApps, getApp, initializeApp }, { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut }] = await Promise.all([
          import("firebase/app"),
          import("firebase/auth"),
        ]);
        if (disposed) return;
        const app = getApps().length ? getApp() : initializeApp(config);
        const auth = getAuth(app);
        setAuthActions({ auth, onAuthStateChanged, signInWithEmailAndPassword, signOut });
        setInitializationState("ready");
        unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
          if (disposed) return;
          setUser(nextUser);
          if (!nextUser) {
            setQueue([]);
            setQueueStatus("");
            setAuthStatus("Zaloguj się, aby odczytać kolejkę.");
            setAuthStatusKind("");
            return;
          }
          setAuthStatus("Tożsamość przekazana do weryfikacji backendu.");
          setAuthStatusKind("success");
          try {
            await loadQueue(nextUser);
          } catch (error) {
            setQueueStatus(error instanceof Error ? error.message : "Odczyt kolejki jest niedostępny.");
            setQueueStatusKind("warning");
          }
        });
      } catch {
        setInitializationError("Panel jest niedostępny: nie udało się załadować Firebase Authentication.");
        setInitializationState("error");
      }
    };

    void start();
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!authActions) return;
    setAuthStatus("Logowanie…");
    setAuthStatusKind("");
    try {
      await authActions.signInWithEmailAndPassword(authActions.auth, email.trim(), password);
      setEmail("");
      setPassword("");
    } catch {
      setAuthStatus("Logowanie nie powiodło się.");
      setAuthStatusKind("warning");
    }
  };

  const handleSignOut = () => {
    if (authActions) void authActions.signOut(authActions.auth);
  };

  return (
    <>
      <a className="skip-link" href="#main-content">Przejdź do treści</a>
      <header className="site-header"><div className="header-inner"><Brand ariaLabel="Patternly — strona główna" /></div></header>
      <main id="main-content" className="section-shell" tabIndex={-1} aria-busy={!configError && initializationState === "loading"}>
        <section className="admin-hero" aria-labelledby="admin-title">
          <div className="admin-heading">
            <p className="eyebrow">OGRANICZONY DOSTĘP</p>
            <h1 id="admin-title">Panel administratora</h1>
          </div>
          {configError ? (
            <div className="admin-unavailable" aria-labelledby="admin-unavailable-title">
              <p className="admin-state-label" id="admin-unavailable-title">Stan panelu: niedostępny</p>
              <div className="admin-status admin-status-warning" role="alert">{configError}</div>
              <p className="admin-unavailable-copy">Logowanie i kolejka zgłoszeń nie są dostępne bez tej konfiguracji wdrożeniowej.</p>
              <a className="button button-secondary admin-recovery" href="/">Wróć na stronę główną</a>
            </div>
          ) : (
            <div className="admin-controls">
              {initializationState !== "error" && <p className="lead">Zaloguj się kontem Firebase. Backend weryfikuje token i administratora po stronie serwera przed każdym odczytem kolejki.</p>}
              {initializationState === "loading" && <div className="admin-status" role="status">Ładowanie mechanizmu logowania…</div>}
              {initializationState === "ready" && <div className="admin-status admin-status-success" role="status">Mechanizm logowania jest gotowy.</div>}
              {initializationState === "error" && <div className="admin-status admin-status-warning" role="alert">{initializationError}</div>}
              {initializationState === "ready" && !user && <form className="admin-form" onSubmit={handleSubmit}>
                <label htmlFor="admin-email">Adres e-mail</label>
                <input id="admin-email" autoComplete="username" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                <label htmlFor="admin-password">Hasło</label>
                <input id="admin-password" autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button className="button button-primary" type="submit">Zaloguj się</button>
              </form>}
              {authStatus && <div className={`admin-status ${authStatusKind ? `admin-status-${authStatusKind}` : ""}`.trim()} role="status">{authStatus}</div>}
              {user && <button className="button button-secondary" type="button" onClick={handleSignOut}>Wyloguj się</button>}
            </div>
          )}
        </section>
        {!configError && user && <section className="admin-queue" aria-labelledby="queue-title">
          <div className="section-heading"><p className="eyebrow">KOLEJKA TRIAGE</p><h2 id="queue-title">Zgłoszenia oczekujące</h2><p>Odczyt pochodzi wyłącznie z API Patternly. Ta strona nie ma bezpośredniego dostępu do Firestore i nie nadaje uprawnień.</p></div>
          {queueStatus && <div className={`admin-status ${queueStatusKind ? `admin-status-${queueStatusKind}` : ""}`.trim()} role="status">{queueStatus}</div>}
          <div className="admin-report-list">{queue.map((report) => <Report key={`${report.itemId}-${report.createdAt}`} report={report} />)}</div>
        </section>}
      </main>
    </>
  );
}
