import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      // Restrict to @overgrad.com accounts only
      return profile?.email?.endsWith('@overgrad.com') ?? false
    },
    session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
