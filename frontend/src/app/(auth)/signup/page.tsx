"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";

// Public self-service signup is disabled — members are created by admins.
// Redirect anyone landing on /signup to the sign-in page.
export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/signin");
  }, [router]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <CircularProgress />
    </Box>
  );
}
