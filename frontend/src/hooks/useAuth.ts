"use client";

import { useState, useEffect } from "react";
import { getCurrentUser } from "aws-amplify/auth";

export interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  groups?: string[];
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser({
          userId: currentUser.userId,
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId,
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Auth error"));
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  return { user, loading, error };
}
