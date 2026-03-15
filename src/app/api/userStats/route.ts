import { NextRequest, NextResponse } from 'next/server'
import { getStudentProfile } from '@/lib/studentProfileService'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const userId = searchParams.get('userId') || 'user_123'

        const profile = await getStudentProfile(userId)

        if (!profile) {
            return NextResponse.json(getFallbackStats(), { status: 200 })
        }

        // ── Pull from your existing studentProfile shape ──────────────────────
        // Adapt the field names below to match your actual DB schema.
        // These are common fields — adjust as needed.
        const scoreHistory: Array<{
            difficulty: 'Easy' | 'Medium' | 'Hard'
            solved: boolean
            timeTakenSecs: number
        }> = profile.score_history || []

        const byDiff = (d: 'Easy' | 'Medium' | 'Hard') => scoreHistory.filter(s => s.difficulty === d)
        const avgTime = (arr: typeof scoreHistory) => {
            const solved = arr.filter(s => s.solved)
            if (!solved.length) return 0
            return solved.reduce((sum, s) => sum + (s.timeTakenSecs || 0), 0) / solved.length
        }

        const easy   = byDiff('Easy')
        const medium = byDiff('Medium')
        const hard   = byDiff('Hard')

        const allSolved = scoreHistory.filter(s => s.solved)

        const stats = {
            easy: {
                solved:        easy.filter(s => s.solved).length,
                total:         easy.length,
                avgTimeSecs:   Math.round(avgTime(easy)),
            },
            medium: {
                solved:        medium.filter(s => s.solved).length,
                total:         medium.length,
                avgTimeSecs:   Math.round(avgTime(medium)),
            },
            hard: {
                solved:        hard.filter(s => s.solved).length,
                total:         hard.length,
                avgTimeSecs:   Math.round(avgTime(hard)),
            },
            totalSolved:          allSolved.length,
            totalAttempted:       scoreHistory.length,
            overallAvgTimeSecs:   Math.round(avgTime(scoreHistory)),
            // Streak: count consecutive days with at least one solve
            // Adapt this if your profile stores a `streak` field directly
            streak:               profile.streak || 0,
        }

        return NextResponse.json(stats)

    } catch (err: any) {
        console.error('user-stats API error:', err)
        return NextResponse.json(getFallbackStats(), { status: 200 })
    }
}

// Shown when DB is unavailable or user has no history yet
function getFallbackStats() {
    return {
        easy:   { solved: 0, total: 0, avgTimeSecs: 0 },
        medium: { solved: 0, total: 0, avgTimeSecs: 0 },
        hard:   { solved: 0, total: 0, avgTimeSecs: 0 },
        totalSolved: 0,
        totalAttempted: 0,
        overallAvgTimeSecs: 0,
        streak: 0,
    }
}