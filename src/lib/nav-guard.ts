/**
 * Double-tap navigation guard.
 *
 * A rapid double tap on a card or button fires `onPress` twice before the
 * pushed screen covers the current one, stacking two identical routes. For
 * creation flows that means two identical prefilled forms: the user creates in
 * the top one, backs into its twin, and creates again — a duplicate row.
 *
 * Each screen keeps one `lastNavRef = useRef(0)` and calls `claimNavigation`
 * before pushing; requests inside the window are dropped.
 */

import type { RefObject } from 'react';

/** Minimum gap between two pushes from the same screen. */
const NAV_GAP_MS = 800;

/**
 * Returns true when the caller may navigate, recording this attempt.
 * Returns false when the previous navigation was too recent — drop it.
 */
export const claimNavigation = (
  lastRef: RefObject<number>,
  windowMs: number = NAV_GAP_MS,
): boolean => {
  const now = Date.now();

  if (now - lastRef.current < windowMs) {
    return false;
  }

  lastRef.current = now;
  return true;
};
