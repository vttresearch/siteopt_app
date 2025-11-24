// Try to use runtime config first, fall back to build-time config
export const API_BASE = window.__APP_CONFIG__?.API_BASE || import.meta.env.VITE_API_BASE || '';
