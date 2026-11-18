"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { fetchAuthSession } from "aws-amplify/auth";

/**
 * Client-side admin guard for /admin/* routes. Nests inside the (app) auth
 * guard, so the session already exists by the time this runs — here we only
 * check group membership and bounce non-admins to /home.
 *
 * NOTE: this is a UI guard only. The app is a static export, so this file ships
 * as a fetchable static asset — the real enforcement is the API's 403 for
 * non-admins. Do not treat this as a security boundary.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.idToken?.payload["cognito:groups"];
        if (Array.isArray(groups) && groups.includes("Admins")) {
          setChecking(false);
        } else {
          router.replace("/home");
        }
      } catch {
        router.replace("/home");
      }
    };

    checkAdmin();
  }, [router]);

  if (checking) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}
