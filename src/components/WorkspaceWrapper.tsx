'use client'

import dynamic from 'next/dynamic'
import { Question } from '@/data/questions'

const Workspace = dynamic(() => import('@/components/Workspace'), { ssr: false })

export default function WorkspaceWrapper({ questions }: { questions: Question[] }) {
    return <Workspace questions={questions} />
}
