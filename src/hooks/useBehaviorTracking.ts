/**
 * useBehaviorTracking.ts
 * ─────────────────────────────────────────────────────────────
 * React Hook — wraps BehaviorTracker for easy use in components
 *
 * PLACE THIS FILE AT: src/hooks/useBehaviorTracking.ts
 *
 * Usage inside any component:
 *
 *   const { trackStroke, trackErase, getSummary } = useBehaviorTracking();
 *
 * ─────────────────────────────────────────────────────────────
 */

import { useCallback } from "react";
import { getTracker } from "@/lib/behaviorTracker";
import type { BehaviorSummary } from "@/lib/behaviorTracker";

export function useBehaviorTracking() {
  const tracker = (() => {
    try { return getTracker(); }
    catch { return null; }
  })();

  const trackStroke = useCallback(
    (strokeData?: { tool?: string; length?: number }) => {
      tracker?.trackDrawingStroke(strokeData);
    },
    [tracker]
  );

  const trackErase = useCallback(() => {
    tracker?.trackDrawingErase();
  }, [tracker]);

  const trackClear = useCallback(() => {
    tracker?.trackDrawingClear();
  }, [tracker]);

  const trackScratchpad = useCallback(() => {
    tracker?.trackScratchpadEdit();
  }, [tracker]);

  const trackHint = useCallback(() => {
    tracker?.trackHintRequest();
  }, [tracker]);

  const trackTutorOpen = useCallback(() => {
    tracker?.trackTutorOpen();
  }, [tracker]);

  const trackTutorClose = useCallback(() => {
    tracker?.trackTutorClose();
  }, [tracker]);

  const trackAnswer = useCallback(
    (isCorrect: boolean, value?: string) => {
      tracker?.trackAnswer(isCorrect, value);
    },
    [tracker]
  );

  const getSummary = useCallback(
    (questionId?: string): BehaviorSummary | null => {
      return tracker?.getSummary(questionId) ?? null;
    },
    [tracker]
  );

  return {
    trackStroke,
    trackErase,
    trackClear,
    trackScratchpad,
    trackHint,
    trackTutorOpen,
    trackTutorClose,
    trackAnswer,
    getSummary,
  };
}