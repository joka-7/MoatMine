"use client";

import { api } from "./api";
import { useLoader } from "./useLoader";

export function useApi<T>(path: string | null) {
  return useLoader<T>(path ? () => api<T>(path) : null, path);
}
