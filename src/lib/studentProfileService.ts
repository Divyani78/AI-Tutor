// Mock data service - replaces Supabase for demo purposes
// In production, you can connect to a real database

export interface StudentProfile {
    id: string;
    name: string;
    weaknesses: string[];
    strengths: string[];
    learning_style: 'visual' | 'textual' | 'interactive';
    score_history?: Array<{
        difficulty: 'Easy' | 'Medium' | 'Hard'
        solved: boolean
        timeTakenSecs: number
        date?: string
    }>;
    streak?: number;
}

// Mock student profiles database
const mockProfiles: Record<string, StudentProfile> = {
    'user_123': {
        id: 'user_123',
        name: 'Ashish',
        weaknesses: ['Integration', 'Chain Rule', 'Vectors'],
        strengths: ['Algebra', 'Electrostatics Concept'],
        learning_style: 'visual',
        streak: 5,
        score_history: [
            // Easy questions solved
            { difficulty: 'Easy', solved: true, timeTakenSecs: 120, date: '2026-02-20' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 95, date: '2026-02-20' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 150, date: '2026-02-21' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 80, date: '2026-02-21' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 110, date: '2026-02-22' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 130, date: '2026-02-22' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 100, date: '2026-02-23' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 85, date: '2026-02-23' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 140, date: '2026-02-24' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 105, date: '2026-02-24' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 125, date: '2026-02-25' },
            { difficulty: 'Easy', solved: true, timeTakenSecs: 90, date: '2026-02-25' },
            // Easy - not solved
            { difficulty: 'Easy', solved: false, timeTakenSecs: 0, date: '2026-02-26' },
            { difficulty: 'Easy', solved: false, timeTakenSecs: 0, date: '2026-02-26' },
            { difficulty: 'Easy', solved: false, timeTakenSecs: 0, date: '2026-02-27' },
            // Medium questions solved
            { difficulty: 'Medium', solved: true, timeTakenSecs: 280, date: '2026-02-20' },
            { difficulty: 'Medium', solved: true, timeTakenSecs: 320, date: '2026-02-21' },
            { difficulty: 'Medium', solved: true, timeTakenSecs: 250, date: '2026-02-22' },
            { difficulty: 'Medium', solved: true, timeTakenSecs: 310, date: '2026-02-23' },
            { difficulty: 'Medium', solved: true, timeTakenSecs: 290, date: '2026-02-24' },
            { difficulty: 'Medium', solved: true, timeTakenSecs: 340, date: '2026-02-25' },
            { difficulty: 'Medium', solved: true, timeTakenSecs: 270, date: '2026-02-26' },
            { difficulty: 'Medium', solved: true, timeTakenSecs: 300, date: '2026-02-27' },
            // Medium - not solved
            { difficulty: 'Medium', solved: false, timeTakenSecs: 0, date: '2026-02-28' },
            { difficulty: 'Medium', solved: false, timeTakenSecs: 0, date: '2026-02-28' },
            { difficulty: 'Medium', solved: false, timeTakenSecs: 0, date: '2026-02-29' },
            { difficulty: 'Medium', solved: false, timeTakenSecs: 0, date: '2026-02-29' },
            { difficulty: 'Medium', solved: false, timeTakenSecs: 0, date: '2026-03-01' },
            { difficulty: 'Medium', solved: false, timeTakenSecs: 0, date: '2026-03-01' },
            // Hard questions solved
            { difficulty: 'Hard', solved: true, timeTakenSecs: 580, date: '2026-02-22' },
            { difficulty: 'Hard', solved: true, timeTakenSecs: 620, date: '2026-02-25' },
            { difficulty: 'Hard', solved: true, timeTakenSecs: 680, date: '2026-02-28' },
            // Hard - not solved
            { difficulty: 'Hard', solved: false, timeTakenSecs: 0, date: '2026-03-01' },
            { difficulty: 'Hard', solved: false, timeTakenSecs: 0, date: '2026-03-02' },
            { difficulty: 'Hard', solved: false, timeTakenSecs: 0, date: '2026-03-02' },
            { difficulty: 'Hard', solved: false, timeTakenSecs: 0, date: '2026-03-03' },
            { difficulty: 'Hard', solved: false, timeTakenSecs: 0, date: '2026-03-03' },
            { difficulty: 'Hard', solved: false, timeTakenSecs: 0, date: '2026-03-04' },
            { difficulty: 'Hard', solved: false, timeTakenSecs: 0, date: '2026-03-04' },
            { difficulty: 'Hard', solved: false, timeTakenSecs: 0, date: '2026-03-05' },
        ]
    }
}

export async function getStudentProfile(userId: string): Promise<StudentProfile | null> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const profile = mockProfiles[userId]
    if (!profile) {
        // Create a default profile for new users
        return {
            id: userId,
            name: 'Student',
            weaknesses: [],
            strengths: [],
            learning_style: 'visual',
            score_history: []
        }
    }
    return profile
}

export async function updateStudentProfile(userId: string, updates: Partial<StudentProfile>) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const existing = mockProfiles[userId] || {
        id: userId,
        name: 'Student',
        weaknesses: [],
        strengths: [],
        learning_style: 'visual' as const,
        score_history: []
    }
    
    const updated = { ...existing, ...updates }
    mockProfiles[userId] = updated
    return updated
}

