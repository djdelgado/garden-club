import axios from "axios";
import { Member, CreateMemberInput, UpdateMemberInput } from "@/types/member";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api";

const MEMBER_PATH = "/members";

/**
 * Pull the human-readable message out of a failed members API call. The backend
 * returns `{ "error": "..." }` (e.g. the duplicate-email 409), so surface that
 * rather than an opaque "Request failed with status code 409".
 */
export function memberErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const apiError = (err.response?.data as { error?: string } | undefined)?.error;
    if (apiError) {
      return apiError;
    }
  }
  return fallback;
}

export const MemberService = {
  getMembers: async () => {
    return apiGet<Member[]>(MEMBER_PATH);
  },

  createMember: async (input: CreateMemberInput) => {
    return apiPost<Member>(MEMBER_PATH, input);
  },

  updateMember: async (memberId: string, input: UpdateMemberInput) => {
    return apiPut<Member>(`${MEMBER_PATH}/${memberId}`, input);
  },

  deleteMember: async (memberId: string) => {
    await apiDelete(`${MEMBER_PATH}/${memberId}`);
  },

  resendInvite: async (memberId: string) => {
    await apiPost(`${MEMBER_PATH}/${memberId}/resend-invite`, {});
  },
};
