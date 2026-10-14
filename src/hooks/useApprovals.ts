"use client";
import { useApprovals as useApprovalsApi } from "./useApi";
export function useApprovals(options?: { poll?: boolean }) {
  return useApprovalsApi(options);
}
