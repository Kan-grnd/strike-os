"use client";
import { useMissions as useMissionsApi } from "./useApi";
export function useMissions(options?: { poll?: boolean }) {
  return useMissionsApi(options);
}
