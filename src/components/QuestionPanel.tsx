'use client'

import React, { useEffect, useRef } from 'react'
import { Question } from '@/data/questions'
import { getTracker } from '@/lib/behaviorTracker'

interface QuestionPanelProps {
    question: Question
    isDarkMode?: boolean
}

export default function QuestionPanel({ question, isDarkMode = false }: QuestionPanelProps) {

    // ── Track which question the student is currently viewing ──────────────────
    // Every time `question` changes (student moves to next question),
    // tell the tracker so it can:
    //   1. Save the summary for the previous question
    //   2. Start timing the new question
    const prevQuestionId = useRef<string | null>(null)

    useEffect(() => {
        // Only fire if it's actually a different question
        if (!question?.id || question.id === prevQuestionId.current) return

        try {
            const tracker = getTracker()
            tracker.setQuestion(question.id)
            prevQuestionId.current = question.id
            console.log('[BehaviorTracker] Now tracking question:', question.id, '-', question.title)
        } catch {
            // Tracker not initialised yet (user not logged in) — silently skip
        }
    }, [question?.id])

    // ── Track how long the question image is visible (visual engagement) ───────
    const imageViewStart = useRef<number | null>(null)

    const handleImageVisible = () => {
        imageViewStart.current = Date.now()
    }
    const handleImageHidden = () => {
        if (imageViewStart.current) {
            const duration = Date.now() - imageViewStart.current
            // Only log if they looked for more than 2 seconds (meaningful engagement)
            if (duration > 2000) {
                try {
                    getTracker()['track']?.('question_viewed', {
                        image_view_duration_ms: duration,
                        question_id: question.id,
                    })
                } catch {}
            }
            imageViewStart.current = null
        }
    }

    return (
        <div className={`p-6 border-b shadow-sm md:rounded-xl md:border md:border-l-4 md:border-l-brand-amber md:mb-4 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full mb-2 
                        ${question.subject === 'Mathematics' ? 'bg-brand-dark text-brand-amber' :
                          question.subject === 'Physics'     ? 'bg-purple-900 text-purple-200' :
                          question.subject === 'Chemistry'   ? 'bg-teal-900 text-teal-200'
                                                             : 'bg-green-900 text-green-200'}`}>
                        {question.subject}
                    </span>
                    <h2 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {question.title}
                    </h2>
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Difficulty:{' '}
                    <span className={`font-bold ${isDarkMode ? 'text-brand-amber' : 'text-brand-dark'}`}>
                        {question.difficulty}
                    </span>
                </div>
            </div>

            <div className={`prose max-w-none ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>
                <p className="whitespace-pre-wrap">{question.content}</p>

                {question.imageUrl && (
                    <div
                        className={`mt-4 border rounded-lg overflow-hidden flex justify-center p-2 ${
                            isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50'
                        }`}
                        // Track when student looks at the diagram
                        onMouseEnter={handleImageVisible}
                        onMouseLeave={handleImageHidden}
                        onFocus={handleImageVisible}
                        onBlur={handleImageHidden}
                    >
                        <img
                            src={question.imageUrl}
                            alt="Question Diagram"
                            className="max-h-60 object-contain"
                        />
                    </div>
                )}
            </div>
        </div>
    )
}