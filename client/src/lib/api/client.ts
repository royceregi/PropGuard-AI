import axios from "axios";
import { isPublicPage } from "@/lib/auth/roles";
import { useAuthStore } from "@/lib/auth/store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (!isPublicPage(path)) {
        useAuthStore.getState().clearSession();
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);
