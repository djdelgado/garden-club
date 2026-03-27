"use client";

import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken;
        if (idToken) {
          const groups = idToken.payload["cognito:groups"] as string[] | undefined;
          setIsAdmin(groups?.includes("Admins") || false);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Failed to check admin status:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, []);

  return { isAdmin, loading };
}
