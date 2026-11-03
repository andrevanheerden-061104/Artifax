import axios from 'axios';
import { getActiveBranchId } from '../utils/workspace';

/**
 * Where the backend lives.
 * - On Vercel, set REACT_APP_API_BASE=/api so calls go through the Vercel rewrite
 *   (same website = the login cookie always works).
 * - Locally, set REACT_APP_API_BASE=http://localhost:5253 (or wherever the backend runs).
 */
const rawApiBase = process.env.REACT_APP_API_BASE || '/api';
const normalizedApiBase = rawApiBase.replace(/\/+$/, '');
export const API_BASE_URL = normalizedApiBase.endsWith('/api') ? normalizedApiBase : `${normalizedApiBase}/api`;

// One shared axios instance so the session cookie is sent with every request
const apiInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Tell the backend which warehouse we're looking at (admins only; employees are locked server-side)
apiInstance.interceptors.request.use((config) => {
  const branchId = getActiveBranchId();
  if (branchId != null) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)['X-Branch-Id'] = String(branchId);
  }
  return config;
});

/** Pulls a readable message out of an API error (the backend returns plain-text messages). */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record.message === 'string') return record.message;
      if (typeof record.title === 'string') return record.title;
    }
    if (error.response?.status === 401) return 'Your session has expired. Please log in again.';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Raw axios instance for non-React modules (services). */
export const api = apiInstance;

/** Hook version of the shared instance. */
export const useApi = () => {
  return apiInstance;
};
