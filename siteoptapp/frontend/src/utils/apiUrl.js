/**
 * Utility to construct proper API URLs handling empty or "/" API_BASE
 */
import { API_BASE } from '@/config.js';

/**
 * Build a proper API URL from a path, handling various API_BASE configurations
 * @param {string} path - API path like 'api/health/' or '/api/health/'
 * @returns {string} - Properly formatted URL
 */
export function buildApiUrl(path) {
  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Handle empty or "/" API_BASE (local/same-origin requests)
  if (!API_BASE || API_BASE === '' || API_BASE === '/') {
    return `/${cleanPath}`;
  }
  
  // Remove trailing slash from API_BASE if present
  const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  
  return `${baseUrl}/${cleanPath}`;
}
