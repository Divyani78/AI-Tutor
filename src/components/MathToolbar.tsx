'use client'

import React, { useState } from 'react'
import { X, Type, Atom, Calculator, FlaskConical, Wand2, Mic, Pencil, Eraser, MousePointer2, Undo2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'
import { Editor } from 'tldraw'

// Helper to construct Tldraw Rich Text object exactly as required by schema
function toRichText(text: string) {
    const lines = text.split('\n')
    const content = lines.map((line) => {
        if (!line) return { type: 'paragraph' }
        return { type: 'paragraph', content: [{ type: 'text', text: line }] }
    })
    return { type: 'doc', content }
}

const SUBJECT_SYMBOLS = {
    math: [
        { label: 'x²', value: '²' },
        { label: '√', value: '√' },
        { label: 'π', value: 'π' },
        { label: 'θ', value: 'θ' },
        { label: '∞', value: '∞' },
        { label: '∫', value: '∫' },
        { label: '∑', value: '∑' },
        { label: '≠', value: '≠' },
        { label: '≤', value: '≤' },
        { label: '≥', value: '≥' },
        { label: '±', value: '±' },
        { label: '≈', value: '≈' },
        { label: '/', value: '/' },
        { label: '(', value: '(' },
        { label: ')', value: ')' },
    ],
    physics: [
        { label: 'Δ', value: 'Δ' },
        { label: 'ω', value: 'ω' },
        { label: 'α', value: 'α' },
        { label: 'β', value: 'β' },
        { label: 'γ', value: 'γ' },
        { label: 'λ', value: 'λ' },
        { label: 'μ', value: 'μ' },
        { label: 'ρ', value: 'ρ' },
        { label: 'τ', value: 'τ' },
        { label: 'Ω', value: 'Ω' },
        { label: '°', value: '°' },
        { label: '→', value: '→' },
        { label: 'sin', value: 'sin(' },
        { label: 'cos', value: 'cos(' },
        { label: 'tan', value: 'tan(' },
    ],
    chemistry: [
        { label: '⇌', value: '⇌' },
        { label: '→', value: '→' },
        { label: '↑', value: '↑' },
        { label: '↓', value: '↓' },
        { label: '∆', value: '∆' },
        { label: '°C', value: '°C' },
        { label: '₀', value: '₀' },
        { label: '₁', value: '₁' },
        { label: '₂', value: '₂' },
        { label: '₃', value: '₃' },
        { label: '₄', value: '₄' },
        { label: '⁺', value: '⁺' },
        { label: '⁻', value: '⁻' },
        { label: '[', value: '[' },
        { label: ']', value: ']' },
    ],
    abc: [
        { label: 'a', value: 'a' }, { label: 'b', value: 'b' }, { label: 'c', value: 'c' }, { label: 'd', value: 'd' }, { label: 'e', value: 'e' },
        { label: 'f', value: 'f' }, { label: 'g', value: 'g' }, { label: 'h', value: 'h' }, { label: 'i', value: 'i' }, { label: 'j', value: 'j' },
        { label: 'k', value: 'k' }, { label: 'l', value: 'l' }, { label: 'm', value: 'm' }, { label: 'n', value: 'n' }, { label: 'o', value: 'o' },
        { label: 'p', value: 'p' }, { label: 'q', value: 'q' }, { label: 'r', value: 'r' }, { label: 's', value: 's' }, { label: 't', value: 't' },
        { label: 'u', value: 'u' }, { label: 'v', value: 'v' }, { label: 'w', value: 'w' }, { label: 'x', value: 'x' }, { label: 'y', value: 'y' },
        { label: 'z', value: 'z' }, { label: '=', value: '=' }, { label: '+', value: '+' }, { label: '-', value: '-' }, { label: '␣', value: ' ' }
    ]
}

type TabType = 'math' | 'physics' | 'chemistry' | 'abc'

interface MathToolbarProps {
    editor: Editor | null
    isDarkMode?: boolean
    onTutorToggle?: () => void
    isTutorOpen?: boolean
    subject?: string
}

export default function MathToolbar({ editor, isDarkMode = false, onTutorToggle, isTutorOpen, subject }: MathToolbarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [text, setText] = useState('')
    const [activeTab, setActiveTab] = useState<TabType>('math')
    const [isConverting, setIsConverting] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)

    const getTutorInfo = (subjectName?: string) => {
        switch (subjectName?.toLowerCase()) {
            case 'mathematics':
            case 'math':
                return { name: 'Ashutosh Sir', image: '/tutors/ashutosh_sir.png', role: 'Math Expert' }
            case 'physics':
                return { name: 'Anish Sir', image: '/tutors/anish_sir.png', role: 'Physics Expert' }
            case 'chemistry':
                return { name: 'Pankaj Sir', image: '/tutors/pankaj_sir.png', role: 'Chemistry Expert' }
            default:
                return { name: 'AI Tutor', image: '/image.png', role: 'Expert Tutor' }
        }
    }
    const tutorInfo = getTutorInfo(subject)

    const startListening = () => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support Speech Recognition.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
                .map((result: any) => result[0])
                .map((result) => result.transcript)
                .join('');
            setText(prev => prev.trim() + " " + transcript);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    }

    const handleConvert = async () => {
        if (!editor) return

        let selectedIds = Array.from(editor.getSelectedShapeIds())
        if (selectedIds.length === 0) {
            const allShapeIds = Array.from(editor.getCurrentPageShapeIds())
            selectedIds = allShapeIds.filter(id => editor.getShape(id)?.type === 'draw')

            if (selectedIds.length === 0) {
                alert("Please draw something first to Auto-Format!")
                return
            }
            editor.setSelectedShapes(selectedIds)
        }

        setIsConverting(true)
        try {
            // @ts-ignore
            const result = await editor.toImage(selectedIds, { format: 'png', scale: 1, background: false })

            let base64 = ''
            if (result && result.blob) {
                base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.onerror = reject
                    reader.readAsDataURL(result.blob)
                })
                if (base64.includes(',')) base64 = base64.split(',')[1]
            }

            if (!base64) throw new Error("Could not capture image from selection")

            const res = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64 })
            })

            const data = await res.json()
            if (data.error) throw new Error(data.error)

            const bounds = editor.getSelectionPageBounds()
            editor.deleteShapes(selectedIds)

            if (bounds) {
                editor.createShape({
                    type: 'text',
                    x: bounds.x,
                    y: bounds.y - 20,
                    props: {
                        richText: toRichText(data.text),
                        scale: 1,
                        autoSize: true
                    } as any
                })
            }

        } catch (e: any) {
            alert("Failed to format: " + (e.message || "Unknown error"))
        } finally {
            setIsConverting(false)
        }
    }

    const handleSymbolClick = (val: string) => {
        setText(prev => prev + val)
    }

    const handleInsert = () => {
        if (!editor || !text.trim()) return

        const { x, y, w, h } = editor.getViewportPageBounds()
        const centerX = x + w / 2
        const centerY = y + h / 2

        editor.createShape({
            type: 'text',
            x: centerX - 50,
            y: centerY - 20,
            props: {
                richText: toRichText(text),
                scale: 1.5,
                autoSize: true
            } as any
        })

        setText('')
        setIsOpen(false)
    }

    return (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-[100] flex flex-col items-center gap-1">
            {/* Input Tools Panel - Opens as a popup */}
            {isOpen && (
                <div className={clsx(
                    "absolute right-14 top-1/2 -translate-y-1/2 mr-2 w-72 rounded-2xl shadow-2xl border animate-in slide-in-from-right-4 fade-in duration-200 flex flex-col overflow-hidden",
                    isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-black'
                )}>
                    <div className={clsx(
                        "flex justify-between items-center p-3 border-b flex-shrink-0",
                        isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                    )}>
                        <span className="font-bold flex items-center gap-2 text-sm">
                            <Calculator className="w-4 h-4 text-brand-amber" /> Input Tools
                        </span>
                        <button 
                            onClick={() => setIsOpen(false)} 
                            className={clsx(
                                "p-1.5 rounded-full transition-colors",
                                isDarkMode ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-100 text-red-600'
                            )}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-3 flex flex-col max-h-[60vh] overflow-hidden">
                        {/* Tabs */}
                        <div className={clsx(
                            "flex gap-1 mb-3 p-1 rounded-lg flex-shrink-0",
                            isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
                        )}>
                            {[
                                { id: 'math', icon: Calculator, label: 'Math' },
                                { id: 'physics', icon: Atom, label: 'Phy' },
                                { id: 'chemistry', icon: FlaskConical, label: 'Chem' },
                                { id: 'abc', icon: Type, label: 'ABC' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={clsx(
                                        "flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-md transition-all",
                                        activeTab === tab.id
                                            ? (isDarkMode ? "bg-gray-700 text-brand-amber shadow-sm" : "bg-white text-brand-dark shadow-sm")
                                            : (isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700")
                                    )}
                                >
                                    <tab.icon className="w-3 h-3" />
                                </button>
                            ))}
                        </div>

                        {/* Text Input */}
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className={clsx(
                                "w-full p-2 border rounded-lg mb-3 text-sm font-mono focus:ring-2 focus:ring-brand-amber focus:border-brand-amber outline-none min-h-[60px] flex-shrink-0 resize-none",
                                isDarkMode ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-black placeholder-gray-400'
                            )}
                            placeholder={`Type ${activeTab}...`}
                            autoFocus
                        />

                        {/* Symbols Grid */}
                        <div className="grid grid-cols-5 gap-1 mb-3 overflow-y-auto max-h-[120px]">
                            {SUBJECT_SYMBOLS[activeTab].map((sym) => (
                                <button
                                    key={sym.label}
                                    onClick={() => handleSymbolClick(sym.value)}
                                    className={clsx(
                                        "p-1.5 rounded border text-xs font-medium transition-colors flex items-center justify-center",
                                        isDarkMode ? 'bg-gray-900 border-gray-700 hover:bg-gray-700 text-white' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-black'
                                    )}
                                    type="button"
                                >
                                    {sym.label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleInsert}
                            disabled={!text.trim()}
                            className="w-full py-1.5 bg-brand-amber text-brand-dark font-bold text-sm rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Insert
                        </button>
                    </div>
                </div>
            )}

            {/* Vertical Toolbar */}
            <div className={clsx(
                "flex flex-col items-center gap-1 p-2 rounded-l-2xl shadow-2xl border-r-0 backdrop-blur-xl",
                isDarkMode ? 'bg-gray-900/90 border-gray-700/50' : 'bg-white/90 border-gray-200/50'
            )}>
                {/* Expand/Collapse Toggle */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={clsx(
                        "p-1.5 rounded-full transition-colors",
                        isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                    )}
                    title={isExpanded ? "Collapse" : "Expand"}
                >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>

                {/* Divider */}
                <div className={clsx("w-8 h-px", isDarkMode ? 'bg-gray-700' : 'bg-gray-300')} />

                {/* Drawing Tools Section */}
                <div className="flex flex-col gap-1">
                    <button 
                        onClick={() => editor?.setCurrentTool('select')} 
                        className={clsx(
                            "p-2 rounded-lg hover:bg-brand-amber/20 hover:text-brand-amber transition-colors",
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        )} 
                        title="Select"
                    >
                        <MousePointer2 className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => editor?.setCurrentTool('draw')} 
                        className={clsx(
                            "p-2 rounded-lg hover:bg-brand-amber/20 hover:text-brand-amber transition-colors",
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        )} 
                        title="Pen"
                    >
                        <Pencil className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => editor?.setCurrentTool('eraser')} 
                        className={clsx(
                            "p-2 rounded-lg hover:bg-brand-amber/20 hover:text-brand-amber transition-colors",
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        )} 
                        title="Eraser"
                    >
                        <Eraser className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => editor?.setCurrentTool('text')} 
                        className={clsx(
                            "p-2 rounded-lg hover:bg-brand-amber/20 hover:text-brand-amber transition-colors",
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        )} 
                        title="Text"
                    >
                        <Type className="w-5 h-5" />
                    </button>
                </div>

                {/* Divider */}
                <div className={clsx("w-8 h-px", isDarkMode ? 'bg-gray-700' : 'bg-gray-300')} />

                {/* Action Tools Section - Only visible when expanded */}
                {isExpanded && (
                    <>
                        <div className="flex flex-col gap-1">
                            <button 
                                onClick={() => editor?.undo()} 
                                className={clsx(
                                    "p-2 rounded-lg hover:bg-brand-amber/20 hover:text-brand-amber transition-colors",
                                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                )} 
                                title="Undo"
                            >
                                <Undo2 className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => { if (editor) editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds())) }} 
                                className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors" 
                                title="Clear ALL"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Divider */}
                        <div className={clsx("w-8 h-px", isDarkMode ? 'bg-gray-700' : 'bg-gray-300')} />

                        <div className="flex flex-col gap-1">
                            <button
                                onClick={() => {
                                    setIsOpen(true)
                                    startListening()
                                }}
                                className={clsx(
                                    "p-2 rounded-lg transition-colors",
                                    isListening ? "bg-red-500/20 text-red-500 animate-pulse" : (isDarkMode ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-100 text-gray-800')
                                )}
                                title={isListening ? "Listening..." : "Dictate"}
                            >
                                <Mic className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className={clsx(
                                    "p-2 rounded-lg transition-colors",
                                    isOpen ? "bg-brand-amber/20 text-brand-amber" : (isDarkMode ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-100 text-gray-800')
                                )}
                                title="Symbols"
                            >
                                <Calculator className="w-5 h-5" />
                            </button>

                            <button
                                onClick={handleConvert}
                                disabled={isConverting}
                                className={clsx(
                                    "p-2 rounded-lg transition-colors disabled:opacity-50",
                                    isDarkMode ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-100 text-gray-800'
                                )}
                                title={isConverting ? "Converting..." : "Auto-Format"}
                            >
                                <Wand2 className={clsx("w-5 h-5", isConverting && "animate-pulse")} />
                            </button>
                        </div>

                        {/* Divider */}
                        <div className={clsx("w-8 h-px", isDarkMode ? 'bg-gray-700' : 'bg-gray-300')} />
                    </>
                )}

                {/* AI Tutor Button */}
                <button
                    onClick={onTutorToggle}
                    className={clsx(
                        "flex items-center justify-center w-9 h-9 rounded-full font-bold shadow-md transition-all overflow-hidden border-2 mt-1",
                        isTutorOpen ? "bg-brand-amber text-brand-dark border-brand-amber" : "bg-brand-dark text-brand-amber hover:scale-105 hover:bg-gray-900 border-brand-amber p-0.5"
                    )}
                    title={isTutorOpen ? "Close Panel" : tutorInfo.name}
                >
                    <img src={tutorInfo.image} alt={tutorInfo.name} className="w-full h-full rounded-full object-cover" />
                </button>
            </div>
        </div>
    )
}

