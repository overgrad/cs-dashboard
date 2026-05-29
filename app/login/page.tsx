import { signIn } from '@/auth'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold text-slate-900">CS Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in with your Overgrad account</p>
        <form
          className="mt-6"
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/renewals' })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  )
}
