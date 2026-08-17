"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";

/**
 * Public self-service signup is closed: members are created by admins, and the
 * user pool sets AdminCreateUserConfig.AllowAdminCreateUserOnly, so Cognito
 * rejects public SignUp calls outright.
 *
 * The route is kept as a redirect rather than deleted so an existing bookmark
 * lands on the sign-in page instead of a CloudFront 404. The app is a static
 * export, so there is no middleware to do this server-side.
 */
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
