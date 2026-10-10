"use client";
import { useTasks as useTasksApi } from "./useApi";
export function useTasks(filters?: Record<string, string>, options?: { poll?: boolean }) {
  return useTasksApi(filters, options);
}
