"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { fetchAuthSession } from "aws-amplify/auth";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // const session = await fetchAuthSession();
        // if (!session.tokens) {
        //   throw new Error("No active session");
        // }
        setChecking(false);
      } catch {
        router.replace("/signin");
      }
    };

    checkAuth();
  }, [router]);

  // if (checking) {
  //   return (
  //     <Box
  //       sx={{
  //         display: "flex",
  //         alignItems: "center",
  //         justifyContent: "center",
  //         minHeight: "100vh",
  //       }}
  //     >
  //       <CircularProgress />
  //     </Box>
  //   );
  // }

  return <AppShell>{children}</AppShell>;
}
