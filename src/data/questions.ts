
export interface Question {
    id: string
    title: string
    content: string
    subject: string
    topic?: string
    difficulty?: string
    solution_steps?: string[]
    imageUrl?: string
    microConcepts?: string[]
}

export const QUESTIONS: Question[] = [
    {
        id: '1',
        title: 'Complex Numbers - Locus Problem',
        content: 'If z is a complex number such that |z| = 4 and arg(z) = 5π/6, then find z.\n\n(A) -2√3 + 2i\n(B) 2√3 - 2i\n(C) -2√3 - 2i\n(D) 2√3 + 2i',
        subject: 'Mathematics',
        topic: 'Complex Numbers',
        difficulty: 'Easy',
        solution_steps: [
            "Step 1: Recall polar form z = r(cos θ + i sin θ).",
            "Step 2: Here r = 4, θ = 5π/6.",
            "Step 3: Substitute values.",
            "Step 4: Calculate cos(5π/6) and sin(5π/6)."
        ]
    },
    {
        id: '2',
        title: 'Physics - Kinematics (Projectile)',
        content: 'A particle is projected with a velocity u at an angle θ with the horizontal. Find the time of flight and the maximum height attained.',
        subject: 'Physics',
        topic: 'Kinematics',
        difficulty: 'Medium',
        solution_steps: [
            "Step 1: Resolve initial velocity into components: ux = u cos θ, uy = u sin θ.",
            "Step 2: Use equation vy = uy - gt. At max height, vy = 0.",
            "Step 3: Solve for time to max height (t_max) and double it for Time of Flight (T).",
            "Step 4: Use y = uy*t - 0.5*g*t^2 with t = t_max to find Max Height (H)."
        ]
    },
    {
        id: '3',
        title: 'Calculus - Definite Integration',
        content: 'Evaluate the integral: ∫ (from 0 to π/2) sin(x) / (sin(x) + cos(x)) dx',
        subject: 'Mathematics',
        topic: 'Calculus',
        difficulty: 'Medium',
        solution_steps: [
            "Step 1: Let I = ∫ (0 to π/2) sin(x) / (sin(x) + cos(x)) dx ... (1)",
            "Step 2: Use property: ∫ (a to b) f(x) dx = ∫ (a to b) f(a+b-x) dx.",
            "Step 3: Replace x with (π/2 - x). Note that sin(π/2 - x) = cos(x).",
            "Step 4: Write the new integral for I ... (2)",
            "Step 5: Add equations (1) and (2). 2I = ∫ 1 dx.",
            "Step 6: Integrate and solve for I."
        ]
    },
    {
        id: '4',
        title: 'Chemistry - Thermodynamics',
        content: 'Calculate the work done when 1 mole of an ideal gas expands reversibly and isothermally from a volume of 10 L to 20 L at 300 K. (R = 8.314 J/mol K)',
        subject: 'Chemistry',
        topic: 'Thermodynamics',
        difficulty: 'Hard',
        solution_steps: [
            "Step 1: Identify the process: Reversible Isothermal Expansion.",
            "Step 2: Recall the formula: W = -nRT ln(V2/V1).",
            "Step 3: Substitute values: n=1, R=8.314, T=300, V1=10, V2=20.",
            "Step 4: Calculate ln(2) approx 0.693.",
            "Step 5: Compute the final value."
        ]
    },
    {
        id: '5',
        title: 'Physics - Current Electricity',
        content: 'For the circuit shown below, calculate the total current drawn from the 12V battery.',
        subject: 'Physics',
        topic: 'Current Electricity',
        difficulty: 'Medium',
        imageUrl: '/circuit_diagram.png',
        solution_steps: [
            "Step 1: Identify the connection of resistors.",
            "Step 2: R1 (4Ω) and R2 (6Ω) are in series.",
            "Step 3: Calculate equivalent resistance Req = R1 + R2 = 10Ω.",
            "Step 4: Use Ohm\'s Law: I = V / Req.",
            "Step 5: Substitute V=12V, Req=10Ω to find I."
        ]
    }
]
