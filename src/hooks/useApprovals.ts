"use client";
import { useApprovals as useApprovalsApi } from "./useApi";
export function useApprovals() {
  return useApprovalsApi();
}
