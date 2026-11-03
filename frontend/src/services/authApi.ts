import axios, { AxiosResponse } from 'axios';
import { api, friendlyServerMessage } from '../hooks/useApi';
import { CurrentUser, setCurrentUser } from '../utils/currentUser';
import { resetWorkspaceSelection } from '../utils/workspace';

export type LoginRequest = {
  email: string;
  password: string;
};

export type CurrentUserResponse = {
  UserLevel?: string;
  UserEmail?: string;
  Username?: string;
  userLevel?: string;
  userEmail?: string;
  username?: string;
  employeeId?: number | null;
  branchId?: number | null;
  branchName?: string | null;
};

export type LoginEmployeeResponse = {
  /** True when a 6-digit code was emailed and must be entered next. */
  requires2FA: boolean;
  /** Masked email the code was sent to (e.g. a••••@gmail.com). */
  email?: string;
  /** Present when the account skips the code (demo accounts) — the user is already logged in. */
  user?: CurrentUserResponse;
};

export type EmployeeDetailsResponse = {
  employeeId?: number;
  employeeEmail?: string;
  employeeName?: string;
  branchId?: number;
  employeeLevel?: string;
};

export type BranchDto = {
  BranchID: number;
  BranchName: string;
};

async function withAxios<T>(request: Promise<AxiosResponse<T>>): Promise<T> {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const err = new Error(friendlyServerMessage(status, error.response?.data, `Request failed (${status ?? 'network'})`));
      (err as { status?: number }).status = status;
      throw err;
    }

    throw error;
  }
}

export function loginEmployee(payload: LoginRequest): Promise<LoginEmployeeResponse> {
  return withAxios<LoginEmployeeResponse>(
    api.post('/User/employees/login', {
      email: payload.email,
      password: payload.password,
    }),
  );
}

/**
 * Pure Session-Based Check
 * We directly ping the API. If the session cookie is valid, it returns data.
 * If the session is missing or expired, it catches the 401 error and returns null 
 * gracefully, giving the React layout a safe signal to redirect.
 */
export async function getCurrentUserFromSession(): Promise<CurrentUserResponse | null> {
  try {
    return await withAxios<CurrentUserResponse>(api.get('/User/me'));
  } catch (error: any) {
    // Catch 401 unauthenticated safely to let Router change views smoothly
    if (error?.status === 401 || error?.message?.includes('401')) {
      console.warn("No active cookie session found.");
      return null;
    }
    // Return null for any request failure during authentication verification
    return null;
  }
}

export function getEmployeeByEmail(email: string): Promise<EmployeeDetailsResponse> {
  return withAxios<EmployeeDetailsResponse>(
    api.get(`/User/employee/${encodeURIComponent(email)}`),
  );
}

export function getBranches(): Promise<BranchDto[]> {
  return withAxios<BranchDto[]>(api.get('/Branch'));
}

export function getBranchById(branchId: number): Promise<BranchDto> {
  return withAxios<BranchDto>(api.get(`/Branch/${branchId}`));
}

export function verifyLoginCode(code: string): Promise<CurrentUserResponse> {
  return withAxios<CurrentUserResponse>(api.post('/User/employees/verify-2fa', { code }));
}

export function resendLoginCode(): Promise<{ email?: string }> {
  return withAxios<{ email?: string }>(api.post('/User/employees/resend-code'));
}

/** Saves the logged-in user (from /User/me or the login response) for the rest of the app. */
export function storeSessionUser(sessionUser: CurrentUserResponse): CurrentUser {
  const email = sessionUser.UserEmail ?? sessionUser.userEmail ?? '';
  const user: CurrentUser = {
    name: sessionUser.Username ?? sessionUser.username ?? email,
    role: sessionUser.UserLevel ?? sessionUser.userLevel ?? 'Employee',
    email,
    employeeId: sessionUser.employeeId ?? undefined,
    branchId: sessionUser.branchId ?? undefined,
    branchName: sessionUser.branchName ?? undefined,
  };

  setCurrentUser(user);
  // Admins start on the "All warehouses" overview after each login.
  resetWorkspaceSelection();
  return user;
}
