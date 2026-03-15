// Simplified Knowledge Graph mapping concepts to their prerequisites
export const PREREQUISITE_GRAPH: Record<string, string[]> = {
    // Physics -> Math
    "Electromagnetism": ["Vector Calculus", "Electrostatics"],
    "Electrostatics": ["Coulomb's Law", "Integration"],
    "Kinematics": ["Basic Calculus", "Vectors"],
    "Rotational Mechanics": ["Integration", "Vectors", "Newton's Laws"],
    "Thermodynamics": ["Differential Equations", "Gas Laws"],
    "Optics": ["Trigonometry", "Geometry"],

    // Math -> Math (Deep Chain)
    "Vector Calculus": ["Vectors", "Integration", "Differentiation"],
    "Integration": ["Differentiation", "Limits"],
    "Differentiation": ["Limits", "Functions"],
    "Trigonometry": ["Geometry", "Algebra"],
    "Chain Rule": ["Composite Functions", "Differentiation"],

    // Chemistry
    "Chemical Kinetics": ["Logarithms", "Differential Equations"],
    "Electrochemistry": ["Redox Reactions", "Thermodynamics"],
    "Equilibrium": ["Stoichiometry", "Quadratic Equations"]
};

// Helper to trace deep dependencies
export function getPrerequisites(topic: string, depth = 1): string[] {
    let reqs = PREREQUISITE_GRAPH[topic] || [];
    if (depth > 0) {
        // Simple recursion for immediate depth
        for (const r of reqs) {
            const subReqs = PREREQUISITE_GRAPH[r];
            if (subReqs) reqs = [...reqs, ...subReqs];
        }
    }
    return Array.from(new Set(reqs)); // Unique
}
