
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import TutorOverlay from '../components/TutorOverlay'

describe('TutorOverlay', () => {
    it('renders the floating button initially', () => {
        render(<TutorOverlay onAskAI={vi.fn()} onGetHint={vi.fn()} isProcessing={false} messages={[]} />)
        expect(screen.getByRole('button', { name: /AI Tutor/i })).toBeDefined()
    })

    it('expands when clicked', () => {
        render(<TutorOverlay onAskAI={vi.fn()} onGetHint={vi.fn()} isProcessing={false} messages={[]} />)
        const button = screen.getByRole('button', { name: /AI Tutor/i })
        fireEvent.click(button)
        expect(screen.getByPlaceholderText(/Ask/i)).toBeDefined()
    })

    it('calls onAskAI when form is submitted', () => {
        const onAskAI = vi.fn()
        render(<TutorOverlay onAskAI={onAskAI} onGetHint={vi.fn()} isProcessing={false} messages={[]} />)

        // Expand first
        const toggleButton = screen.getByRole('button', { name: /AI Tutor/i })
        fireEvent.click(toggleButton)

        const input = screen.getByPlaceholderText(/Ask/i)
        fireEvent.change(input, { target: { value: 'Help me' } })

        // Check submit button
        const submitButton = screen.getByRole('button', { name: /Send/i })
        expect(submitButton).toBeDefined()

        // submit form
        fireEvent.submit(input.closest('form')!)

        expect(onAskAI).toHaveBeenCalledWith('Help me')
    })
})
