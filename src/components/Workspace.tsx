'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Clock, Sun, Moon, ChevronRight, GripVertical } from 'lucide-react'
import { Editor } from 'tldraw'
import QuestionPanel from './QuestionPanel'
import Scratchpad from './Scratchpad'
import TutorOverlay from './TutorOverlay'
import MathToolbar from './MathToolbar'
import { clsx } from 'clsx'
import { Question } from '@/data/questions'
import { getTracker } from '@/lib/behaviorTracker'
import { useBehaviorTracking } from '@/hooks/useBehaviorTracking'

// FeedbackBanner Component
function FeedbackBanner({ type, title, content, onClose, tutorInfo }: {
    type: 'success' | 'error' | 'hint',
    title: string,
    content: string,
    onClose: () => void,
    tutorInfo?: { name: string, image: string } | null
}) {
    const colors = {
        success: 'bg-green-100 border-green-500 text-green-900',
        error: 'bg-amber-100 border-amber-500 text-amber-900',
        hint: 'bg-yellow-50 border-yellow-400 text-yellow-900'
    }
    const icons = { success: '🎉', error: '⚠️', hint: '💡' }

    return (
        <div className={clsx(
            "absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full border shadow-lg flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300",
            colors[type]
        )}>
            {tutorInfo ? (
                <img src={tutorInfo.image} alt={tutorInfo.name} className="w-8 h-8 rounded-full border border-gray-300 object-cover flex-shrink-0" />
            ) : (
                <span className="text-xl">{icons[type]}</span>
            )}
            <div>
                <span className="font-bold mr-2">{title}</span>
                <span className="opacity-90">{content}</span>
            </div>
            <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100 font-bold">✕</button>
        </div>
    )
}

// Helper to clean LaTeX for Tldraw
function formatMathForBoard(text: string) {
    return text
        .replace(/\$\$/g, '')
        .replace(/\\\[/g, '')
        .replace(/\\\]/g, '')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')
        .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
        .replace(/\\sqrt/g, '√')
        .replace(/\\pi/g, 'π')
        .replace(/\\theta/g, 'θ')
        .replace(/\\cdot/g, '·')
        .replace(/\\times/g, '×')
        .replace(/\\le/g, '≤')
        .replace(/\\ge/g, '≥')
        .replace(/\\approx/g, '≈')
        .replace(/\\ne/g, '≠')
        .replace(/\\pm/g, '±')
}

function toRichText(text: string) {
    const cleanText = formatMathForBoard(text)
    const lines = cleanText.split('\n')
    const content = lines.map((line) => {
        if (!line) return { type: 'paragraph' }
        return { type: 'paragraph', content: [{ type: 'text', text: line }] }
    })
    return { type: 'doc', content }
}

type TutorMode = 'mains' | 'advanced'

function QuestionListItem({
    question, index, isSelected, onClick, isDarkMode
}: {
    question: Question, index: number, isSelected: boolean, onClick: () => void, isDarkMode: boolean
}) {
    const difficultyColors: Record<string, string> = {
        'Easy':   'bg-green-100 text-green-700 border-green-300',
        'Medium': 'bg-yellow-100 text-yellow-700 border-yellow-300',
        'Hard':   'bg-red-100 text-red-700 border-red-300',
    }

    return (
        <button
            onClick={onClick}
            className={clsx(
                "w-full text-left p-3 border-b transition-all duration-200",
                isSelected
                    ? (isDarkMode ? 'bg-brand-amber/20 border-l-4 border-l-brand-amber' : 'bg-amber-50 border-l-4 border-l-brand-amber')
                    : (isDarkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50')
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className={clsx("text-xs font-medium mb-1 truncate", isDarkMode ? 'text-brand-amber' : 'text-brand-dark')}>
                        {question.subject}
                    </div>
                    <div className={clsx("text-sm font-semibold truncate", isDarkMode ? 'text-gray-200' : 'text-gray-900')}>
                        {question.title}
                    </div>
                </div>
                <span className={clsx(
                    "text-xs px-2 py-0.5 rounded-full border flex-shrink-0 font-medium",
                    difficultyColors[question.difficulty] || (isDarkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-600 border-gray-200')
                )}>
                    {question.difficulty}
                </span>
            </div>
        </button>
    )
}

export default function Workspace({ questions }: { questions: Question[] }) {
    const [selectedSubject, setSelectedSubject]     = useState<string>('All')
    const [selectedTopic, setSelectedTopic]         = useState<string>('All')
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All')

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [tutorMode, setTutorMode]   = useState<TutorMode>('mains')
    const [hasSelection, setHasSelection] = useState(false)
    const [isDarkMode, setIsDarkMode] = useState(false)
    const [isTutorOpen, setIsTutorOpen] = useState(false)
    const [startTime, setStartTime]   = useState<number>(Date.now())
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [isTimerPaused, setIsTimerPaused]   = useState(false)
    const elapsedSecondsRef = useRef(0)

    const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'hint', title: string, content: string } | null>(null)
    const [editor, setEditor] = useState<Editor | null>(null)

    const [leftPanelWidth, setLeftPanelWidth] = useState(480)
    const [isResizing, setIsResizing] = useState(false)
    const leftPanelRef = useRef<HTMLDivElement>(null)

    const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string | any }>>([])
    const [isProcessing, setIsProcessing] = useState(false)

    // ── Behavior tracking hook ────────────────────────────────────────────────
    const { getSummary, trackTutorOpen, trackTutorClose } = useBehaviorTracking()

    // ── Track tutor open/close ────────────────────────────────────────────────
    useEffect(() => {
        if (isTutorOpen) trackTutorOpen()
        else trackTutorClose()
    }, [isTutorOpen])

    // ── Track when a "clear all" happens (the big erase) ─────────────────────
    // Workspace calls editor.deleteShapes on question change — we detect this
    // via the editor inside handleQuestionChange below

    // Selection tracking
    useEffect(() => {
        if (!editor) return
        const handleChange = () => setHasSelection(editor.getSelectedShapeIds().length > 0)
        const cleanup = editor.store.listen(handleChange)
        handleChange()
        return () => cleanup()
    }, [editor])

    useEffect(() => {
        const interval = setInterval(() => {
            if (!isTimerPaused) {
                elapsedSecondsRef.current += 1
                setElapsedSeconds(elapsedSecondsRef.current)
            }
        }, 1000)
        return () => clearInterval(interval)
    }, [isTimerPaused])

    const resetTimer = () => {
        elapsedSecondsRef.current = 0
        setElapsedSeconds(0)
        setStartTime(Date.now())
        setIsTimerPaused(false)
    }

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
        const s = (totalSeconds % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    const filteredQuestions = questions.filter(q =>
        (selectedSubject   === 'All' || q.subject    === selectedSubject) &&
        (selectedTopic     === 'All' || q.topic      === selectedTopic) &&
        (selectedDifficulty === 'All' || q.difficulty === selectedDifficulty)
    )

    const question = filteredQuestions[currentQuestionIndex] || questions[0]

    const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
        setter(value)
        setCurrentQuestionIndex(0)
        setMessages([])
        setBanner(null)
        resetTimer()
        if (editor) {
            const allShapeIds = Array.from(editor.getCurrentPageShapeIds())
            if (allShapeIds.length > 0) editor.deleteShapes(allShapeIds)
        }
    }

    const handleQuestionChange = (index: number) => {
        setCurrentQuestionIndex(index)
        setMessages([])
        setBanner(null)
        resetTimer()

        // ── Track the clear when student switches questions ────────────────
        try { getTracker().trackDrawingClear() } catch {}

        if (editor) {
            const allShapeIds = Array.from(editor.getCurrentPageShapeIds())
            if (allShapeIds.length > 0) editor.deleteShapes(allShapeIds)
        }
    }

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
    }, [])

    useEffect(() => {
        if (!isResizing) return
        const handleMouseMove = (e: MouseEvent) => {
            if (!leftPanelRef.current) return
            const parentRect  = leftPanelRef.current.parentElement!.getBoundingClientRect()
            const newWidth    = e.clientX - parentRect.left
            const clampedWidth = Math.max(220, Math.min(window.innerWidth * 0.6, newWidth))
            leftPanelRef.current.style.width = `${clampedWidth}px`
        }
        const handleMouseUp = () => {
            if (!leftPanelRef.current) { setIsResizing(false); return }
            const currentWidth = leftPanelRef.current.getBoundingClientRect().width
            setLeftPanelWidth(Math.max(220, Math.min(window.innerWidth * 0.6, currentWidth)))
            setIsResizing(false)
        }
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        document.body.style.cursor    = 'col-resize'
        document.body.style.userSelect = 'none'
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor    = ''
            document.body.style.userSelect = ''
        }
    }, [isResizing])

    const handleAskAI = async (text: string) => {
        console.log("handleAskAI called with:", text)
        setBanner(null)

        const newMessages = [...messages, { role: 'user' as const, content: text }]
        setMessages(newMessages)
        setIsProcessing(true)

        let hasSelectionLocal = false
        let apiText = text

        try {
            let contextImage = null
            if (editor) {
                try {
                    const selectedIds = editor.getSelectedShapeIds()
                    hasSelectionLocal = selectedIds.length > 0

                    const shapeIds = hasSelectionLocal
                        ? Array.from(selectedIds)
                        : Array.from(editor.getCurrentPageShapeIds())

                    if (hasSelectionLocal && !apiText.includes('(Focusing on')) {
                        apiText += " (Focusing exactly on the specific part selected in the provided image)"
                    }

                    if (shapeIds.length > 0) {
                        try {
                            const result = await editor.toImage(shapeIds, { format: 'png', scale: 1, background: false })
                            if (result && result.blob) {
                                if (result.blob.size > 3 * 1024 * 1024) {
                                    console.warn("Image too large, skipping image context")
                                    setBanner({ type: 'error', title: 'Image Too Large', content: 'Your drawing is too complex to send completely. I will try to answer based on text.' })
                                } else {
                                    const base64 = await new Promise<string>((resolve, reject) => {
                                        const reader = new FileReader()
                                        reader.onloadend = () => resolve(reader.result as string)
                                        reader.onerror = reject
                                        reader.readAsDataURL(result.blob)
                                    })
                                    contextImage = base64.includes(',') ? base64.split(',')[1] : base64
                                }
                            }
                        } catch (imgError) {
                            console.error("Failed to export image:", imgError)
                        }
                    }
                } catch (e) {
                    console.error("Snapshot failed", e)
                }
            }

            const timeTaken = Math.floor((Date.now() - startTime) / 1000)

            // ── Get behavior summary and session ID to send to the agent ──────
            const behaviorSummary = getSummary()
            let sessionId: string | undefined
            try { sessionId = getTracker().getSessionId() } catch {}

            const response = await fetch('/api/tutor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages.map(m => {
                        if (m === newMessages[newMessages.length - 1]) {
                            return { ...m, content: apiText }
                        }
                        return { ...m, content: typeof m.content === 'string' ? m.content : m.content.content }
                    }),
                    questionContext: question,
                    image: contextImage,
                    tutorMode: tutorMode,
                    timeTaken: timeTaken,
                    // ── NEW: behavior data for the adaptive agent ─────────────
                    behaviorSummary: behaviorSummary,
                    sessionId: sessionId,
                })
            })

            const data = await response.json()
            console.log("Response data:", data)

            if (data.type) {
                if (data.type === 'success' || data.type === 'error' || data.type === 'step' || data.type === 'explain_visual' || data.type === 'resume_question' || data.type === 'hint') {

                    if (data.type === 'explain_visual') {
                        setIsTimerPaused(true)
                        if (editor) {
                            const sanitizeColor = (color: string): string => {
                                if (!color) return 'black'
                                const c = color.toLowerCase()
                                if (c === 'gray') return 'grey'
                                const allowed = ['black','grey','light-violet','violet','blue','light-blue','yellow','orange','green','light-green','light-red','red','white']
                                return allowed.includes(c) ? c : 'black'
                            }

                            const pageBounds = editor.getCurrentPageBounds()
                            const originX = pageBounds ? pageBounds.maxX + 120 : 80
                            const CARD_W = 640
                            let y = 60

                            const estH = (text: string) => {
                                const lines = text.split('\n').reduce((acc, l) => acc + Math.max(1, Math.ceil(l.length / 70)), 0)
                                return Math.max(80, lines * 24 + 40)
                            }

                            editor.createShape({
                                type: 'text',
                                x: originX,
                                y,
                                props: {
                                    richText: toRichText(`📚  ${data.title || 'Concept Explanation'}`),
                                    scale: 1.6,
                                    autoSize: true,
                                    color: 'violet',
                                } as any
                            })
                            y += 80

                            const sectionColors = ['violet','blue','green','red','orange','light-blue','light-green']

                            if (data.flowchart && Array.isArray(data.flowchart)) {
                                data.flowchart.forEach((stepContent: string, idx: number) => {
                                    const isLast = idx === data.flowchart.length - 1
                                    const col = sectionColors[idx % sectionColors.length]

                                    editor.createShape({
                                        type: 'text',
                                        x: originX,
                                        y,
                                        props: {
                                            richText: toRichText(stepContent),
                                            scale: 1,
                                            autoSize: true,
                                            color: isLast ? 'red' : col,
                                        } as any
                                    })

                                    const cardH = estH(stepContent) + 20
                                    y += cardH

                                    if (!isLast) {
                                        y += 8
                                        editor.createShape({
                                            type: 'arrow',
                                            x: originX + 100,
                                            y,
                                            props: {
                                                start: { x: 0, y: 0 },
                                                end:   { x: 0, y: 36 },
                                                color: 'grey',
                                            } as any
                                        })
                                        y += 46
                                    }
                                })
                                y += 60
                            }

                            if (data.diagram && Array.isArray(data.diagram) && data.diagram.length > 0) {
                                editor.createShape({
                                    type: 'text',
                                    x: originX,
                                    y,
                                    props: {
                                        richText: toRichText('🎨  DIAGRAM'),
                                        scale: 1.3,
                                        autoSize: true,
                                        color: 'blue',
                                    } as any
                                })
                                y += 44

                                const ox = originX + 20
                                const oy = y

                                data.diagram.forEach((shape: any) => {
                                    try {
                                        if (shape.type === 'arrow' || shape.type === 'line') {
                                            editor.createShape({
                                                type: 'arrow',
                                                x: ox + (shape.start?.x || 0),
                                                y: oy + (shape.start?.y || 0),
                                                props: {
                                                    start: { x: 0, y: 0 },
                                                    end: {
                                                        x: (shape.end?.x || 0) - (shape.start?.x || 0),
                                                        y: (shape.end?.y || 0) - (shape.start?.y || 0),
                                                    },
                                                    color: sanitizeColor(shape.color),
                                                } as any
                                            })
                                            if (shape.label) {
                                                editor.createShape({
                                                    type: 'text',
                                                    x: ox + ((shape.start?.x || 0) + (shape.end?.x || 0)) / 2 + 12,
                                                    y: oy + ((shape.start?.y || 0) + (shape.end?.y || 0)) / 2 - 18,
                                                    props: {
                                                        richText: toRichText(shape.label),
                                                        color: sanitizeColor(shape.color),
                                                        scale: 0.9,
                                                        autoSize: true,
                                                    } as any
                                                })
                                            }
                                        } else if (shape.type === 'geo' || shape.type === 'box' || shape.type === 'rectangle') {
                                            editor.createShape({
                                                type: 'geo',
                                                x: ox + (shape.x || 0),
                                                y: oy + (shape.y || 0),
                                                props: { geo: 'rectangle', w: shape.w || 60, h: shape.h || 60, color: sanitizeColor(shape.color) } as any
                                            })
                                        } else if (shape.type === 'ellipse') {
                                            editor.createShape({
                                                type: 'geo',
                                                x: ox + (shape.x || 0),
                                                y: oy + (shape.y || 0),
                                                props: { geo: 'ellipse', w: shape.w || 50, h: shape.h || 50, color: sanitizeColor(shape.color) } as any
                                            })
                                        } else if (shape.type === 'text') {
                                            editor.createShape({
                                                type: 'text',
                                                x: ox + (shape.x || 0),
                                                y: oy + (shape.y || 0),
                                                props: {
                                                    richText: toRichText(shape.text || shape.label || ''),
                                                    color: sanitizeColor(shape.color),
                                                    scale: 1,
                                                    autoSize: true,
                                                } as any
                                            })
                                        }
                                    } catch (e) { console.error('diagram shape error', e) }
                                })
                            }

                            setTimeout(() => {
                                try { editor.zoomToFit({ animation: { duration: 500 } }) } catch (_) {}
                            }, 300)
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: data }])
                        setIsTutorOpen(true)

                    } else if (data.type === 'resume_question') {
                        setIsTimerPaused(false)
                        resetTimer()
                        if (editor) editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()))
                        setBanner({ type: 'success', title: 'Resuming...', content: 'Timer and scratchpad have been completely reset. Let\'s try the problem again.' })
                        setMessages(prev => [...prev, { role: 'assistant', content: data }])

                    } else {
                        const bannerType = (data.type === 'step' || data.type === 'success') ? 'success' : (data.type === 'error' ? 'error' : 'hint')

                        let tutorName = 'AI Tutor'
                        let tutorImage = '/image.png'
                        const subj = selectedSubject !== 'All' ? selectedSubject : (questions[currentQuestionIndex]?.subject || 'Physics')
                        if (subj === 'Math')      { tutorName = 'Ashish Sir'; tutorImage = '/tutors/ashish_sir.png' }
                        else if (subj === 'Physics')   { tutorName = 'Anish Sir';  tutorImage = '/tutors/anish_sir.png' }
                        else if (subj === 'Chemistry') { tutorName = 'Pankaj Sir'; tutorImage = '/tutors/pankaj_sir.png' }

                        if (data.type !== 'step') {
                            setBanner({ type: bannerType, title: data.title || 'AI Action', content: data.content, tutorInfo: { name: tutorName, image: tutorImage } } as any)
                        }

                        if (editor) {
                            try {
                                if (data.diagram && Array.isArray(data.diagram)) {
                                    const sanitizeColor = (color: string) => {
                                        if (!color) return 'black'
                                        const c = color.toLowerCase()
                                        if (c === 'gray') return 'grey'
                                        const allowed = ["black","grey","light-violet","violet","blue","light-blue","yellow","orange","green","light-green","light-red","red","white"]
                                        return allowed.includes(c) ? c : 'black'
                                    }
                                    data.diagram.forEach((shape: any) => {
                                        try {
                                            if (shape.type === 'arrow' || shape.type === 'line') {
                                                editor.createShape({ type: 'arrow', x: (shape.start?.x || 0), y: (shape.start?.y || 0), props: { start: { x: 0, y: 0 }, end: { x: (shape.end?.x || 0) - (shape.start?.x || 0), y: (shape.end?.y || 0) - (shape.start?.y || 0) }, color: sanitizeColor(shape.color) } as any })
                                                if (shape.label) editor.createShape({ type: 'text', x: ((shape.start?.x || 0) + (shape.end?.x || 0)) / 2 + 10, y: ((shape.start?.y || 0) + (shape.end?.y || 0)) / 2 - 20, props: { richText: toRichText(shape.label), color: sanitizeColor(shape.color), size: 's' } as any })
                                            } else if (shape.type === 'box' || shape.type === 'rectangle' || shape.type === 'ellipse') {
                                                editor.createShape({ type: 'geo', x: (shape.x || 0), y: (shape.y || 0), props: { geo: shape.type === 'ellipse' ? 'ellipse' : 'rectangle', w: shape.w || 50, h: shape.h || 50, color: sanitizeColor(shape.color) } as any })
                                            } else if (shape.type === 'text') {
                                                editor.createShape({ type: 'text', x: (shape.x || 0), y: (shape.y || 0), props: { richText: toRichText(shape.text || shape.label || ''), color: sanitizeColor(shape.color) } as any })
                                            }
                                        } catch (e) { console.error("Could not draw diagram shape", e) }
                                    })
                                }

                                if (data.type !== 'error' && data.type !== 'success') {
                                    const shapeIds = Array.from(editor.getCurrentPageShapeIds())
                                    let maxY = 100
                                    for (const id of shapeIds) {
                                        const shape = editor.getShape(id)
                                        if (shape && shape.type !== 'image') {
                                            const bounds = editor.getShapePageBounds(id)
                                            if (bounds && bounds.maxY > maxY) maxY = bounds.maxY
                                        }
                                    }
                                    editor.createShape({
                                        type: 'text',
                                        x: 50,
                                        y: maxY + 60,
                                        props: {
                                            richText: toRichText(String(data.content)),
                                            scale: 1,
                                            autoSize: true,
                                            color: data.type === 'step' ? 'blue' : 'black'
                                        } as any
                                    })
                                }
                                setMessages(prev => [...prev, { role: 'assistant', content: data }])
                            } catch (e) {
                                console.error("Auto-write failed", e)
                                setMessages(prev => [...prev, { role: 'assistant', content: data }])
                            }
                        } else {
                            setMessages(prev => [...prev, { role: 'assistant', content: data }])
                        }
                    }

                    if (data.resource) {
                        setMessages(prev => [...prev, { role: 'assistant', content: { type: 'hint', title: `💡 Learn More: ${data.resource.title}`, content: `Tip: Search for "${data.resource.query}" to understand the underlying concept.` } }])
                    }

                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: data.content || JSON.stringify(data) }])
                }
            } else if (data.reply) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
            } else if (data.error) {
                setBanner({ type: 'error', title: 'Error', content: data.error })
                setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error. See the banner above." }])
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: typeof data === 'string' ? data : "I'm not sure I understood that." }])
            }

        } catch (error) {
            console.error("Fetch error:", error)
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to my brain right now. Try again?" }])
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className={`flex h-full relative ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`}>
            {banner && <FeedbackBanner {...banner} onClose={() => setBanner(null)} />}

            {/* LEFT PANEL */}
            <div ref={leftPanelRef} style={{ width: leftPanelWidth }} className="flex flex-col border-r flex-shrink-0">
                <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-b'} p-3 flex-shrink-0`}>
                    <h2 className={clsx("text-lg font-bold mb-3 flex items-center gap-2", isDarkMode ? 'text-white' : 'text-gray-900')}>
                        <ChevronRight className="w-5 h-5 text-brand-amber" />
                        Questions
                    </h2>
                    <div className="flex flex-col gap-2">
                        <select className={`w-full p-2 text-sm border rounded outline-none ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 text-black'}`} value={selectedSubject} onChange={(e) => handleFilterChange(setSelectedSubject, e.target.value)}>
                            <option value="All">All Subjects</option>
                            {Array.from(new Set(questions.map(q => q.subject))).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select className={`w-full p-2 text-sm border rounded outline-none ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 text-black'}`} value={selectedTopic} onChange={(e) => handleFilterChange(setSelectedTopic, e.target.value)}>
                            <option value="All">All Topics</option>
                            {Array.from(new Set(questions.map(q => q.topic).filter(Boolean))).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select className={`w-full p-2 text-sm border rounded outline-none ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 text-black'}`} value={selectedDifficulty} onChange={(e) => handleFilterChange(setSelectedDifficulty, e.target.value)}>
                            <option value="All">All Difficulties</option>
                            {Array.from(new Set(questions.map(q => q.difficulty).filter(Boolean))).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>

                <div className={`overflow-y-auto flex-shrink-0 max-h-48 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    {filteredQuestions.length === 0 ? (
                        <div className={clsx("p-4 text-center", isDarkMode ? 'text-gray-400' : 'text-gray-500')}>No questions found</div>
                    ) : (
                        filteredQuestions.map((q, idx) => (
                            <QuestionListItem key={q.id} question={q} index={idx} isSelected={idx === currentQuestionIndex} onClick={() => handleQuestionChange(idx)} isDarkMode={isDarkMode} />
                        ))
                    )}
                </div>

                <div className={`flex-1 min-h-0 overflow-y-auto ${isDarkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t'}`}>
                    <QuestionPanel question={question} isDarkMode={isDarkMode} />
                </div>

                {/* Bottom Controls */}
                <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-t'} p-3 flex-shrink-0`}>
                    <div className={clsx(
                        "flex items-center justify-between mb-3 px-3 py-2 rounded border text-sm font-mono font-bold shadow-inner",
                        isTimerPaused
                            ? 'bg-red-500/20 text-red-500 border-red-500/50'
                            : (isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700')
                    )}>
                        <div className="flex items-center gap-2">
                            <Clock className={clsx("w-4 h-4", isTimerPaused ? "text-red-500 animate-pulse" : "text-brand-amber")} />
                            <span className={isTimerPaused ? "animate-pulse" : ""}>{isTimerPaused ? "PAUSED" : formatTime(elapsedSeconds)}</span>
                        </div>
                        {isTimerPaused && (
                            <button
                                onClick={() => {
                                    setIsTimerPaused(false)
                                    resetTimer()
                                    if (editor) editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()))
                                    setBanner({ type: 'success', title: 'Resumed', content: 'Timer running! Let\'s solve it.' })
                                }}
                                className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full hover:bg-red-600 transition-colors"
                            >
                                Resume
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className={clsx("flex-1 p-2 rounded border flex items-center justify-center gap-2 transition-colors", isDarkMode ? 'bg-gray-700 border-gray-600 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200')}
                        >
                            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            <span className="text-xs font-medium">{isDarkMode ? 'Light' : 'Dark'}</span>
                        </button>
                        <div className="flex-1 flex border rounded overflow-hidden">
                            <button onClick={() => setTutorMode('mains')} className={clsx("flex-1 px-2 py-2 text-xs font-bold transition-colors", tutorMode === 'mains' ? 'bg-blue-600 text-white' : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'))}>MAINS</button>
                            <button onClick={() => setTutorMode('advanced')} className={clsx("flex-1 px-2 py-2 text-xs font-bold transition-colors", tutorMode === 'advanced' ? 'bg-purple-700 text-white' : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'))}>ADV</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Resizable Divider */}
            <div
                className={clsx("w-1.5 flex-shrink-0 cursor-col-resize transition-colors hover:bg-brand-amber group relative", isResizing ? 'bg-brand-amber' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-300'))}
                onMouseDown={handleMouseDown}
            >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40 group-hover:opacity-100 transition-opacity">
                    <GripVertical className={clsx("w-4 h-4", isDarkMode ? 'text-gray-300' : 'text-gray-600')} />
                </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                <MathToolbar
                    editor={editor}
                    isDarkMode={isDarkMode}
                    isTutorOpen={isTutorOpen}
                    onTutorToggle={() => setIsTutorOpen(!isTutorOpen)}
                    subject={question?.subject}
                />
                <div className="flex-1 relative z-0">
                    <Scratchpad onEditorMount={setEditor} isDarkMode={isDarkMode} />
                </div>
                <TutorOverlay
                    onAskAI={handleAskAI}
                    onGetHint={() => handleAskAI("Can you give me a small hint for the next step?")}
                    isProcessing={isProcessing}
                    messages={messages}
                    subject={question.subject}
                    externalIsOpen={isTutorOpen}
                    onExternalClose={() => setIsTutorOpen(false)}
                    hideFab={true}
                    hasSelection={hasSelection}
                />
            </div>
        </div>
    )
}