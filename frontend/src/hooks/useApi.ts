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
    // axios 1.x always provides a headers object here
    config.headers['X-Branch-Id'] = String(branchId);
  }
  return config;
});

/**
 * Turns any server reply into a short message that's safe to show users.
 * Long or technical text (stack traces, exception names) is never shown.
 */
export function friendlyServerMessage(status: number | undefined, data: unknown, fallback: string): string {
  let text = '';
  if (typeof data === 'string') text = data.trim();
  else if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.message === 'string') text = record.message.trim();
    else if (typeof record.title === 'string') text = record.title.trim();
  }

  const looksTechnical = !text || text.length > 160 || /exception|\bat [A-Z][\w.]+\(|stack|npgsql|<html/i.test(text);
  if (!looksTechnical) return text;

  if (status === undefined || status === 0) return "Can't reach the server. Check your connection and try again.";
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return "You don't have access to that.";
  if (status === 404) return "We couldn't find that.";
  if (status === 503) return 'The service is temporarily unavailable. Please try again in a moment.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return fallback;
}

/** Pulls a short, user-friendly message out of an API error. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    return friendlyServerMessage(error.response?.status, error.response?.data, fallback);
  }
  if (error instanceof Error && error.message && error.message.length <= 160) return error.message;
  return fallback;
}

/** Raw axios instance for non-React modules (services). */
export const api = apiInstance;

/** Hook version of the shared instance. */
export const useApi = () => {
  return apiInstance;
};
