const config = window.PATTERNLY_ADMIN_CONFIG;
const apiOrigin = window.PATTERNLY_ADMIN_API_ORIGIN;
const configUnavailable = document.querySelector("#admin-config-unavailable");
const loginForm = document.querySelector("#admin-login");
const authStatus = document.querySelector("#admin-auth-status");
const signOutButton = document.querySelector("#admin-sign-out");
const queue = document.querySelector("#admin-queue");
const queueStatus = document.querySelector("#admin-queue-status");
const queueList = document.querySelector("#admin-queue-list");

function showStatus(element, message, kind = "") {
  element.hidden = false;
  element.className = `admin-status ${kind ? `admin-status-${kind}` : ""}`;
  element.textContent = message;
}

function isFirebaseConfig(value) {
  return value && typeof value === "object" && typeof value.apiKey === "string" && typeof value.authDomain === "string" && typeof value.projectId === "string" && typeof value.appId === "string";
}

function renderReport(report) {
  const article = document.createElement("article");
  article.className = "admin-report";
  const heading = document.createElement("h3");
  heading.textContent = `${report.reason} · ${report.status}`;
  const description = document.createElement("p");
  description.textContent = report.description;
  const identity = document.createElement("dl");
  for (const [label, value] of [
    ["Element", report.itemId],
    ["Ścieżka", report.trackId],
    ["Wydanie", report.context.releasePackageId],
    ["Powierzchnia", report.context.modeRoute],
    ["Węzeł", report.context.trackNode ?? "niedostępny"],
    ["Utworzono", report.createdAt],
  ]) {
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value;
    identity.append(term, detail);
  }
  article.append(heading, description, identity);
  return article;
}

async function loadQueue(user) {
  showStatus(queueStatus, "Odczytywanie kolejki…");
  queueList.replaceChildren();
  const token = await user.getIdToken();
  const response = await fetch(`${apiOrigin.replace(/\/$/u, "")}/v1/admin/content-reports`, { headers: { authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => null);
  if (response.status === 403) throw new Error("Backend odrzucił dostęp administratora.");
  if (!response.ok || !payload || !Array.isArray(payload.reports)) throw new Error("Nie udało się odczytać kolejki zgłoszeń.");
  if (payload.reports.length === 0) {
    showStatus(queueStatus, "Kolejka jest pusta.", "success");
    return;
  }
  queueList.append(...payload.reports.map(renderReport));
  showStatus(queueStatus, `Odczytano ${payload.reports.length} zgłoszeń.`, "success");
}

async function start() {
  if (!isFirebaseConfig(config) || typeof apiOrigin !== "string" || !/^https:\/\//u.test(apiOrigin)) {
    configUnavailable.hidden = false;
    return;
  }
  try {
    const [{ getApps, getApp, initializeApp }, { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js"),
    ]);
    const app = getApps().length ? getApp() : initializeApp(config);
    const auth = getAuth(app);
    loginForm.hidden = false;
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.querySelector("#admin-email").value.trim();
      const password = document.querySelector("#admin-password").value;
      showStatus(authStatus, "Logowanie…");
      try {
        await signInWithEmailAndPassword(auth, email, password);
        loginForm.reset();
      } catch {
        showStatus(authStatus, "Logowanie nie powiodło się.", "warning");
      }
    });
    signOutButton.addEventListener("click", () => { void signOut(auth); });
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        queue.hidden = true;
        signOutButton.hidden = true;
        showStatus(authStatus, "Zaloguj się, aby odczytać kolejkę.");
        return;
      }
      loginForm.hidden = true;
      signOutButton.hidden = false;
      queue.hidden = false;
      showStatus(authStatus, "Tożsamość przekazana do weryfikacji backendu.", "success");
      try {
        await loadQueue(user);
      } catch (error) {
        showStatus(queueStatus, error instanceof Error ? error.message : "Odczyt kolejki jest niedostępny.", "warning");
      }
    });
  } catch {
    showStatus(configUnavailable, "Panel jest niedostępny: nie udało się załadować Firebase Authentication.", "warning");
  }
}

void start();
