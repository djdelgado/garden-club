"use client";

import { useState, useEffect, useCallback } from "react";
import { Member } from "@/types/member";
import { MemberService, memberErrorMessage } from "@/services/memberService";

/**
 * The signed-in member's own record (`GET /members/me`).
 *
 * `setMe` lets callers swap in the fresh record a save returns, so the page
 * updates without a second round trip.
 */
export function useMe() {
  const [me, setMe] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setMe(await MemberService.getMe());
      setError(null);
    } catch (err) {
      setError(memberErrorMessage(err, "Failed to load your profile"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { me, setMe, loading, error, reload };
}
