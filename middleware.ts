import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  // Auth is enforced only when Google credentials are configured
  const authEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  if (!authEnabled) return NextResponse.next()

  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === '/login'
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')

  if (isApiRoute) return NextResponse.next()
  if (isLoginPage) return NextResponse.next()
  if (!isLoggedIn) return NextResponse.redirect(new URL('/login', req.url))
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
