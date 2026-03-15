import { NextRequest, NextResponse } from 'next/server'
import { genAI } from '@/lib/gemini'
import { getPrerequisites } from '@/data/knowledgeGraph'
import { getStudentProfile } from '@/lib/studentProfileService'
import { supabase } from '@/lib/supabaseClient'
import type { BehaviorSummary } from '@/lib/behaviorTracker'
import { fetchEdunextPerformance, buildEdunextContext } from '@/lib/edunextService'

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            messages,
            questionContext,
            image,
            tutorMode = 'mains',
            timeTaken = 0,
            // ─── NEW: behavior tracking fields ───────────────────────────────
            behaviorSummary,   // BehaviorSummary object from useBehaviorTracking()
            sessionId,         // tracker.getSessionId()
        } = body as {
            messages: any[]
            questionContext: any
            image?: string
            tutorMode?: string
            timeTaken?: number
            behaviorSummary?: BehaviorSummary
            sessionId?: string
        }

        console.log("Tutor API called. Messages:", messages?.length, "Image:", !!image, "BehaviorSummary:", !!behaviorSummary)

        if (!messages || messages.length === 0) {
            return NextResponse.json({ error: "No messages provided" }, { status: 400 })
        }

        const lastMessage = messages[messages.length - 1]
        const lastMessageContent = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content)

        // ─── 1. ORCHESTRATOR / CONTROLLER ────────────────────────────────────────
        let selectedAgent = 'converse_agent';

        // ✅ NEW: If behavior tracker says student is struggling AND they haven't asked
        //        for help yet, override the routing to explain_agent proactively
        const behaviorOverride = getBehaviorAgentOverride(behaviorSummary, lastMessageContent);

        // ✅ Detect the full Hinglish deep-explain prompt from TutorOverlay
        const isDeepExplain =
            lastMessageContent.includes('Hinglish') &&
            lastMessageContent.includes('TEACHING STYLE') &&
            lastMessageContent.includes('buildExplainPrompt');

        // Also detect the older simple explain trigger
        const isSimpleExplain = lastMessageContent.includes("explain the concept behind this problem");

        if (behaviorOverride) {
            selectedAgent = behaviorOverride;
        } else if (isDeepExplain || isSimpleExplain) {
            selectedAgent = 'explain_agent';
        } else if (lastMessageContent.includes("check my latest step") || lastMessageContent.includes("Check the selected part")) {
            selectedAgent = 'check_agent';
        } else if (lastMessageContent.includes("write the next step for me")) {
            selectedAgent = 'solve_agent';
        } else if (lastMessageContent.includes("small hint for the next step")) {
            selectedAgent = 'hint_agent';
        } else {
            // True LLM Orchestrator fallback
            const orchestratorModel = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                systemInstruction: `You are the Central Teacher Agent Orchestrator. 
Route the student's message to the correct sub-agent.
Available Sub-Agents:
- "explain_agent": if the student asks for a conceptual breakdown or explanation.
- "check_agent": if they ask to verify their math.
- "solve_agent": if they ask for the next step or want you to solve it.
- "hint_agent": if they need a hint.
- "converse_agent": for general greetings or regular chat questions.

Output ONLY a JSON object: { "selected_agent": "<agent_name>" }`,
                generationConfig: { responseMimeType: "application/json", temperature: 0 }
            });
            const orchestratorRes = await orchestratorModel.generateContent([lastMessageContent]);
            try {
                const parsed = JSON.parse(orchestratorRes.response.text());
                selectedAgent = parsed.selected_agent || 'converse_agent';
            } catch (e) { selectedAgent = 'converse_agent'; }
        }

        console.log("Orchestrator routed to:", selectedAgent, behaviorOverride ? "(behavior override)" : "");

        // ─── 2. COMMON CONTEXT ────────────────────────────────────────────────────
        const subject = questionContext?.subject?.toLowerCase() || 'general';
        const difficulty = questionContext?.difficulty || 'Medium';

        let tutorPersona = 'You are an expert JEE Tutor.';
        let tutorName = 'Sir';
        if (subject === 'mathematics' || subject === 'math') {
            tutorName = 'Ashish Sir';
            tutorPersona = `You are Ashish Sir, a legendary Mathematics teacher at a top Kota coaching institute. You have taught JEE for 15 years. Your style: logical, precise, trick-based. You love showing students 2-3 methods for the same problem. You mix Hindi and English naturally ("dekho yaar", "yeh trick bahut kaam aati hai").`;
        } else if (subject === 'physics') {
            tutorName = 'Anish Sir';
            tutorPersona = `You are Anish Sir, a legendary Physics teacher at a top Kota coaching institute. You have taught JEE for 15 years. Your style: visualization-first, intuition-driven. You always draw diagrams before writing equations. You use everyday analogies (cricket ball, train, ceiling fan). You mix Hindi and English naturally.`;
        } else if (subject === 'chemistry') {
            tutorName = 'Pankaj Sir';
            tutorPersona = `You are Pankaj Sir, a legendary Chemistry teacher at a top Kota coaching institute. You have taught JEE for 15 years. Your style: story-based, mechanism-driven. You explain reactions like stories with characters (electrons, atoms). You mix Hindi and English naturally.`;
        }

        const userId = questionContext?.userId || 'user_123';
        const studentProfile = await getStudentProfile(userId) || {
            id: 'user_dummy',
            name: 'Dummy',
            learning_style: 'visual',
            weaknesses: ["Integration", "Chain Rule", "Vectors"],
            strengths: ["Algebra"],
            score_history: []
        };

        // ─── Fetch long-term student behavior profile from Supabase ──────────────
        let studentBehaviorProfile: Record<string, any> | null = null;
        try {
            const { data } = await supabase
                .from('student_behavior_profile')
                .select('*')
                .eq('user_id', userId)
                .single();
            studentBehaviorProfile = data;
        } catch { /* table may not exist yet — silently skip */ }

        // ─── Fetch EduNext contest/mock performance ───────────────────────────────
        const edunextRecords = await fetchEdunextPerformance(userId);
        const edunextContext = buildEdunextContext(edunextRecords);

        // ─── Build the behavior context string injected into every agent ──────────
        const behaviorContext = buildBehaviorContext(behaviorSummary, studentBehaviorProfile);

        const commonContext = `${tutorPersona}

Target Audience: Indian high school students (Class 11, 12, or Droppers) aiming for a <5000 rank in JEE Advanced.
Current Mode: ${tutorMode.toUpperCase()}
Question Difficulty: ${difficulty}
Student Time Spent: ${timeTaken} seconds

CULTURAL & EXAMINATION CONTEXT:
- Teach with a "Guru" mindset — strict but deeply caring and encouraging
- Use Hinglish naturally (not forcefully): "dekho", "samjhe?", "yeh important hai", "bahut accha"
- For MCQs: teach elimination via dimensional analysis, parity checks, boundary values

TLDRAW INTEGRATION:
You can draw on the whiteboard using the 'diagram' array. Schema:
- 'geo': blocks, circles (props: x, y, w, h, geo: 'rectangle'|'ellipse', color)
- 'arrow': vectors/forces (props: start {x,y}, end {x,y}, color, label)  
- 'text': labels (props: x, y, text OR label, color)
Use coordinates 0–500. Never overlap text with shapes.

STUDENT PROFILE:
- Weaknesses: ${JSON.stringify(studentProfile.weaknesses)}
- Strengths: ${JSON.stringify(studentProfile.strengths)}
- Score History: ${JSON.stringify(studentProfile.score_history)}
- Prerequisites for this topic: ${JSON.stringify(getPrerequisites(questionContext?.title || '', 1))}

${behaviorContext}

${edunextContext}

CURRENT QUESTION:
Title: ${questionContext?.title || 'Unknown'}
Content: ${questionContext?.content || ''}

Solution Steps (FOR YOUR REFERENCE ONLY — DO NOT REVEAL UNLESS ASKED):
${JSON.stringify(questionContext?.solution_steps || [], null, 2)}
`;

        // ─── 3. AGENT-SPECIFIC PROMPTS ────────────────────────────────────────────
        let agentPrompt = "";

        // ─── NEW: Adaptive tone instruction based on behavior ─────────────────────
        const adaptiveToneInstruction = getAdaptiveToneInstruction(
            behaviorSummary?.recommended_action,
            behaviorSummary?.understanding_level
        );

        switch (selectedAgent) {

            // ✅ EXPLAIN AGENT — Full Kota-teacher Hinglish deep explanation
            case 'explain_agent':

                // Check if this was triggered by the "Explain Selection" button
                const isSelectionExplain = lastMessageContent.includes('Focusing exactly on the specific part selected');

                const selectionInstruction = isSelectionExplain
                    ? `The student has selected a SPECIFIC PART of their scratchpad work and is pointing at it saying "Sir, yeh wala samjhao." 
Focus your ENTIRE explanation on exactly that selected region visible in the image. 
Treat it like a student pointing at the board — address only what they highlighted.`
                    : `Explain the CORE CONCEPT behind the current question from first principles.`;

                // Subject-specific diagram examples
                let subjectDiagramExamples = "";
                if (subject === 'physics') {
                    subjectDiagramExamples = `
DIAGRAM EXAMPLE (Physics - Forces):
{"type":"arrow","start":{"x":170,"y":190},"end":{"x":170,"y":270},"color":"green","label":"mg"},
{"type":"arrow","start":{"x":170,"y":150},"end":{"x":170,"y":70},"color":"red","label":"N"},
{"type":"geo","x":150,"y":150,"w":40,"h":40,"color":"blue"},
{"type":"text","x":155,"y":162,"text":"m"}`;
                } else if (subject === 'chemistry') {
                    subjectDiagramExamples = `
DIAGRAM EXAMPLE (Chemistry - Molecular):
{"type":"ellipse","x":150,"y":150,"w":40,"h":40,"color":"blue"},
{"type":"text","x":165,"y":165,"text":"O"},
{"type":"ellipse","x":80,"y":200,"w":30,"h":30,"color":"grey"},
{"type":"text","x":90,"y":212,"text":"H"},
{"type":"arrow","start":{"x":150,"y":170},"end":{"x":105,"y":200},"color":"black"}`;
                } else {
                    subjectDiagramExamples = `
DIAGRAM EXAMPLE (Math - Coordinate):
{"type":"arrow","start":{"x":50,"y":250},"end":{"x":300,"y":250},"color":"black","label":"x"},
{"type":"arrow","start":{"x":50,"y":250},"end":{"x":50,"y":50},"color":"black","label":"y"},
{"type":"text","x":200,"y":120,"text":"y = f(x)"}`;
                }

                agentPrompt = `${commonContext}

═══════════════════════════════════════════════════
AGENT: EXPLAIN_AGENT — DEEP HINGLISH TEACHER MODE
═══════════════════════════════════════════════════

${adaptiveToneInstruction}

${selectionInstruction}

You are ${tutorName} in a one-on-one session with a student who is confused. 
Your job: make them understand SO thoroughly that they never need to ask again.
After your explanation, they should feel like they just had the best 20-minute class of their life.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY TEACHING STRUCTURE (follow in EXACT order):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your 'flowchart' array MUST contain these 7 sections in order:

[0] 🎯 CONCEPT KI JAAN — The WHY (2-3 sentences)
    "Yeh concept isliye aaya kyunki..."
    Explain the fundamental reason this concept exists. Not the formula — the IDEA.

[1] 🌍 REAL-LIFE ANALOGY — One relatable comparison
    Use something from everyday Indian life: cricket, chai, auto-rickshaw, phone battery, train, ceiling fan.
    NEVER say the concept is "easy" or "simple" — that discourages students who are struggling.

[2] 📐 STEP-BY-STEP BREAKDOWN — Numbered micro-steps
    Each step: plain language explanation FIRST, then the math/formula.

[3] ⚠️ COMMON GALTI — The #1 mistake students make
    Be very specific about the exact error, not a vague warning.

[4] 🧠 YAAD RAKHNE KI TRICK — Memory trick or shortcut
    Give ONE mnemonic, pattern, or shortcut that makes this stick forever.

[5] 🎨 DIAGRAM BATAO — Describe the diagram you're drawing
    Tell the student what you're drawing and why each element matters.

[6] ✏️ AB TUM KARO — Active practice nudge
    NOT "practice karo" — give them a CONCRETE next action.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIAGRAM REQUIREMENTS (MANDATORY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST draw a meaningful diagram. Include AT LEAST:
- 3-5 shapes (arrows, boxes, labels)
- Labels on every arrow and shape
- Coordinates spread across 50–450 range (no overlapping)
${subjectDiagramExamples}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Hinglish throughout: natural mix of Hindi and English
- Warm phrases: "dekho yaar", "samjhe?", "bahut accha question hai", "ab dhyan se suno"
- NO LaTeX block delimiters ($$ or \\[). Use Unicode: θ, π, √, ², ³, ±, ≤, ≥, ×, ÷

OUTPUT FORMAT (strict JSON):
{
  "type": "explain_visual",
  "title": "<short punchy title>",
  "content": "<complete Hinglish explanation — all 7 sections>",
  "flowchart": [
    "🎯 CONCEPT KI JAAN\\n<WHY>",
    "🌍 REAL-LIFE ANALOGY\\n<analogy>",
    "📐 STEP-BY-STEP\\nStep 1: ...\\nStep 2: ...",
    "⚠️ COMMON GALTI\\n<specific mistake>",
    "🧠 YAAD RAKHNE KI TRICK\\n<memory trick>",
    "🎨 DIAGRAM\\n<narrate the drawing>",
    "✏️ AB TUM KARO\\n<concrete action>"
  ],
  "diagram": [ <at least 3-5 tldraw shapes> ]
}`;
                break;

            case 'check_agent':
                agentPrompt = `${commonContext}
AGENT: CHECK_AGENT
${adaptiveToneInstruction}
Rigorously verify the math shown on the scratchpad (see image).
- If correct: {"type": "success", "title": "Sahi hai! 🎉", "content": "<encouraging Hinglish feedback + what to do next>"}
- If wrong: {"type": "error", "title": "Ek Galti Mili ⚠️", "content": "<exact error in Hinglish — which line, which step, what went wrong and why>", "diagram": [{"type":"ellipse","x":100,"y":100,"w":60,"h":60,"color":"red"}]}
Be specific about the error location. Use Hinglish tone.`;
                break;

            case 'solve_agent':
                agentPrompt = `${commonContext}
AGENT: SOLVER_AGENT
${adaptiveToneInstruction}
Provide the single next logical step only. Do not solve the entire problem.
Mode: ${tutorMode.toUpperCase()}, Difficulty: ${difficulty}
Output: {"type": "step", "content": "<next step in Hinglish — plain language first, then math>"}`;
                break;

            case 'hint_agent':
                agentPrompt = `${commonContext}
AGENT: HINT_AGENT
${adaptiveToneInstruction}
Give a small nudge without revealing the answer. Hinglish tone. Be encouraging.
Output: {"type": "hint", "content": "<hint>"}`;
                break;

            default: // converse_agent
                agentPrompt = `${commonContext}
AGENT: CONVERSE_AGENT
${adaptiveToneInstruction}
Chat naturally with the student. Use Hinglish. Be warm and supportive.
Output: {"type": "text", "title": "${tutorName}", "content": "<response>"}`;
                break;
        }

        agentPrompt += `\n\nFORMATTING RULES: No LaTeX delimiters ($$ or \\[). Use Unicode symbols (θ, π, √, ×, ±). Output MUST be valid JSON.`;

        // ─── 4. EXECUTE SUB-AGENT ─────────────────────────────────────────────────
        const subAgentModel = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: agentPrompt,
            generationConfig: { responseMimeType: "application/json" }
        })

        const cleanedLastMessage = (isDeepExplain)
            ? (lastMessageContent.includes('selected')
                ? "Explain the selected part of my scratchpad in your full Hinglish teaching style with diagram."
                : "Explain this concept fully in your Hinglish teaching style with diagram and examples.")
            : lastMessageContent;

        const messageParts: any[] = [{ text: cleanedLastMessage }]
        if (image) {
            messageParts.push({ inlineData: { mimeType: "image/png", data: image } })
        }

        const chat = subAgentModel.startChat({
            history: messages.slice(0, -1).map((m: any) => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
            }))
        })

        const result = await retryOperation(() => chat.sendMessage(messageParts))
        const responseText = result.response.text()

        console.log(`[${selectedAgent.toUpperCase()}] Response:`, responseText)

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText.replace(/```json\n?|```/g, '').trim());
        } catch (e) {
            console.warn("Failed to parse JSON response:", e);
            parsedResponse = { type: 'text', content: responseText };
        }

        // ─── NEW: Log tutor interaction with behavior context to Supabase ─────────
        // Fire-and-forget: don't block the response
        if (sessionId && userId !== 'user_123') {
            supabase.from('behavior_events').insert({
                session_id: sessionId,
                user_id: userId,
                question_id: questionContext?.id || questionContext?.title || 'unknown',
                event_type: 'tutor_opened',
                timestamp: new Date().toISOString(),
                metadata: {
                    selected_agent: selectedAgent,
                    behavior_override: !!behaviorOverride,
                    struggle_score: behaviorSummary?.struggle_score ?? null,
                    understanding_level: behaviorSummary?.understanding_level ?? null,
                    recommended_action: behaviorSummary?.recommended_action ?? null,
                },
            }).then(() => {}, () => {});
        }

        return NextResponse.json(parsedResponse)

    } catch (error: any) {
        console.error('AI API Logic Error:', error)
        return NextResponse.json({
            type: 'error',
            title: 'System Error',
            content: `Ek error aa gaya: ${error.message || 'Unknown error'}. Dobara try karo.`
        }, { status: 500 })
    }
}

// ─── Behavior Helper Functions ────────────────────────────────────────────────

/**
 * Decides if behavior data should OVERRIDE normal agent routing.
 * Only overrides passive "converse_agent" cases — never overrides
 * explicit user actions (hint/check/solve/explain buttons).
 */
function getBehaviorAgentOverride(
    summary: BehaviorSummary | undefined,
    lastMessage: string
): string | null {
    if (!summary) return null;

    // Never override explicit user-initiated button actions
    const isExplicitAction =
        lastMessage.includes("check my latest step") ||
        lastMessage.includes("write the next step") ||
        lastMessage.includes("small hint") ||
        lastMessage.includes("explain the concept") ||
        lastMessage.includes("buildExplainPrompt");

    if (isExplicitAction) return null;

    // Proactively switch to explain_agent if student is clearly stuck
    // and hasn't yet asked for any help (detect passive confusion)
    if (
        summary.understanding_level === 'struggling' &&
        summary.recommended_action === 'reteach' &&
        summary.hint_count === 0
    ) {
        return 'explain_agent';
    }

    // Switch to hint_agent if student is struggling but not in full reteach territory
    if (
        summary.understanding_level === 'learning' &&
        summary.recommended_action === 'hint' &&
        summary.erase_count >= 3
    ) {
        return 'hint_agent';
    }

    return null;
}

/**
 * Builds the STUDENT BEHAVIOUR DATA block injected into commonContext.
 * This is what makes every agent "aware" of how the student is performing
 * right now vs. their historical average.
 */
function buildBehaviorContext(
    summary: BehaviorSummary | undefined,
    profile: Record<string, any> | null
): string {
    if (!summary && !profile) return '';

    const lines: string[] = ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'];
    lines.push('STUDENT BEHAVIOUR DATA (use to adapt your response):');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (summary) {
        lines.push(`📊 THIS QUESTION (right now):`);
        lines.push(`  • Time on question: ${Math.round((summary.time_spent_ms ?? 0) / 1000)}s`);
        lines.push(`  • Drawing strokes: ${summary.stroke_count}`);
        lines.push(`  • Erases: ${summary.erase_count}${summary.erase_count >= 5 ? ' ⚠️ high' : ''}`);
        lines.push(`  • Hints requested: ${summary.hint_count}`);
        lines.push(`  • Wrong attempts: ${summary.wrong_attempts}`);
        lines.push(`  • Long pauses (>30s): ${summary.pause_count}`);
        lines.push(`  • Struggle score: ${summary.struggle_score}/100`);
        lines.push(`  • Understanding level: ${summary.understanding_level.toUpperCase()}`);
        lines.push(`  • Recommended action: ${summary.recommended_action.toUpperCase()}`);
    }

    if (profile) {
        lines.push(`\n📈 ALL-TIME PROFILE:`);
        lines.push(`  • Learning style: ${profile.learning_style}`);
        lines.push(`  • Avg struggle score: ${Math.round(profile.avg_struggle_score ?? 0)}/100`);
        lines.push(`  • Topics mastered: ${profile.mastered_count ?? 0}`);
        lines.push(`  • Topics struggled: ${profile.struggling_count ?? 0}`);
        lines.push(`  • Total hints used: ${profile.total_hints ?? 0}`);
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return lines.join('\n');
}

/**
 * Returns a short directive injected at the top of each agent's prompt section,
 * telling Gemini exactly HOW to adjust tone and depth based on struggle level.
 */
function getAdaptiveToneInstruction(
    action: BehaviorSummary['recommended_action'] | undefined,
    level: BehaviorSummary['understanding_level'] | undefined
): string {
    switch (action) {
        case 'reteach':
            return `⚠️ ADAPTIVE MODE — RETEACH:
The student is STRUGGLING (high erase count, multiple pauses, wrong attempts).
→ Start from absolute basics. Use the simplest analogy possible.
→ Break every step into micro-steps. Check understanding after each one.
→ Tone: extra patient, zero judgment. "Koi baat nahi yaar, yeh tricky part hai."
→ Do NOT assume they remember any prerequisites.`;

        case 'hint':
            return `💡 ADAPTIVE MODE — HINT:
The student is working but getting stuck (some erases, some pauses).
→ They're close — give a gentle directional nudge, not the answer.
→ Validate what they've already done correctly before hinting.
→ Tone: encouraging, confidence-building. "Tum sahi direction mein ho!"`;

        case 'encourage':
            return `✅ ADAPTIVE MODE — ENCOURAGE:
The student is making solid progress (few erases, on track).
→ Validate their approach. Help them finish with confidence.
→ You can move slightly faster — they're keeping up.
→ Tone: warm, validating. "Bahut accha! Yeh approach correct hai."`;

        case 'challenge':
            return `🚀 ADAPTIVE MODE — CHALLENGE:
The student has MASTERED this concept (no wrong attempts, no hints needed).
→ After answering, push them with a harder variation or edge case.
→ Ask them to explain WHY their method works — test depth of understanding.
→ Tone: respect their ability. "Ab ek aur interesting case dekhte hain..."`;

        default:
            return `ℹ️ No behavior data yet — respond naturally based on the student's question.`;
    }
}

// ─── Retry Utility ────────────────────────────────────────────────────────────

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await operation()
    } catch (error: any) {
        if (retries > 0 && (error.status === 429 || error.message?.includes('429'))) {
            console.log(`Rate limited. Retrying in ${delay}ms... (${retries} retries left)`)
            await new Promise(resolve => setTimeout(resolve, delay))
            return retryOperation(operation, retries - 1, delay * 2)
        }
        throw error
    }
}