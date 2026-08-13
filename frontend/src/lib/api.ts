import axios, { AxiosInstance } from "axios";
import { fetchAuthSession } from "aws-amplify/auth";
import { API_BASE_URL } from "./constants";

let apiInstance: AxiosInstance | null = null;

// Seconds of clock skew to treat a token as expired before its real `exp`,
// so we refresh slightly early rather than sending a token that expires mid-flight.
const TOKEN_SKEW_SECONDS = 60;

// Module-level cache so concurrent API calls in the same page load reuse a
// single Cognito session lookup instead of each calling fetchAuthSession().
let cachedToken: string | null = null;
let cachedTokenExp = 0; // Unix seconds; matches the idToken `exp` claim.
let inFlightTokenLookup: Promise<string | null> | null = null;

function isCachedTokenValid(): boolean {
  const nowSeconds = Date.now() / 1000;
  return cachedToken !== null && nowSeconds < cachedTokenExp - TOKEN_SKEW_SECONDS;
}

async function getAuthToken(): Promise<string | null> {
  if (isCachedTokenValid()) {
    return cachedToken;
  }

  // Coalesce concurrent lookups so a page load that fires several calls at once
  // only triggers one fetchAuthSession().
  if (inFlightTokenLookup) {
    return inFlightTokenLookup;
  }

  inFlightTokenLookup = (async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? null;
      const exp = session.tokens?.idToken?.payload.exp;
      cachedToken = token;
      cachedTokenExp = typeof exp === "number" ? exp : 0;
      return token;
    } catch (error) {
      console.error("Failed to get auth token:", error);
      cachedToken = null;
      cachedTokenExp = 0;
      return null;
    } finally {
      inFlightTokenLookup = null;
    }
  })();

  return inFlightTokenLookup;
}

// Clear the cached token (e.g. on sign-out) so no stale token is reused.
export function clearTokenCache(): void {
  cachedToken = null;
  cachedTokenExp = 0;
  inFlightTokenLookup = null;
}

async function getApiInstance(): Promise<AxiosInstance> {
  if (apiInstance) {
    return apiInstance;
  }

  apiInstance = axios.create({
    baseURL: API_BASE_URL,
  });

  apiInstance.interceptors.request.use(async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return apiInstance;
}

export async function apiGet<T>(url: string): Promise<T> {
  const instance = await getApiInstance();
  const response = await instance.get<T>(url);
  return response.data;
}

export async function apiPost<T>(url: string, data: unknown): Promise<T> {
  const instance = await getApiInstance();
  const response = await instance.post<T>(url, data);
  return response.data;
}

export async function apiPut<T>(url: string, data: unknown): Promise<T> {
  const instance = await getApiInstance();
  const response = await instance.put<T>(url, data);
  return response.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const instance = await getApiInstance();
  const response = await instance.delete<T>(url);
  return response.data;
}
