"use client";

import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Box, CircularProgress, Container } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function RedirectToHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/home");
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

export default function SignInPage() {
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
          <Authenticator
            formFields={{
              forceNewPassword: {
                name: {
                  label: "Full Name",
                  placeholder: "Enter your full name",
                  isRequired: true,
                  order: 1,
                },
              },
            }}
          >
            {() => <RedirectToHome />}
          </Authenticator>
        </Box>
      </Box>
    </Container>
  );
}
