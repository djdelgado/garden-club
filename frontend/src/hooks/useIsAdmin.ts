"use client";

import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export function useIsAdmin() {
  // Default to false: admin affordances stay hidden until the group check
  // resolves, rather than flashing for every visitor.
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken;
        if (idToken) {
          // Amplify decodes the JWT payload, so `cognito:groups` arrives as a
          // real array here — unlike the backend, where API Gateway renders the
          // same claim as a bracketed string ("[Admins]").
          const groups = idToken.payload["cognito:groups"];
          setIsAdmin(Array.isArray(groups) && groups.includes("Admins"));
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
