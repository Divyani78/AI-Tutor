import { AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { signIn, signOut } from "next-auth/react"
import { getServerSession } from "next-auth"

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub,
        }
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

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
