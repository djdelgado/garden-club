"use client";

import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Box, Container } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await fetchAuthSession();
        router.push("/home");
      } catch {
        // Not authenticated, show signup form
      }
    };

    checkAuth();
  }, [router]);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Box sx={{ width: "100%" }}>
          <Authenticator>
            {({ signOut, user }) => (
              <Box>
                <p>Welcome, {user?.username}!</p>
                <button onClick={signOut}>Sign out</button>
              </Box>
            )}
          </Authenticator>
        </Box>
      </Box>
    </Container>
  );
}
