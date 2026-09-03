// Controlled component tests only; never aliased by the production Vite config.
let listener;
const auth = { currentUser: null };
const control = {
  loginCalls: 0, logoutCalls: 0, tokenRequests: [],
  loginMode: "success", logoutMode: "success", tokenMode: "success",
  login: null, logout: null, tokens: [],
  emit(email) {
    auth.currentUser = email ? {
      uid: email, email,
      getIdToken(force = false) {
        control.tokenRequests.push({ email, force });
        if (control.tokenMode === "pending") return new Promise((resolve) => control.tokens.push(() => resolve(`token:${email}`)));
        return Promise.resolve(`token:${email}`);
      },
    } : null;
    listener?.(auth.currentUser);
  },
};
globalThis.adminTestAuth = control;
export const getAuth = () => auth;
export const onAuthStateChanged = (_auth, callback) => {
  listener = callback;
  queueMicrotask(() => listener?.(auth.currentUser));
  return () => { listener = undefined; };
};
export const signInWithEmailAndPassword = async (_auth, email) => {
  control.loginCalls += 1;
  if (control.loginMode === "pending") await new Promise((resolve, reject) => { control.login = { resolve, reject }; });
  // Match Firebase: notify the auth listener before the promise resolves.
  control.emit(email);
};
export const signOut = async () => {
  control.logoutCalls += 1;
  if (control.logoutMode === "pending") await new Promise((resolve, reject) => { control.logout = { resolve, reject }; });
  if (control.logoutMode === "failure") throw new Error("controlled_signout_failure");
  if (control.logoutMode === "cleared-failure") {
    auth.currentUser = null;
    throw new Error("controlled_signout_persistence_failure");
  }
  control.emit(null);
};
