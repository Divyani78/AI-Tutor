import { signIn, signOut } from "next-auth/react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// For client-side use - redirect to Google login
export async function signInWithGoogle() {
  await signIn("google", { callbackUrl: "/" })
}

// For client-side use - sign out
export async function signOutUser() {
  await signOut({ callbackUrl: "/login" })
}

// For server-side use - get current session
export async function getAuthSession() {
  return getServerSession(authOptions)
}

// Re-export authOptions for use in other files
export { authOptions }

