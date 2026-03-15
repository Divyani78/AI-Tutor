'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function SessionCheck() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // If still loading, wait
    if (status === 'loading') return
    
    // If not authenticated, redirect to login
    if (!session) {
      router.push('/login')
    }
  }, [session, status, router])

  // Don't render anything - just handle the redirect
  return null
}

