export const API_BASE = import.meta.env.VITE_API_BASE;
export const ENABLE_AI_ASSISTANT = String(import.meta.env.VITE_ENABLE_AI_ASSISTANT ?? "false").toLowerCase() === "true";
