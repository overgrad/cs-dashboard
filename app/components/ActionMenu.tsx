'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ActionType = 'complete' | 'dismiss' | 'snooze'

export function ActionMenu({ accountId }: { accountId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [activeForm, setActiveForm] = useState<'complete' | 'dismiss' | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  function close() {
    setOpen(false)
    setActiveForm(null)
    setNote('')
  }

  async function submit(type: ActionType) {
    setLoading(true)
    await fetch(`/api/accounts/${accountId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, note }),
    })
    setLoading(false)
    close()
    router.refresh()
  }

  const canSubmitForm =
    activeForm === 'complete' || (activeForm === 'dismiss' && note.trim().length > 0)

  return (
    <div className="relative shrink-0">
      {open && (
        <div className="fixed inset-0 z-10" onClick={close} />
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="relative z-20 flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Actions"
      >
        •••
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {activeForm === null ? (
            <div className="py-1">
              <button
                onClick={() => setActiveForm('complete')}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="text-emerald-500">✓</span> Mark complete
              </button>
              <button
                onClick={() => setActiveForm('dismiss')}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="text-slate-400">✕</span> Dismiss
              </button>
              <button
                onClick={() => submit('snooze')}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="text-amber-500">⏱</span> Snooze 1 week
              </button>
            </div>
          ) : (
            <div className="p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {activeForm === 'complete' ? 'Mark complete' : 'Dismiss'}
              </p>
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  activeForm === 'complete'
                    ? 'Add a note (optional)…'
                    : 'Reason for dismissing (required)…'
                }
                rows={3}
                className="w-full resize-none rounded border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => canSubmitForm && submit(activeForm)}
                  disabled={loading || !canSubmitForm}
                  className="flex-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  {loading ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setActiveForm(null)}
                  className="rounded px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
