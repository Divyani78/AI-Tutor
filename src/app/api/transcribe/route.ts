import { NextRequest, NextResponse } from 'next/server'
import { genAI } from '@/lib/gemini'
import { getPrerequisites } from '@/data/knowledgeGraph'
import { getStudentProfile } from '@/lib/studentProfileService'

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { messages, questionContext, image, tutorMode = 'mains', timeTaken = 0 } = body

        console.log("Tutor API called. Messages:", messages?.length, "Image:", !!image)

        if (!messages || messages.length === 0) {
            return NextResponse.json({ error: "No messages provided" }, { status: 400 })
        }

        const lastMessage = messages[messages.length - 1]
        const lastMessageContent = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content)

        // ─── 1. ROUTE TO AGENT ────────────────────────────────────────────────────
        let selectedAgent = 'converse_agent'

        const isExplainTrigger =
            lastMessageContent.includes('TEACHING STYLE') ||
            lastMessageContent.includes('explain the concept behind this problem') ||
            lastMessageContent.includes('Explain this concept fully in your Hinglish') ||
            lastMessageContent.includes('Explain the selected part')

        if (isExplainTrigger) {
            selectedAgent = 'explain_agent'
        } else if (lastMessageContent.includes('check my latest step') || lastMessageContent.includes('Check the selected part')) {
            selectedAgent = 'check_agent'
        } else if (lastMessageContent.includes('write the next step for me')) {
            selectedAgent = 'solve_agent'
        } else if (lastMessageContent.includes('small hint for the next step')) {
            selectedAgent = 'hint_agent'
        } else {
            // LLM orchestrator only for free-text chat
            const oModel = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash',
                systemInstruction: `Route to one of: explain_agent, check_agent, solve_agent, hint_agent, converse_agent. Output ONLY: {"selected_agent":"<name>"}`,
                generationConfig: { responseMimeType: 'application/json', temperature: 0 }
            })
            try {
                const oRes = await oModel.generateContent([lastMessageContent])
                selectedAgent = JSON.parse(oRes.response.text()).selected_agent || 'converse_agent'
            } catch { selectedAgent = 'converse_agent' }
        }

        console.log('Routed to:', selectedAgent)

        // ─── 2. TUTOR PERSONA ─────────────────────────────────────────────────────
        const subject = questionContext?.subject?.toLowerCase() || 'general'
        const difficulty = questionContext?.difficulty || 'Medium'

        let tutorName = 'Sir'
        let tutorPersona = 'You are an expert JEE Tutor.'
        if (subject === 'mathematics' || subject === 'math') {
            tutorName = 'Ashish Sir'
            tutorPersona = 'You are Ashish Sir, legendary Math teacher at Kota. Style: logical, trick-based, Hinglish.'
        } else if (subject === 'physics') {
            tutorName = 'Anish Sir'
            tutorPersona = 'You are Anish Sir, legendary Physics teacher at Kota. Style: visualization-first, analogies, Hinglish.'
        } else if (subject === 'chemistry') {
            tutorName = 'Pankaj Sir'
            tutorPersona = 'You are Pankaj Sir, legendary Chemistry teacher at Kota. Style: story-based, mechanism-driven, Hinglish.'
        }

        // ─── 3. BUILD AGENT PROMPT ────────────────────────────────────────────────
        let agentPrompt = ''
        let maxTokens = 800

        if (selectedAgent === 'explain_agent') {
            // ✅ SPEED: No DB call, no prerequisite graph, no student profile
            // ✅ SPEED: Minimal but precise prompt — model gets exactly what it needs
            maxTokens = 1400

            const isSelection = lastMessageContent.includes('selected') || lastMessageContent.includes('Focusing exactly')
            const focusLine = isSelection
                ? 'Student ne scratchpad pe ek specific part select kiya hai. SIRF usi part ko explain karo.'
                : 'Is question ke core concept ko first principles se explain karo.'

            const diagEx = subject === 'physics'
                ? `[{"type":"arrow","start":{"x":170,"y":200},"end":{"x":170,"y":100},"color":"red","label":"N"},{"type":"arrow","start":{"x":170,"y":200},"end":{"x":170,"y":300},"color":"green","label":"mg"},{"type":"geo","x":150,"y":160,"w":40,"h":40,"color":"blue"},{"type":"text","x":162,"y":175,"text":"m"}]`
                : subject === 'chemistry'
                ? `[{"type":"ellipse","x":160,"y":150,"w":40,"h":40,"color":"blue"},{"type":"text","x":172,"y":165,"text":"O"},{"type":"ellipse","x":90,"y":200,"w":30,"h":30,"color":"grey"},{"type":"text","x":99,"y":213,"text":"H"},{"type":"arrow","start":{"x":160,"y":170},"end":{"x":115,"y":200},"color":"black","label":"bond"}]`
                : `[{"type":"arrow","start":{"x":40,"y":260},"end":{"x":320,"y":260},"color":"black","label":"x"},{"type":"arrow","start":{"x":40,"y":260},"end":{"x":40,"y":40},"color":"black","label":"y"},{"type":"text","x":180,"y":130,"text":"y=f(x)"}]`

            agentPrompt = `${tutorPersona}
Question: "${questionContext?.title || ''}"
Content: ${questionContext?.content || ''}
Subject: ${subject} | Difficulty: ${difficulty}
${focusLine}

You are ${tutorName} doing one-on-one class. Teach in Hinglish (natural Hindi+English mix).
Warm phrases: "dekho yaar", "samjhe?", "yeh important hai", "bahut accha".

Return ONLY this JSON (no markdown, no extra text):
{
  "type": "explain_visual",
  "title": "<punchy Hinglish title, max 8 words>",
  "flowchart": [
    "🎯 CONCEPT KI JAAN\\n<WHY does this exist? 2-3 sentences. Start: Yeh isliye aaya kyunki...>",
    "🌍 REAL-LIFE ANALOGY\\n<One Indian-life analogy: cricket/chai/train/phone. Start: Socho agar tum...>",
    "📐 STEP-BY-STEP\\n<Step 1: plain language, then formula.\\nStep 2: ...\\nStep 3: ...>",
    "⚠️ COMMON GALTI\\n<The EXACT #1 mistake. Be specific, not vague.>",
    "🧠 YAAD RAKHNE KI TRICK\\n<One mnemonic or shortcut that sticks.>",
    "✏️ AB TUM KARO\\n<One concrete action right now. Not 'practice karo' — give exact task.>"
  ],
  "diagram": ${diagEx}
}

STRICT RULES:
- flowchart: exactly 6 strings
- diagram coordinates: 0 to 400 only, no shape overlapping
- Valid shape types: "arrow"(start/end/color/label), "geo"(x/y/w/h/color), "ellipse"(x/y/w/h/color), "text"(x/y/text/color)  
- No LaTeX — use Unicode: θ π √ × ± ² ³
- Output ONLY valid JSON`

        } else {
            // All other agents — fetch profile for personalization
            const userId = questionContext?.userId || 'user_123'
            const studentProfile = await getStudentProfile(userId) || {
                weaknesses: ['Integration', 'Vectors'],
                strengths: ['Algebra'],
                score_history: []
            }

            const baseCtx = `${tutorPersona}
Question: "${questionContext?.title || ''}" | Content: ${questionContext?.content || ''}
Subject: ${subject} | Difficulty: ${difficulty} | Mode: ${tutorMode.toUpperCase()}
Student weaknesses: ${JSON.stringify(studentProfile.weaknesses)}
Solution steps (DO NOT REVEAL): ${JSON.stringify(questionContext?.solution_steps || [])}`

            if (selectedAgent === 'check_agent') {
                agentPrompt = `${baseCtx}
Check the student's scratchpad (see image). Output ONLY valid JSON:
- Correct → {"type":"success","title":"Sahi hai! 🎉","content":"<Hinglish praise + what to do next>"}
- Wrong → {"type":"error","title":"Ek Galti Mili ⚠️","content":"<exact error + fix in Hinglish>","diagram":[{"type":"ellipse","x":100,"y":100,"w":60,"h":60,"color":"red"}]}`

            } else if (selectedAgent === 'solve_agent') {
                agentPrompt = `${baseCtx}
Give ONLY the single next logical step. Don't solve fully.
Output ONLY: {"type":"step","content":"<next step — plain language first, then math, in Hinglish>"}`

            } else if (selectedAgent === 'hint_agent') {
                agentPrompt = `${baseCtx}
Small nudge without revealing answer. Hinglish, encouraging.
Output ONLY: {"type":"hint","content":"<hint>"}`

            } else {
                agentPrompt = `${baseCtx}
Chat naturally in Hinglish. Warm and supportive.
Output ONLY: {"type":"text","title":"${tutorName}","content":"<response>"}`
            }
        }

        // ─── 4. CALL GEMINI 2.0 FLASH (2-3x faster than 2.5) ─────────────────────
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: agentPrompt,
            generationConfig: {
                responseMimeType: 'application/json',
                maxOutputTokens: maxTokens,
                temperature: selectedAgent === 'explain_agent' ? 0.7 : 0.4,
            }
        })

        // For explain: send clean short message — not the massive prompt string
        const userMsg = (selectedAgent === 'explain_agent')
            ? (lastMessageContent.includes('selected') ? 'Explain the selected part.' : 'Explain this concept.')
            : lastMessageContent

        const parts: any[] = [{ text: userMsg }]
        if (image) parts.push({ inlineData: { mimeType: 'image/png', data: image } })

        // For explain: direct generateContent call (no chat history = faster)
        let result
        if (selectedAgent === 'explain_agent') {
            result = await retryOperation(() => model.generateContent(parts))
        } else {
            const chat = model.startChat({
                history: messages.slice(0, -1).map((m: any) => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
                }))
            })
            result = await retryOperation(() => chat.sendMessage(parts))
        }

        const responseText = result.response.text()
        console.log(`[${selectedAgent.toUpperCase()}] Response (first 300):`, responseText.slice(0, 300))

        let parsedResponse
        try {
            parsedResponse = JSON.parse(responseText.replace(/```json\n?|```/g, '').trim())
        } catch (e) {
            console.warn('JSON parse failed:', e)
            parsedResponse = { type: 'text', content: responseText }
        }

        return NextResponse.json(parsedResponse)

    } catch (error: any) {
        console.error('AI API Error:', error)
        return NextResponse.json({
            type: 'error',
            title: 'System Error',
            content: `Ek error aa gaya: ${error.message || 'Unknown'}. Dobara try karo.`
        }, { status: 500 })
    }
}

async function retryOperation<T>(op: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await op()
    } catch (err: any) {
        if (retries > 0 && (err.status === 429 || err.message?.includes('429'))) {
            await new Promise(r => setTimeout(r, delay))
            return retryOperation(op, retries - 1, delay * 2)
        }
        throw err
    }
}