"use client";

import { useState, useEffect } from "react";

/**
 * Returns `true` only once `active` has stayed truthy for at least `delay` ms.
 * Used to avoid flashing loading UI (e.g. skeletons) for fast requests.
 */
export function useDelayedFlag(active: boolean, delay = 200) {
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    if (!active) {
      setFlag(false);
      return;
    }

    const timer = setTimeout(() => setFlag(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);

  return flag;
}
