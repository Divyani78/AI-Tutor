'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, X, Send, Lightbulb, GraduationCap, CheckCircle2, AlertTriangle, Pencil, Mic } from 'lucide-react'
import { clsx } from 'clsx'
import { useBehaviorTracking } from '@/hooks/useBehaviorTracking'

interface TutorOverlayProps {
    onAskAI: (message: string) => void
    onGetHint: () => void
    isProcessing: boolean
    messages: Array<{ role: 'user' | 'assistant'; content: string | any }>
    subject?: string
    externalIsOpen?: boolean
    onExternalClose?: () => void
    hideFab?: boolean
    hasSelection?: boolean
}

// ─── Deep Explain Prompt ───────────────────────────────────────────────────────
const buildExplainPrompt = (hasSelection: boolean, subject?: string): string => {
    const selectionNote = hasSelection
        ? "The student has highlighted a specific part of their work on the scratchpad. Focus your ENTIRE explanation on exactly that selected portion — treat it as the student pointing at the board and asking 'Sir, yeh wala samjhao'."
        : "Explain the core concept behind this problem from scratch."

    return `
You are ${subject ? getTeacherName(subject) : 'an expert JEE/NEET tutor'} — a legendary Indian coaching teacher like those at Kota. You have taught thousands of students and you know EXACTLY where students get confused.

${selectionNote}

YOUR TEACHING STYLE — follow this STRICTLY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🗣️ LANGUAGE — Hinglish (mix of Hindi and English), conversational and warm.
   - Use phrases like: "dekho yaar", "samjhe?", "yeh bahut important hai", "bahut accha question hai", "ab dhyan se suno", "iska matlab hai ki...", "simple hai na?", "trick yeh hai ki..."
   - Never be cold or robotic. Sound like a real sir who genuinely wants the student to understand.

2. 📖 STRUCTURE — Always teach in this exact order:
   a) **Pehle concept clear karo** — Explain the WHY behind the concept in 2-3 simple sentences. "Yeh concept isliye aaya kyunki..."
   b) **Real-life analogy do** — Give ONE relatable analogy (cricket, chai, train, phone battery — whatever fits). "Socho agar tum cricket khel rahe ho aur..."
   c) **Step-by-step breakdown** — Break the solution/concept into numbered micro-steps. Each step in plain language first, then the math/formula.
   d) **Common galti batao** — Tell the student the #1 mistake students make here. "Zyaadatar students yahan galti karte hain ki..."
   e) **Quick memory trick** — Give a mnemonic, shortcut, or pattern to remember. "Yaad rakhne ka ek aasan tarika hai..."
   f) **Diagram instruction** — Describe a clear diagram to draw (you will also render it on the scratchpad). "Board pe aise draw karo..."
   g) **Ab tum karo** — End with ONE simple practice nudge. "Ab tum khud try karo — bas yeh ek cheez change karke dekho..."

3. 🎨 DIAGRAMS — You MUST include a diagram in your response using the diagram array. Draw:
   - Labeled arrows showing relationships or forces
   - Boxes/rectangles for processes or states
   - Coordinate axes if needed
   - Make it clear and annotated with text labels

4. 💬 TONE:
   - Encouraging: "Bahut achha! Tum sahi direction mein ho."
   - Patient: Never say the concept is "easy" or "obvious" — that discourages students.
   - Specific: Don't give vague advice. Give exact steps.
   - Concise but complete: Don't pad. Every sentence should teach something.

5. 📐 MATH: Write all formulas clearly. Explain each variable. "Yahan 'm' matlab mass hai, 'a' matlab acceleration — Newton ka second law."

RESPONSE FORMAT:
Return a JSON object with:
{
  "type": "explain_visual",
  "title": "<short title like 'Newton ka 2nd Law — Seedha Explanation'>",
  "content": "<full Hinglish explanation following all steps above>",
  "diagram": [ /* array of shapes: arrows, boxes, text labels */ ],
  "flowchart": [ /* array of step strings for the whiteboard flowchart */ ]
}

Remember: After reading your explanation, the student should feel like they just had a 20-minute one-on-one session with the best teacher of their life. Koi doubt nahi rehna chahiye.
`.trim()
}

function getTeacherName(subject: string): string {
    const s = subject.toLowerCase()
    if (s.includes('math'))    return 'Ashish Sir (Math wizard, known for making calculus feel like common sense)'
    if (s.includes('physics')) return 'Anish Sir (Physics guru, explains every concept with real-world examples)'
    if (s.includes('chem'))    return 'Pankaj Sir (Chemistry expert, makes reactions feel like stories)'
    return 'an expert JEE/NEET tutor'
}

export default function TutorOverlay({
    onAskAI, onGetHint, isProcessing, messages, subject,
    externalIsOpen, onExternalClose, hideFab = false, hasSelection = false
}: TutorOverlayProps) {
    const isPanelVisible = externalIsOpen !== undefined ? externalIsOpen : true
    const [chatOpen, setChatOpen] = useState(false)
    const [inputStr, setInputStr] = useState('')
    const [isListening, setIsListening] = useState(false)

    // ── Behavior tracking ─────────────────────────────────────────────────────
    const { trackHint, trackTutorOpen, trackTutorClose } = useBehaviorTracking()

    const startListening = () => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) { alert("Your browser does not support Speech Recognition."); return }

        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = true

        recognition.onstart  = () => setIsListening(true)
        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
                .map((result: any) => result[0])
                .map((result) => result.transcript)
                .join('')
            setInputStr(transcript)
        }
        recognition.onerror = (event: any) => { console.error("Speech recognition error", event.error); setIsListening(false) }
        recognition.onend   = () => setIsListening(false)
        recognition.start()
    }

    const getTutorInfo = (subjectName?: string) => {
        switch (subjectName?.toLowerCase()) {
            case 'mathematics':
            case 'math':      return { name: 'Ashish Sir', image: '/tutors/ashish_sir.png', role: 'Math Expert' }
            case 'physics':   return { name: 'Anish Sir',  image: '/tutors/anish_sir.png',  role: 'Physics Expert' }
            case 'chemistry': return { name: 'Pankaj Sir', image: '/tutors/pankaj_sir.png', role: 'Chemistry Expert' }
            default:          return { name: 'AI Tutor',   image: '/image.png', role: 'Expert Tutor' }
        }
    }

    const tutorInfo = getTutorInfo(subject)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputStr.trim()) return
        onAskAI(inputStr)
        setInputStr('')
    }

    const handleQuickAction = (action: string) => {
        console.log("Quick Action Triggered:", action)

        if (action === 'hint') {
            // ── Track: student asked for a hint ──────────────────────────────
            trackHint()
            onGetHint()
        }

        if (action === 'explain') {
            // ── Track: student opened the explain panel (tutor opened) ───────
            trackTutorOpen()
            const prompt = buildExplainPrompt(hasSelection, subject)
            onAskAI(prompt)
        }

        if (action === 'check') {
            onAskAI(
                hasSelection
                    ? "Please check the selected part of my scratchpad. Tell me if it's correct, and if not, explain where I went wrong and what the right approach is — in simple Hinglish."
                    : "Please check my latest step on the scratchpad. Tell me if it's correct, and if not, explain where I went wrong — in simple Hinglish."
            )
        }

        if (action === 'solve') {
            onAskAI("Please write the next step for me on the scratchpad.")
        }
    }

    // ── Track chat panel open/close ───────────────────────────────────────────
    const handleChatToggle = (open: boolean) => {
        setChatOpen(open)
        if (open) trackTutorOpen()
        else      trackTutorClose()
    }

    return (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none">
            <AnimatePresence>
                {isPanelVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="pointer-events-auto bg-brand-dark rounded-2xl shadow-2xl w-80 md:w-96 overflow-hidden border border-gray-800 flex flex-col mb-6"
                    >
                        {chatOpen && (
                            <>
                                {/* Header */}
                                <div className="bg-gray-900/50 p-4 text-white flex justify-between items-center border-b border-gray-800">
                                    <div className="flex items-center gap-3 text-brand-amber">
                                        <img src={tutorInfo.image} alt={tutorInfo.name} className="w-8 h-8 rounded-full object-cover border border-brand-amber shadow-sm" />
                                        <div className="flex flex-col">
                                            <span className="font-bold tracking-wide text-sm leading-tight text-white">{tutorInfo.name}</span>
                                            <span className="text-[10px] text-brand-amber leading-tight">{tutorInfo.role}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleChatToggle(false)}
                                        className="hover:bg-white/10 p-1 rounded-full transition-colors text-gray-400 hover:text-white"
                                        title="Hide Chat"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
                                    {messages.length === 0 ? (
                                        <div className="text-center text-gray-400 text-sm mt-10 flex flex-col items-center">
                                            <img
                                                src={tutorInfo.image}
                                                alt={tutorInfo.name}
                                                className="w-16 h-16 rounded-full object-cover border-2 border-gray-700 mx-auto mb-3 shadow-lg grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
                                            />
                                            <p>Main dekh raha hoon tum solve kar rahe ho.</p>
                                            <p className="text-gray-500 text-xs mt-1">Kuch bhi pucho ya neeche se action lo.</p>
                                        </div>
                                    ) : (
                                        messages.map((m, i) => {
                                            if (typeof m.content === 'object' && m.content !== null && (m.content as any).type) {
                                                const msg = m.content as any

                                                if (msg.type === 'explain_visual') {
                                                    return (
                                                        <div key={i} className="self-start w-full mb-3">
                                                            <div className="rounded-2xl border border-indigo-400/40 bg-gradient-to-br from-indigo-900/60 to-violet-900/40 p-4 shadow-lg">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <img src={tutorInfo.image} alt={tutorInfo.name} className="w-7 h-7 rounded-full border border-indigo-400 object-cover" />
                                                                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">{tutorInfo.name}</span>
                                                                    <span className="ml-auto text-[10px] text-indigo-400/70">Full Explanation</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <GraduationCap className="w-4 h-4 text-indigo-300 flex-shrink-0" />
                                                                    <span className="text-sm font-bold text-white leading-tight">{msg.title || 'Concept Explained'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30">
                                                                    <span className="text-lg">🖊️</span>
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-indigo-200">Whiteboard pe dekho →</p>
                                                                        <p className="text-[11px] text-indigo-300/70">Poori explanation + diagram scratchpad pe draw ho gayi hai</p>
                                                                    </div>
                                                                </div>
                                                                {msg.flowchart && (
                                                                    <div className="flex gap-1 mt-2 flex-wrap">
                                                                        {['🎯 Concept', '🌍 Analogy', '📐 Steps', '⚠️ Galti', '🧠 Trick', '🎨 Diagram', '✏️ Try it'].map((label, si) => (
                                                                            <span key={si} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-800/60 text-indigo-300 border border-indigo-700/40">
                                                                                {label}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                }

                                                const typeStyles = {
                                                    hint:    'bg-yellow-50 border-yellow-200 text-yellow-900',
                                                    error:   'bg-red-50 border-red-200 text-red-900',
                                                    success: 'bg-green-50 border-green-200 text-green-900',
                                                    text:    'bg-gray-800 text-gray-100 border-gray-700'
                                                }[msg.type as string] || 'bg-gray-800 text-gray-100'

                                                const icons: Record<string, React.ReactNode> = {
                                                    hint:    <Lightbulb className="w-4 h-4 text-yellow-600" />,
                                                    error:   <AlertTriangle className="w-4 h-4 text-red-600" />,
                                                    success: <CheckCircle2 className="w-4 h-4 text-green-600" />,
                                                    text:    null
                                                }

                                                return (
                                                    <div key={i} className="self-start w-full max-w-[90%] mb-2">
                                                        <div className={`p-4 rounded-xl border ${typeStyles} shadow-sm`}>
                                                            {msg.title && (
                                                                <div className="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider opacity-80">
                                                                    {icons[msg.type]}
                                                                    {msg.title}
                                                                </div>
                                                            )}
                                                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                                        </div>
                                                    </div>
                                                )
                                            }

                                            const isExplainPrompt = typeof m.content === 'string' && m.content.startsWith('You are') && m.content.includes('Hinglish')
                                            if (isExplainPrompt && m.role === 'user') {
                                                return (
                                                    <div key={i} className="flex flex-col max-w-[85%] self-end items-end">
                                                        <div className="px-4 py-2 rounded-2xl text-sm bg-brand-amber text-brand-dark font-medium rounded-br-sm">
                                                            📚 {hasSelection ? "Explain selection" : "Explain this concept"}
                                                        </div>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div key={i} className={clsx("flex flex-col max-w-[85%]", m.role === 'user' ? "self-end items-end" : "self-start items-start")}>
                                                    <div className={clsx(
                                                        "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                                                        m.role === 'user'
                                                            ? "bg-brand-amber text-brand-dark font-medium rounded-br-sm"
                                                            : "bg-gray-800 text-gray-100 rounded-bl-sm border border-gray-700"
                                                    )}>
                                                        {m.content}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                    {isProcessing && (
                                        <div className="self-start flex items-center gap-2 text-xs text-gray-400 italic px-2">
                                            <div className="w-4 h-4 rounded-full border-2 border-brand-amber border-t-transparent animate-spin" />
                                            {tutorInfo.name} likh raha hai...
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Quick Actions */}
                        <div className="p-2 px-4 gap-2 flex flex-wrap border-t border-gray-800 bg-gray-900/80 min-h-[48px] items-center">
                            {isProcessing ? (
                                <div className="flex items-center justify-center gap-2 w-full text-brand-amber animate-pulse text-sm font-bold">
                                    <div className="w-5 h-5 rounded-full border-2 border-brand-amber border-t-transparent animate-spin" />
                                    {tutorInfo.name} is thinking...
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => handleQuickAction('hint')}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-brand-amber rounded-full transition-colors border border-gray-700 whitespace-nowrap"
                                    >
                                        <Lightbulb className="w-3 h-3" /> Hint
                                    </button>

                                    <button
                                        onClick={() => handleQuickAction('explain')}
                                        className={clsx(
                                            "flex items-center gap-1 px-3 py-1.5 hover:bg-indigo-700 text-xs rounded-full transition-all border whitespace-nowrap font-semibold",
                                            hasSelection
                                                ? "bg-purple-600 border-purple-500 text-white animate-pulse shadow-lg shadow-purple-500/30"
                                                : "bg-indigo-600 border-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/20"
                                        )}
                                        title="You are an expert JEE tutor who teaches like a beloved coaching institute sir (think Kota-style). 

When explaining any JEE concept or solving any problem, follow this structure:

---

## 📌 CONCEPT SAMAJHTE HAI

Pehle concept ko simple Hinglish mein explain karo — jaise ek senior student apne junior ko samjha raha ho. No heavy English jargon without explanation.

---

## 🖼️ DIAGRAM / VISUAL

Jahan bhi possible ho, ASCII diagram ya structured text visual banao:
- Physics: force diagrams, ray diagrams, circuit diagrams
- Chemistry: orbital diagrams, reaction mechanisms, structures
- Math: coordinate geometry figures, function graphs

---

## 🧠 THEORY — EK EK POINT CLEAR

Key formulas aur concepts numbered points mein likho.
Har formula ke saath batao:
- Kab use hoti hai
- Common mistakes kya hoti hain
- JEE mein kaise poochha jaata hai

---

## ✏️ SOLVED EXAMPLE

Ek step-by-step solved problem dikhao:
Step 1 → Step 2 → ... → Final Answer ✅
Har step pe explain karo KYO woh step liya — sirf answer nahi, reasoning bhi.

---

## ⚡ JEE SHORTCUT / TRICK

Agar koi time-saving trick, pattern, ya shortcut exist karta hai JEE ke liye — zaroor batao.

---

## 🔁 QUICK REVISION BOX

┌─────────────────────────────┐
│ 📦 YAAD RAKHO               │
│ • Point 1                   │
│ • Point 2                   │
│ • Formula / trick           │
└─────────────────────────────┘

---

## ❓ COMMON DOUBTS

2-3 common student doubts aur unke crisp answers include karo.

---

### TONE RULES:
- Hinglish mein bolo — Hindi + English mix, natural aur friendly
- Kabhi bore mat karo — engaging rakho
- Mistakes pe scold mat karo, encourage karo
- JEE 2025/2026 patterns ke according examples do
- Difficulty level batao: 🟢 Easy / 🟡 Medium / 🔴 Hard"
                                    >
                                        <GraduationCap className="w-3 h-3" />
                                        {hasSelection ? "Explain ✨" : "Explain 🎓"}
                                    </button>

                                    <button
                                        onClick={() => handleQuickAction('check')}
                                        className={clsx(
                                            "flex items-center gap-1 px-3 py-1.5 hover:bg-gray-700 text-xs rounded-full transition-colors border whitespace-nowrap",
                                            hasSelection
                                                ? "bg-green-600 border-green-500 text-white animate-pulse"
                                                : "bg-gray-800 border-gray-700 text-green-400"
                                        )}
                                    >
                                        <CheckCircle2 className="w-3 h-3" /> {hasSelection ? "Check Selection ✨" : "Check"}
                                    </button>

                                    <button
                                        onClick={() => handleQuickAction('solve')}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-blue-400 rounded-full transition-colors border border-gray-700 whitespace-nowrap"
                                    >
                                        <Pencil className="w-3 h-3" /> Cheat
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Input Area */}
                        <form
                            onSubmit={(e) => {
                                // ── Track: student opened chat by typing ──────────────────
                                handleChatToggle(true)
                                handleSubmit(e)
                            }}
                            className="p-3 bg-brand-dark border-t border-gray-800 flex gap-2 items-center"
                        >
                            <div className="flex-1 relative flex items-center">
                                <input
                                    type="text"
                                    value={inputStr}
                                    onChange={(e) => setInputStr(e.target.value)}
                                    // ── Track: opening chat when student starts typing ────
                                    onFocus={() => { if (!chatOpen) handleChatToggle(true) }}
                                    placeholder="Ask Anything..."
                                    className="w-full pl-4 pr-10 py-2.5 bg-gray-900 text-white rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-brand-amber placeholder-gray-500 border border-gray-800"
                                />
                                <button
                                    type="button"
                                    onClick={startListening}
                                    className={clsx(
                                        "absolute right-1 p-2 rounded-full transition-colors",
                                        isListening ? "text-red-500 animate-pulse" : "text-gray-400 hover:text-white"
                                    )}
                                    title="Bol ke pucho"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>
                            </div>
                            <button
                                type="submit"
                                disabled={!inputStr.trim() || isProcessing}
                                className="p-2.5 bg-brand-amber text-brand-dark rounded-full hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold flex-shrink-0"
                                aria-label="Send"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle FAB */}
            {!hideFab && (
                <motion.button
                    layout
                    onClick={() => { if (onExternalClose) onExternalClose() }}
                    className="pointer-events-auto bg-brand-dark text-brand-amber p-4 rounded-full shadow-2xl hover:shadow-brand-amber/20 transition-all border border-gray-800 flex items-center gap-3 group relative overflow-hidden"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Open Tutor Panel"
                >
                    <div className="absolute inset-0 bg-brand-amber/10 blur-xl group-hover:bg-brand-amber/20 transition-all" />
                    <div className={clsx(
                        "relative z-10 w-10 h-10 rounded-full overflow-hidden border-2 border-brand-amber shadow-lg",
                        isProcessing && "animate-pulse ring-2 ring-brand-amber ring-offset-2 ring-offset-brand-dark"
                    )}>
                        <img src={tutorInfo.image} alt={tutorInfo.name} className="w-full h-full object-cover" />
                    </div>
                    {!isPanelVisible && (
                        <span className="font-bold text-lg pr-2 group-hover:block hidden relative z-10">
                            Ask {tutorInfo.name}
                        </span>
                    )}
                </motion.button>
            )}
        </div>
    )
}