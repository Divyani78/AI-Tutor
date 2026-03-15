'use client'

import { Tldraw, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { useCallback, useEffect, useState } from 'react'
import { useBehaviorTracking } from '@/hooks/useBehaviorTracking'

interface ScratchpadProps {
    onEditorMount?: (editor: Editor) => void
    isDarkMode?: boolean
}

export default function Scratchpad({ onEditorMount, isDarkMode = false }: ScratchpadProps) {
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null)

    // ── Behavior tracking ─────────────────────────────────────────────────────
    const { trackStroke, trackErase, trackClear } = useBehaviorTracking()

    const handleMount = useCallback((editor: Editor) => {
        setEditorInstance(editor)
        if (onEditorMount) {
            onEditorMount(editor)
        }
        // @ts-ignore
        window.editor = editor

        // ── Listen to tldraw store changes and track drawing behaviour ────────
        // 'added'   shapes = student drew something (stroke)
        // 'removed' shapes = student erased something
        // We ignore shapes added by the AI tutor (those are programmatic, not student-driven)
        // by checking if the tool in use is 'select' (AI writes) vs draw/eraser tools
        editor.store.listen((update) => {
            const added   = Object.keys(update.changes.added   ?? {}).length
            const removed = Object.keys(update.changes.removed ?? {}).length

            if (added > 0) {
                const currentTool = editor.getCurrentToolId()
                // Only count as student stroke if they're using a drawing tool
                // not when AI is programmatically creating shapes
                if (currentTool !== 'select' && currentTool !== 'hand') {
                    trackStroke({ tool: currentTool })
                }
            }

            if (removed > 0) {
                const currentTool = editor.getCurrentToolId()
                if (currentTool === 'eraser') {
                    trackErase()
                }
            }
        })

    }, [onEditorMount, trackStroke, trackErase])

    useEffect(() => {
        if (editorInstance) {
            editorInstance.user.updateUserPreferences({ colorScheme: isDarkMode ? 'dark' : 'light' })
        }
    }, [editorInstance, isDarkMode])

    return (
        <div className="w-full h-full relative overflow-hidden shadow-sm">
            <Tldraw
                onMount={handleMount}
                persistenceKey="jee-tutor-scratchpad"
                hideUi={true}
            />
        </div>
    )
}