/**
 * behaviorTracker.ts - Guest-enabled version
 */

import { supabase } from "./supabaseClient";
import { saveAITutorInsight } from "./edunextService";

// Types unchanged
export type EventType =
  | "session_start"
  | "session_end"
  | "question_viewed"
  | "question_answered"
  | "answer_correct"
  | "answer_incorrect"
  | "hint_requested"
  | "tutor_opened"
  | "tutor_closed"
  | "drawing_stroke"
  | "drawing_erase"
  | "drawing_clear"
  | "scratchpad_edit"
  | "long_pause"
  | "rapid_erase"
  | "concept_revisit";

export interface BehaviorEvent {
  id?: string;
  session_id: string;
  user_id: string;
  question_id: string;
  event_type: EventType;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface BehaviorSummary {
  question_id: string;
  time_spent_ms: number;
  stroke_count: number;
  erase_count: number;
  hint_count: number;
  wrong_attempts: number;
  pause_count: number;
  struggle_score: number;
  understanding_level: "struggling" | "learning" | "confident" | "mastered";
  recommended_action: "reteach" | "hint" | "encourage" | "challenge" | "none";
}

const PAUSE_THRESHOLD_MS = 30_000;
const RAPID_ERASE_WINDOW_MS = 10_000;
const RAPID_ERASE_COUNT = 3;

class BehaviorTracker {
  private sessionId: string;
  private userId: string;
  private isGuest: boolean;
  private currentQuestionId: string = "";
  private currentSubject: string = "";
  private currentTopic: string = "";
  private events: BehaviorEvent[] = [];
  private questionStartTime: number = 0;
  private lastActivityTime: number = Date.now();
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private recentErases: number[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor(userId: string) {
    this.userId = userId;
    this.sessionId = this.generateSessionId();
    this.isGuest = !userId || userId.startsWith('guest_');
  }

  startSession() {
    this.track("session_start", {});
    this.flushInterval = setInterval(() => this.flush(), 15_000);
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.endSession());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flush();
      });
    }
  }

  endSession() {
    this.track("session_end", {
      total_events: this.events.length,
      session_duration_ms: Date.now() - this.questionStartTime,
    });
    this.flush();
    if (this.flushInterval) clearInterval(this.flushInterval);
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
  }

  setQuestion(questionId: string, subject?: string, topic?: string) {
    if (this.currentQuestionId && this.currentQuestionId !== questionId) {
      this.saveSummary(this.currentQuestionId);
    }
    this.currentQuestionId = questionId;
    this.currentSubject = subject ?? "";
    this.currentTopic = topic ?? "";
    this.questionStartTime = Date.now();
    this.track("question_viewed", { question_id: questionId });
    this.resetPauseTimer();
  }

  trackAnswer(isCorrect: boolean, attemptValue?: string) {
    this.track(isCorrect ? "answer_correct" : "answer_incorrect", { attempt_value: attemptValue });
    this.markActivity();
  }

  trackHintRequest() {
    this.track("hint_requested", {});
    this.markActivity();
  }

  trackTutorOpen() {
    this.track("tutor_opened", { at_ms: Date.now() - this.questionStartTime });
    this.markActivity();
  }

  trackTutorClose() {
    this.track("tutor_closed", {});
    this.markActivity();
  }

  trackDrawingStroke(strokeData?: { tool?: string; length?: number }) {
    this.track("drawing_stroke", strokeData ?? {});
    this.markActivity();
  }

  trackDrawingErase() {
    const now = Date.now();
    this.recentErases = this.recentErases.filter(t => now - t < RAPID_ERASE_WINDOW_MS);
    this.recentErases.push(now);

    this.track("drawing_erase", {
      rapid_erase: this.recentErases.length >= RAPID_ERASE_COUNT,
    });

    if (this.recentErases.length >= RAPID_ERASE_COUNT) {
      this.track("rapid_erase", {
        erase_count: this.recentErases.length,
        window_ms: RAPID_ERASE_WINDOW_MS,
      });
    }

    this.markActivity();
  }

  trackDrawingClear() {
    this.track("drawing_clear", {});
    this.markActivity();
  }

  trackScratchpadEdit() {
    this.track("scratchpad_edit", {});
    this.markActivity();
  }

  getSummary(questionId?: string): BehaviorSummary {
    const qId = questionId ?? this.currentQuestionId;
    const qEvents = this.events.filter((e) => e.question_id === qId);

    const strokeCount = qEvents.filter((e) => e.event_type === "drawing_stroke").length;
    const eraseCount = qEvents.filter((e) => e.event_type === "drawing_erase").length;
    const hintCount = qEvents.filter((e) => e.event_type === "hint_requested").length;
    const wrongAttempts = qEvents.filter((e) => e.event_type === "answer_incorrect").length;
    const pauseCount = qEvents.filter((e) => e.event_type === "long_pause").length;

    const firstEvent = qEvents[0]?.timestamp ?? Date.now();
    const lastEvent = qEvents[qEvents.length - 1]?.timestamp ?? Date.now();
    const timeSpentMs = lastEvent - firstEvent;

    const struggleScore = Math.min(
      100,
      eraseCount * 5 + hintCount * 15 + wrongAttempts * 20 + pauseCount * 10
    );

    let understandingLevel: BehaviorSummary["understanding_level"];
    if (struggleScore >= 60) understandingLevel = "struggling";
    else if (struggleScore >= 30) understandingLevel = "learning";
    else if (wrongAttempts === 0 && hintCount === 0) understandingLevel = "mastered";
    else understandingLevel = "confident";

    let recommendedAction: BehaviorSummary["recommended_action"];
    if (understandingLevel === "struggling") recommendedAction = "reteach";
    else if (understandingLevel === "learning" && hintCount === 0) recommendedAction = "hint";
    else if (understandingLevel === "mastered") recommendedAction = "challenge";
    else if (understandingLevel === "confident") recommendedAction = "encourage";
    else recommendedAction = "none";

    return {
      question_id: qId,
      time_spent_ms: timeSpentMs,
      stroke_count: strokeCount,
      erase_count: eraseCount,
      hint_count: hintCount,
      wrong_attempts: wrongAttempts,
      pause_count: pauseCount,
      struggle_score: struggleScore,
      understanding_level: understandingLevel,
      recommended_action: recommendedAction,
    };
  }

  private track(eventType: EventType, metadata: Record<string, unknown>) {
    const event: BehaviorEvent = {
      session_id: this.sessionId,
      user_id: this.userId,
      question_id: this.currentQuestionId,
      event_type: eventType,
      timestamp: Date.now(),
      metadata,
    };
    this.events.push(event);
  }

  private markActivity() {
    this.lastActivityTime = Date.now();
    this.resetPauseTimer();
  }

  private resetPauseTimer() {
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = setTimeout(() => {
      this.track("long_pause", {
        pause_duration_ms: Date.now() - this.lastActivityTime,
      });
    }, PAUSE_THRESHOLD_MS);
  }

  private async saveSummary(questionId: string) {
    if (this.isGuest) return; // Skip DB writes for guests
    const summary = this.getSummary(questionId);
    try {
      await supabase.from("behavior_summaries").upsert({
        user_id: this.userId,
        session_id: this.sessionId,
        ...summary,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[BehaviorTracker] Failed to save summary:", err);
    }
    // Push insights to shared table so EduNext can read them
    if (this.currentSubject && this.currentTopic) {
      saveAITutorInsight(this.userId, this.currentSubject, this.currentTopic, summary)
        .catch(() => {});
    }
  }

  private async flush() {
    if (this.events.length === 0 || this.isGuest) return; // Skip DB writes for guests
    const toFlush = [...this.events];
    this.events = [];
    try {
      await supabase.from("behavior_events").insert(
        toFlush.map((e) => ({
          ...e,
          timestamp: new Date(e.timestamp).toISOString(),
          metadata: e.metadata ?? {},
        }))
      );
    } catch (err) {
      this.events = [...toFlush, ...this.events];
      console.error("[BehaviorTracker] Flush failed:", err);
    }
  }

  private generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  getSessionId() { return this.sessionId; }
  getUserId() { return this.userId; }
  getCurrentQuestionId() { return this.currentQuestionId; }
}

let trackerInstance: BehaviorTracker | null = null;

export function initTracker(userId?: string): BehaviorTracker {
  const id = userId || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  trackerInstance = new BehaviorTracker(id);
  return trackerInstance!;
}

export function getTracker(): BehaviorTracker {
  if (!trackerInstance) {
    trackerInstance = initTracker(); // Auto-init as guest
  }
  return trackerInstance;
}

export { BehaviorTracker };
