import axios, { AxiosInstance } from "axios";
import { fetchAuthSession } from "aws-amplify/auth";
import { API_BASE_URL } from "./constants";

let apiInstance: AxiosInstance | null = null;

async function getApiInstance(): Promise<AxiosInstance> {
  if (apiInstance) {
    return apiInstance;
  }

  apiInstance = axios.create({
    baseURL: API_BASE_URL,
  });

  apiInstance.interceptors.request.use(async (config) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Failed to get auth token:", error);
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
