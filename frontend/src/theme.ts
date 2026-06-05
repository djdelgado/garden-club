import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: {
      main: "#4a7c59",
      dark: "#2d4a32",
      light: "#6aab7a",
      contrastText: "#ffffff",
    },
    warning: { main: "#c98a1a" },
    background: { default: "#f9f6f0", paper: "#ffffff" },
    text: { primary: "#2d4a32", secondary: "#6a7d6c", disabled: "#8a9e8d" },
    divider: "#d4e0c8",
  },
  typography: {
    h1: { fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700 },
    h2: { fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700 },
    h3: { fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 600 },
    h4: { fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: "none", fontWeight: 600 } },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: "0 2px 12px rgba(74,124,89,0.06)" },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 20 } } },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(249,246,240,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #d4e0c8",
        },
      },
    },
  },
});
