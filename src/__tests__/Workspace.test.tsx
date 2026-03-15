
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Workspace from '../components/Workspace'

// Mock Scratchpad to avoid Tldraw complexity
vi.mock('../components/Scratchpad', () => ({
    default: ({ onEditorMount }: any) => {
        React.useEffect(() => {
            // Mock Editor instance
            onEditorMount({
                getSelectedShapeIds: () => [],
                getCurrentPageShapeIds: () => ['shape1'],
                toImage: async () => ({
                    blob: new Blob(['mock-image'], { type: 'image/png' })
                })
            })
        }, []) // eslint-disable-line
        return <div data-testid="scratchpad">Scratchpad</div>
    }
}))

// Mock FileReader
class MockFileReader {
    onloadend: any
    result: any
    readAsDataURL() {
        this.result = 'data:image/png;base64,mockedbase64'
        setTimeout(() => this.onloadend && this.onloadend(), 0)
    }
}
// @ts-ignore
global.FileReader = MockFileReader

// Mock global fetch
global.fetch = vi.fn()

// Mock URL.createObjectURL/revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:url')
global.URL.revokeObjectURL = vi.fn()

// Mock Image loading
// @ts-ignore
global.Image = class {
    onload: () => void = () => { }
    private _src: string = ''
    get src() { return this._src }
    set src(val: string) {
        this._src = val
        setTimeout(() => this.onload(), 10)
    }
}

// Mock Canvas getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
})) as any

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mockedbase64')

// Mock XMLSerializer
global.XMLSerializer = class {
    serializeToString() {
        return '<svg>mock</svg>'
    }
} as any

const MOCK_QUESTION = {
    id: '1',
    title: 'Test Q',
    content: 'Content',
    subject: 'Math',
    solution_steps: []
}

describe('Workspace Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders question and scratchpad', () => {
        render(<Workspace questions={[MOCK_QUESTION]} />)
        expect(screen.getByText('Test Q')).toBeDefined()
        expect(screen.getByTestId('scratchpad')).toBeDefined()
    })

    it('sends question context and image to API when asking AI', async () => {
        // Mock API response
        (global.fetch as any).mockResolvedValue({
            json: async () => ({ reply: 'AI Response' })
        })

        render(<Workspace questions={[MOCK_QUESTION]} />)

        // Open Tutor
        fireEvent.click(screen.getByRole('button', { name: /AI Tutor/i }))

        // Type and send
        const input = screen.getByPlaceholderText(/Ask/i)
        fireEvent.change(input, { target: { value: 'Help' } })
        fireEvent.submit(input.closest('form')!)

        await waitFor(() => {
            const calls = (global.fetch as any).mock.calls
            if (calls.length === 0) throw new Error("Fetch not called yet")
            const lastCall = calls[calls.length - 1]
            const [url, opts] = lastCall

            expect(url).toBe('/api/tutor')
            expect(opts.method).toBe('POST')

            const body = JSON.parse(opts.body)
            expect(body).toMatchObject({
                tutorMode: 'mains', // Default
                questionContext: expect.anything(),
                timeTaken: expect.any(Number)
            })
            expect(body.image).toContain('mockedbase64')
        }, { timeout: 5000 })

        expect(screen.getByText('AI Response')).toBeDefined()
    })
})
