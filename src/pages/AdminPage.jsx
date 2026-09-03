import { useEffect, useRef, useState } from "react";
import {
  adminApiOrigin,
  adminAuthEmulatorOrigin,
  adminFirebaseConfig,
  getAdminConfigurationError,
} from "../adminConfig";
import { buildAdminReportView } from "../adminReportView";
import { AdminWorkspace } from "../components/AdminWorkspace";
import "../../admin.css";
import { Brand } from "../components/Brand";

const TIMEOUT = 12_000;
const next = { open: "in_review", in_review: "resolved", resolved: "closed" };
const labels = {
  in_review: "Rozpocznij analizę",
  resolved: "Oznacz jako rozwiązane",
  closed: "Zamknij zgłoszenie",
};
const idOf = (report) =>
  typeof report?.clientSubmissionId === "string"
    ? report.clientSubmissionId
    : "";
const message = (status, write) =>
  status === 401 || status === 403
    ? "Dostęp administratora został odrzucony. Odśwież kolejkę po sprawdzeniu konta."
    : status === 404
      ? "Zgłoszenie nie jest już dostępne. Odśwież kolejkę przed kolejną zmianą."
      : status === 409
        ? "Stan zgłoszenia zmienił się na serwerze. Odśwież kolejkę przed kolejną zmianą."
        : write
          ? "Wynik zapisu jest niepewny. Odśwież kolejkę przed kolejną zmianą."
          : "Nie udało się odczytać kolejki zgłoszeń.";

function Report({ report, disabled, writing, transition }) {
  const view = buildAdminReportView(report);
  const target = next[report.status];
  return (
    <article className="admin-report">
      <h3>{view.heading}</h3>
      <p>{view.description}</p>
      <dl>
        {view.fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {target && (
        <button
          className="button button-secondary admin-report-action"
          type="button"
          disabled={disabled || writing}
          onClick={() => transition(report, target)}
        >
          {writing ? "Zapisywanie…" : labels[target]}
        </button>
      )}
    </article>
  );
}

export function AdminPage() {
  const [configError] = useState(() =>
    getAdminConfigurationError(adminFirebaseConfig, adminApiOrigin, {
      development: import.meta.env.DEV,
      authEmulatorOrigin: adminAuthEmulatorOrigin,
      hostname: globalThis.location?.hostname,
    }),
  );
  const [initializationState, setInitializationState] = useState(() =>
    configError ? "error" : "loading",
  );
  const [initializationError, setInitializationError] = useState("");
  const [actions, setActions] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authKind, setAuthKind] = useState("");
  const [queue, setQueue] = useState([]);
  const [queueStatus, setQueueStatus] = useState("");
  const [queueKind, setQueueKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [writingId, setWritingId] = useState("");
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [authPending, setAuthPending] = useState(null);
  const generation = useRef(0);
  const authOperation = useRef(null);
  const active = useRef(false);
  const controller = useRef(null);
  const valid = (value) => generation.current === value;
  const invalidate = () => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    active.current = false;
  };
  const runOperation = async (work) => {
    const current = new AbortController();
    controller.current = current;
    let rejectTimeout;
    const timeout = new Promise((_, reject) => {
      rejectTimeout = reject;
    });
    const timer = setTimeout(() => {
      current.abort("timeout");
      rejectTimeout(new Error("admin_operation_timeout"));
    }, TIMEOUT);
    try {
      return await Promise.race([work(current.signal), timeout]);
    } finally {
      clearTimeout(timer);
    }
  };
  const load = async (currentUser, currentGeneration, forceRefresh = false) => {
    if (!currentUser || active.current || !valid(currentGeneration)) return;
    active.current = true;
    setBusy(true);
    setWritingId("");
    setQueueStatus("Odczytywanie kolejki…");
    setQueueKind("");
    setRefreshRequired(true);
    let failureMessage = "Nie udało się odczytać kolejki zgłoszeń. Spróbuj ponownie.";
    try {
      const { response, payload } = await runOperation(async (signal) => {
        const token = await currentUser.getIdToken(forceRefresh);
        const response = await fetch(
          `${adminApiOrigin.replace(/\/$/u, "")}/v1/admin/content-reports`,
          { headers: { authorization: `Bearer ${token}` }, signal },
        );
        return { response, payload: await response.json().catch(() => null) };
      });
      if (!valid(currentGeneration)) return;
      const reportsValid = Array.isArray(payload?.reports)
        && payload.reports.every((report) => idOf(report) && Object.hasOwn(next, report?.status))
        && new Set(payload.reports.map(idOf)).size === payload.reports.length;
      if (!response.ok || !reportsValid) {
        if (response.status === 401 || response.status === 403) setQueue([]);
        setRefreshRequired(true);
        failureMessage = message(response.status);
        throw new Error("admin_read_failed");
      }
      setQueue(payload.reports);
      setRefreshRequired(false);
      setQueueStatus(
        payload.reports.length
          ? `Odczytano ${payload.reports.length} zgłoszeń.`
          : "Kolejka jest pusta.",
      );
      setQueueKind("success");
    } catch (error) {
      if (
        !valid(currentGeneration) ||
        (error?.name === "AbortError" &&
          controller.current?.signal.reason !== "timeout")
      )
        return;
      setQueueStatus(
        error?.message === "admin_operation_timeout"
          ? "Przekroczono czas odczytu kolejki. Spróbuj ponownie."
          : failureMessage,
      );
      setQueueKind("warning");
    } finally {
      if (valid(currentGeneration)) {
        active.current = false;
        controller.current = null;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    if (configError) return undefined;
    let disposed = false;
    let unsubscribe = () => {};
    void (async () => {
      try {
        const [
          { getApps, getApp, initializeApp },
          { getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, signOut },
        ] = await Promise.all([
          import("firebase/app"),
          import("firebase/auth"),
        ]);
        if (disposed) return;
        const app = getApps().length ? getApp() : initializeApp(adminFirebaseConfig);
        if (app.options.projectId !== adminFirebaseConfig.projectId) {
          throw new Error("admin_firebase_environment_changed");
        }
        const auth = getAuth(app);
        if (adminAuthEmulatorOrigin) {
          const configured = new URL(adminAuthEmulatorOrigin);
          const existing = auth.emulatorConfig;
          if (existing && (existing.protocol !== "http"
            || existing.host !== configured.hostname
            || (existing.port ?? 80) !== Number(configured.port || 80))) {
            throw new Error("admin_auth_emulator_changed");
          }
          if (!existing) connectAuthEmulator(auth, adminAuthEmulatorOrigin);
        } else if (auth.emulatorConfig) {
          throw new Error("admin_auth_emulator_unexpected");
        }
        setActions({ auth, signInWithEmailAndPassword, signOut });
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          if (disposed) return;
          invalidate();
          const currentGeneration = generation.current;
          if (!authOperation.current) setAuthPending(null);
          setInitializationState("ready");
          setUser(currentUser);
          setEmail("");
          setPassword("");
          setQueue([]);
          setBusy(false);
          setWritingId("");
          setRefreshRequired(false);
          if (!currentUser) {
            setQueueStatus("");
            setAuthStatus(authOperation.current?.kind === "logout" ? "Wylogowano." : "Zaloguj się kontem administratora.");
            setAuthKind("");
            return;
          }
          setAuthStatus("");
          setAuthKind("success");
          void load(currentUser, currentGeneration);
        });
      } catch {
        if (!disposed) {
          setInitializationError(
            "Panel jest niedostępny: nie udało się uruchomić Firebase Authentication. Sprawdź konfigurację i przeładuj stronę.",
          );
          setInitializationState("error");
        }
      }
    })();
    return () => {
      disposed = true;
      authOperation.current = null;
      invalidate();
      unsubscribe();
    };
  }, [configError]);
  const refresh = () => {
    if (user && !busy && authPending === null && !authOperation.current) void load(user, generation.current, true);
  };
  const transition = async (report, status) => {
    const currentGeneration = generation.current;
    const reportId = idOf(report);
    if (
      !user ||
      authOperation.current ||
      authPending !== null ||
      !reportId ||
      next[report.status] !== status ||
      busy ||
      refreshRequired ||
      active.current
    )
      return;
    active.current = true;
    setBusy(true);
    setWritingId(reportId);
    setQueueStatus("Zapisywanie zmiany statusu…");
    setQueueKind("");
    let failureMessage = "Wynik zapisu jest niepewny. Odśwież kolejkę przed kolejną zmianą.";
    try {
      const { response, payload } = await runOperation(async (signal) => {
        const token = await user.getIdToken();
        const response = await fetch(
          `${adminApiOrigin.replace(/\/$/u, "")}/v1/admin/content-reports/${encodeURIComponent(reportId)}`,
          {
            method: "PATCH",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ status }),
            signal,
          },
        );
        return { response, payload: await response.json().catch(() => null) };
      });
      if (!valid(currentGeneration)) return;
      const confirmed =
        response.ok &&
        idOf(payload?.report) === reportId &&
        payload.report.status === status;
      if (!confirmed) {
        if (response.status === 401 || response.status === 403) setQueue([]);
        setRefreshRequired(true);
        failureMessage = response.ok
            ? "Serwer nie potwierdził oczekiwanej zmiany. Odśwież kolejkę przed kolejną zmianą."
            : message(response.status, true);
        throw new Error("admin_transition_unconfirmed");
      }
      setQueue((current) =>
        status === "closed"
          ? current.filter((entry) => idOf(entry) !== reportId)
          : current.map((entry) =>
              idOf(entry) === reportId ? payload.report : entry,
            ),
      );
      setQueueStatus(
        status === "closed"
          ? "Zgłoszenie zamknięto i usunięto z kolejki."
          : "Status zmieniono na serwerze.",
      );
      setQueueKind("success");
    } catch (error) {
      if (
        !valid(currentGeneration) ||
        (error?.name === "AbortError" &&
          error?.message !== "admin_operation_timeout")
      )
        return;
      setRefreshRequired(true);
      setQueueStatus(
        error?.message === "admin_operation_timeout"
          ? "Wynik zapisu jest niepewny po przekroczeniu czasu. Odśwież kolejkę przed kolejną zmianą."
          : failureMessage,
      );
      setQueueKind("warning");
    } finally {
      if (valid(currentGeneration)) {
        active.current = false;
        controller.current = null;
        setBusy(false);
        setWritingId("");
      }
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!actions || authOperation.current || authPending !== null) return;
    const credentials = { email: email.trim(), password };
    const operation = { kind: "login", generation: generation.current };
    authOperation.current = operation;
    setAuthPending(operation.kind);
    setAuthStatus("Logowanie…");
    setAuthKind("");
    setEmail("");
    setPassword("");
    try {
      await actions.signInWithEmailAndPassword(
        actions.auth,
        credentials.email,
        credentials.password,
      );
    } catch {
      if (authOperation.current !== operation || !valid(operation.generation)) return;
      setPassword("");
      setAuthStatus("Logowanie nie powiodło się.");
      setAuthKind("warning");
    } finally {
      if (authOperation.current === operation) {
        authOperation.current = null;
        setAuthPending(null);
      }
    }
  };
  const signOut = async () => {
    if (!actions || authOperation.current) return;
    invalidate();
    const operation = { kind: "logout", generation: generation.current };
    authOperation.current = operation;
    setAuthPending(operation.kind);
    setBusy(false);
    setEmail("");
    setPassword("");
    setQueue([]);
    setQueueStatus("");
    setWritingId("");
    setRefreshRequired(true);
    setAuthStatus("Wylogowywanie…");
    setAuthKind("");
    try {
      await actions.signOut(actions.auth);
      if (authOperation.current === operation && valid(operation.generation) && actions.auth.currentUser === null) {
        setUser(null);
        setAuthStatus("Wylogowano.");
      }
    } catch {
      if (authOperation.current !== operation || !valid(operation.generation)) return;
      operation.failed = true;
      setUser(actions.auth.currentUser);
      setAuthStatus(
        "Nie udało się wylogować. Spróbuj ponownie — sesja może nadal być aktywna.",
      );
      setAuthKind("warning");
    } finally {
      if (authOperation.current === operation) {
        authOperation.current = null;
        setAuthPending(operation.failed ? "logout-failed" : null);
      }
    }
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        Przejdź do treści
      </a>
      <header className="site-header admin-header">
        <div className="header-inner">
          <Brand ariaLabel="Patternly — strona główna" /><span className="admin-header-label">Administracja</span>
        </div>
      </header>
      <main
        id="main-content"
        className="section-shell admin-shell"
        tabIndex={-1}
        aria-busy={!configError && (initializationState === "loading" || busy)}
      >
        <section className={`admin-hero ${user ? "admin-hero-signed-in" : ""}`} aria-labelledby="admin-title">
          <div className="admin-heading">
            <p className="eyebrow">PATTERNLY / ADMINISTRACJA</p>
            <h1 id="admin-title">Centrum administracyjne</h1>
          </div>
          {configError ? (
            <div
              className="admin-unavailable"
              aria-labelledby="admin-unavailable-title"
            >
              <p className="admin-state-label" id="admin-unavailable-title">
                Stan panelu: niedostępny
              </p>
              <div className="admin-status admin-status-warning" role="alert">
                {configError}
              </div>
              <p className="admin-unavailable-copy">
                Logowanie i kolejka zgłoszeń nie są dostępne bez tej
                konfiguracji wdrożeniowej.
              </p>
              <a className="button button-secondary admin-recovery" href="/">
                Wróć na stronę główną
              </a>
            </div>
          ) : (
            <div className="admin-controls">
              {initializationState !== "error" && !user && (
                <p className="lead">
                  Zaloguj się, aby przeglądać pytania, monitorować użycie aplikacji i obsługiwać zgłoszenia.
                </p>
              )}
              {initializationState === "loading" && (
                <div className="admin-status" role="status">
                  Ładowanie mechanizmu logowania…
                </div>
              )}
              {initializationState === "ready" && !user && (authPending === null || authPending === "login") && (
                <form className="admin-form" onSubmit={submit}>
                  <label htmlFor="admin-email">Adres e-mail</label>
                  <input
                    id="admin-email"
                    autoComplete="username"
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <label htmlFor="admin-password">Hasło</label>
                  <input
                    id="admin-password"
                    autoComplete="current-password"
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={authPending !== null}
                  >
                    {authPending === "login" ? "Logowanie…" : "Zaloguj się"}
                  </button>
                </form>
              )}
              {initializationState === "error" && (
                <div className="admin-status admin-status-warning" role="alert">
                  {initializationError}
                </div>
              )}
              {authStatus && (
                <div
                  className={`admin-status ${authKind ? `admin-status-${authKind}` : ""}`.trim()}
                  role="status"
                >
                  {authStatus}
                </div>
              )}
              {(user || authPending === "logout-failed") && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={signOut}
                  disabled={authPending === "login" || authPending === "logout"}
                >
                  {authPending === "logout-failed" ? "Ponów wylogowanie" : "Wyloguj się"}
                </button>
              )}
            </div>
          )}
        </section>
        {!configError && user && authPending !== "logout" && authPending !== "logout-failed" && (
          <AdminWorkspace user={user} reports={queue} reportsReady={queueKind === "success" && !refreshRequired}>
          <section className="admin-queue" aria-labelledby="queue-title">
            <div className="section-heading">
              <p className="eyebrow">JAKOŚĆ TREŚCI</p>
              <h2 id="queue-title">Zgłoszenia oczekujące</h2>
              <p>Przejrzyj uwagi użytkowników i śledź ich rozwiązanie.</p>
            </div>
            <button
              className="button button-secondary admin-refresh"
              type="button"
              onClick={refresh}
              disabled={busy || authPending !== null}
            >
              Odśwież kolejkę
            </button>
            {queueStatus && (
              <div
                className={`admin-status ${queueKind ? `admin-status-${queueKind}` : ""}`.trim()}
                role={queueKind === "warning" ? "alert" : "status"}
              >
                {queueStatus}
              </div>
            )}
            <div className="admin-report-list">
              {queue.map((report) => (
                <Report
                  key={idOf(report)}
                  report={report}
                  transition={transition}
                  disabled={busy || refreshRequired || authPending !== null}
                  writing={writingId === idOf(report)}
                />
              ))}
            </div>
          </section>
          </AdminWorkspace>
        )}
      </main>
    </>
  );
}
