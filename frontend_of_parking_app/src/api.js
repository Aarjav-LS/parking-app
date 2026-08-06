const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function getSpots() {
  return fetchJSON(`${BACKEND_URL}/api/spots`);
}

export async function getStatus() {
  return fetchJSON(`${BACKEND_URL}/api/status`);
}

export async function runDetection() {
  return fetchJSON(`${BACKEND_URL}/api/detect`, { method: "POST" });
}

export async function getSettings() {
  return fetchJSON(`${BACKEND_URL}/api/settings`);
}

export async function getAnalytics() {
  return fetchJSON(`${BACKEND_URL}/api/analytics`);
}

export async function healthCheck() {
  return fetchJSON(`${BACKEND_URL}/health`);
}

export const API_BASE = BACKEND_URL;
