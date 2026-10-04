import { useLayoutEffect, useMemo, useRef } from "react";
import { adminApiOrigin } from "./adminConfig";

export const ADMIN_REQUEST_TIMEOUT_MS = 12_000;

const pendingOperations = new Map();

function operationKey({ domain, resource, effect }) {
  return JSON.stringify([adminApiOrigin.replace(/\/$/u, ""), domain, resource, effect]);
}

export function markAdminOperationPending(operation) {
  const key = operationKey(operation);
  if (!pendingOperations.has(key)) pendingOperations.set(key, Object.freeze({ ...operation, key }));
  return key;
}

export function clearAdminOperation(operation) {
  pendingOperations.delete(typeof operation === "string" ? operation : operation.key || operationKey(operation));
}

export function pendingAdminOperations(domain, resource) {
  return [...pendingOperations.values()].filter((operation) => operation.domain === domain
    && (operation.resource === resource || operation.resource === "*"));
}

export function isAdminMutationBlocked(domain, resource, excludedEffects = []) {
  const excluded = new Set(excludedEffects);
  return pendingAdminOperations(domain, resource).some((operation) => !excluded.has(operation.effect));
}

export function sha256Text(value) {
  if (typeof globalThis.crypto?.subtle?.digest !== "function") throw new Error("admin_digest_unavailable");
  return globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
}

export class AdminRequestError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "AdminRequestError";
    Object.assign(this, details);
  }
}

export async function requestAdminJson(user, path, options = {}, lifecycle = {}) {
  const controller = new AbortController();
  const externalSignal = lifecycle.signal;
  let dispatched = false;
  let timeoutId;
  let cancelReject;
  if (externalSignal?.aborted || lifecycle.isCurrent?.() === false) {
    throw new AdminRequestError("admin_request_cancelled", { kind: "cancelled", dispatched: false });
  }
  const cancellation = new Promise((_, reject) => { cancelReject = reject; });
  const cancel = (reason = "cancelled") => {
    if (!controller.signal.aborted) controller.abort(reason);
    cancelReject(new AdminRequestError("admin_request_cancelled", { kind: "cancelled", dispatched }));
  };
  const onExternalAbort = () => cancel(externalSignal.reason || "cancelled");
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  const work = (async () => {
    const { forceRefresh = false, ...fetchOptions } = options;
    let token;
    try {
      token = await user.getIdToken(forceRefresh === true);
    } catch (cause) {
      throw new AdminRequestError("admin_token_failed", { kind: "token", dispatched: false, cause });
    }
    if (controller.signal.aborted || lifecycle.isCurrent?.() === false) {
      throw new AdminRequestError("admin_request_cancelled", { kind: "cancelled", dispatched: false });
    }

    const headers = new Headers(fetchOptions.headers || {});
    headers.set("authorization", `Bearer ${token}`);
    if (fetchOptions.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    lifecycle.onDispatched?.();
    dispatched = true;
    let response;
    try {
      response = await fetch(`${adminApiOrigin.replace(/\/$/u, "")}${path}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
    } catch (cause) {
      throw new AdminRequestError("admin_fetch_failed", { kind: "fetch", dispatched, cause });
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch (cause) {
      if (controller.signal.aborted) throw new AdminRequestError("admin_request_cancelled", { kind: "cancelled", dispatched, cause });
      payload = null;
    }
    if (!response.ok) {
      throw new AdminRequestError("admin_http_error", {
        kind: "http", dispatched, status: response.status, code: payload?.error?.code, payload,
      });
    }
    if (controller.signal.aborted || lifecycle.isCurrent?.() === false) {
      throw new AdminRequestError("admin_request_cancelled", { kind: "cancelled", dispatched: true });
    }
    return payload;
  })();

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) controller.abort("timeout");
      reject(new AdminRequestError("admin_operation_timeout", { kind: "timeout", dispatched }));
    }, lifecycle.timeoutMs || ADMIN_REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout, cancellation]);
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

export function useAdminRequestLifecycle(user) {
  const userRef = useRef(user);
  userRef.current = user;
  const stateRef = useRef({ uid: user?.uid, generation: 0, mounted: false, controllers: new Set() });
  useLayoutEffect(() => {
    const current = stateRef.current;
    current.generation += 1;
    current.uid = user?.uid;
    current.mounted = true;
    const generation = current.generation;
    return () => {
      if (stateRef.current.generation !== generation) return;
      stateRef.current.mounted = false;
      stateRef.current.generation += 1;
      for (const controller of stateRef.current.controllers) controller.abort("cancelled");
      stateRef.current.controllers.clear();
    };
  }, [user?.uid]);

  return useMemo(() => ({
    capture() {
      return Object.freeze({ uid: user?.uid, generation: stateRef.current.generation });
    },
    isCurrent(lease) {
      return stateRef.current.mounted && stateRef.current.uid === lease.uid
        && stateRef.current.generation === lease.generation;
    },
    async request(path, options, lease, onDispatched) {
      const controller = new AbortController();
      stateRef.current.controllers.add(controller);
      try {
        return await requestAdminJson(userRef.current, path, options, {
          signal: controller.signal,
          isCurrent: () => this.isCurrent(lease),
          onDispatched,
        });
      } finally {
        stateRef.current.controllers.delete(controller);
      }
    },
  }), [user?.uid]);
}
