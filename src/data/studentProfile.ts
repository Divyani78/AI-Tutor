// Mock persistent user profile
// In a real app, this would be fetched from Supabase 'profiles' or 'sessions' table

export interface StudentProfile {
    id: string;
    name: string;
    weaknesses: string[]; // List of concepts the student historically struggles with
    strengths: string[];
    learningStyle: 'visual' | 'textual' | 'interactive';
}

export const MOCK_STUDENT_PROFILE: StudentProfile = {
    id: "user_123",
    name: "Ashish",
    // Simulating the user scenario: Struggling with Physics because of weak Calculus
    weaknesses: ["Integration", "Chain Rule", "Vectors"],
    strengths: ["Algebra", "Electrostatics Concept"],
    learningStyle: 'visual'
};
