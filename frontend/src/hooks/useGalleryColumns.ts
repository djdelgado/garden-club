"use client";

import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

/**
 * Responsive column count for the gallery image grid.
 * Shared by `ImageGrid` and the loading skeleton so the two can't drift.
 *
 * - xs (< sm): 2 columns
 * - sm (< md): 3 columns
 * - md+:       4 columns
 */
export function useGalleryColumns(): number {
  const theme = useTheme();
  const isSmUp = useMediaQuery(theme.breakpoints.up("sm"));
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

  if (isMdUp) return 4;
  if (isSmUp) return 3;
  return 2;
}
