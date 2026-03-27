import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: {
      main: "#59c744",
      light: "#87de6e",
      dark: "#33832c",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#42a835",
      light: "#59c744",
      dark: "#235622",
      contrastText: "#ffffff",
    },
    success: {
      main: "#59c744",
    },
    background: {
      default: "#f5f5f5",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(","),
    h1: {
      fontSize: "2.5rem",
      fontWeight: 700,
      color: "#1b1b1b",
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 600,
      color: "#1b1b1b",
    },
    h3: {
      fontSize: "1.5rem",
      fontWeight: 600,
      color: "#1b1b1b",
    },
    h6: {
      fontSize: "1.1rem",
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            transition: "box-shadow 0.3s ease",
          },
        },
      },
    },
  },
});
