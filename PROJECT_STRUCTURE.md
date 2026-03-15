# AI Tutor Project Structure

```
AI-Tutor/
├── public/                          # Static assets
│   ├── tutors/                     # Tutor profile images
│   │   ├── anish_sir.png
│   │   ├── ashutosh_sir.png
│   │   └── pankaj_sir.png
│   ├── circuit_diagram.png
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── src/
│   ├── __tests__/                   # Test files
│   │   ├── TutorOverlay.test.tsx
│   │   └── Workspace.test.tsx
│   │
│   ├── app/                         # Next.js App Router
│   │   ├── api/                     # API Routes
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/   # NextAuth.js authentication
│   │   │   │       └── route.ts
│   │   │   ├── transcribe/          # Audio transcription API
│   │   │   │   └── route.ts
│   │   │   ├── tutor/               # AI Tutor API
│   │   │   │   └── route.ts
│   │   │   └── userStats/           # User statistics API
│   │   │       └── route.ts
│   │   │
│   │   ├── login/                   # Login page
│   │   │   └── page.tsx
│   │   │
│   │   ├── favicon.ico
│   │   ├── globals.css              # Global styles
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Home page (main workspace)
│   │
│   ├── components/                  # React components
│   │   ├── AuthButton.tsx           # Authentication button
│   │   ├── MathToolbar.tsx          # Math input toolbar
│   │   ├── Providers.tsx            # Context providers
│   │   ├── QuestionPanel.tsx        # Question display panel
│   │   ├── Scratchpad.tsx           # Scratchpad for calculations
│   │   ├── SessionCheck.tsx         # Session validation
│   │   ├── TutorOverlay.tsx         # AI tutor overlay UI
│   │   ├── Workspace.tsx            # Main drawing workspace (tldraw)
│   │   └── WorkspaceWrapper.tsx     # Workspace container
│   │
│   ├── data/                        # Static data
│   │   ├── knowledgeGraph.ts        # Knowledge graph data
│   │   ├── questions.ts             # Question bank
│   │   └── studentProfile.ts        # Student profile data
│   │
│   ├── lib/                         # Utility libraries
│   │   ├── auth.ts                  # Authentication utilities
│   │   ├── gemini.ts                # Google Gemini AI integration
│   │   ├── studentProfileService.ts # Student profile CRUD operations
│   │   └── supabaseClient.ts        # Supabase database client
│   │
│   ├── types/                       # TypeScript type definitions
│   │   └── next-auth.d.ts           # NextAuth.js type extensions
│   │
│   └── middleware.ts                # Next.js middleware (auth protection)
│
├── __MACOSX/                        # macOS metadata (ignored)
│
├── eslint.config.mjs                # ESLint configuration
├── next.config.ts                   # Next.js configuration
├── next-env.d.ts                    # Next.js types
├── package.json                     # Dependencies & scripts
├── package-lock.json                # Locked dependency versions
├── postcss.config.mjs               # PostCSS configuration
├── README.md                        # Project documentation
├── supabase_schema.sql               # Database schema
├── supabase_setup.sql               # Database setup scripts
├── tsconfig.json                    # TypeScript configuration
├── tsconfig.tsbuildinfo             # TypeScript build info
└── vitest.config.mts                # Vitest test configuration
```

---

## Technology Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16.1.6 |
| **Language** | TypeScript |
| **UI Library** | React 19.2.3 |
| **Authentication** | NextAuth.js 4.24.13 |
| **Database** | Supabase (PostgreSQL) |
| **AI/ML** | Google Gemini AI |
| **Drawing** | tldraw 4.3.0 |
| **Styling** | Tailwind CSS 4 |
| **Testing** | Vitest + React Testing Library |
| **Animation** | Framer Motion 12.29.2 |

---

## Project Overview

This is an **AI-powered tutoring platform** with the following features:

1. **Interactive Workspace** - Drawing canvas using tldraw for visual learning
2. **AI Tutor Overlay** - AI-powered tutor that assists students
3. **Math Tools** - Toolbar for math input and calculations
4. **Question Bank** - Pre-loaded questions for practice
5. **Knowledge Graph** - Visual representation of concepts
6. **Authentication** - User login via NextAuth.js
7. **User Statistics** - Track student progress
8. **Audio Transcription** - Transcribe voice inputs

---

## API Routes

| Endpoint | Description |
|----------|-------------|
| `/api/auth/[...nextauth]` | Authentication handler |
| `/api/transcribe` | Audio to text transcription |
| `/api/tutor` | AI tutor interaction |
| `/api/userStats` | User statistics management |

---

## Key Components

- **Workspace** - Main drawing area with tldraw integration
- **TutorOverlay** - Floating AI tutor panel
- **QuestionPanel** - Displays questions and answers
- **MathToolbar** - Mathematical symbol input
- **Scratchpad** - Quick calculations area
- **SessionCheck** - Validates user session

