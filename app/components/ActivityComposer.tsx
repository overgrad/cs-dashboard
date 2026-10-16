'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleCheck } from 'lucide-react'
import { ACTIVITY_LABEL, ACTIVITY_TYPES, type ActivityType } from '@/lib/activity-types'

export type ComposerContact = { id: string; label: string }

const PLACEHOLDER: Record<ActivityType, string> = {
  call: 'What did you talk about?',
  email: 'Summarize the email you sent…',
  meeting: 'Meeting notes…',
  note: 'Write a note about this account…',
}

export function ActivityComposer({
  accountId,
  contacts,
  canLog,
}: {
  accountId: string
  contacts: ComposerContact[]
  canLog: boolean // false when the account has no HubSpot company to log against
}) {
  const router = useRouter()
  const [type, setType] = useState<ActivityType>('call')
  const [contactId, setContactId] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  if (!canLog) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
        This account isn&apos;t linked to a HubSpot company, so activity can&apos;t be logged here.
      </p>
    )
  }

  async function save() {
    const text = body.trim()
    if (!text || saving) return
    setSaving(true)
    setError(null)
    setConfirmation(null)
    try {
      const res = await fetch(`/api/accounts/${accountId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, body: text, contactId: contactId || null }),
      })
      if (!res.ok) {
        const { error: message } = await res.json().catch(() => ({ error: null }))
        setError(message ?? 'Could not log the activity. Try again.')
        return
      }
      const contact = contacts.find((c) => c.id === contactId)
      setConfirmation(
        `${ACTIVITY_LABEL[type]} logged to HubSpot on the company${contact ? ` and ${contact.label}` : ''}.`,
      )
      setBody('')
      setContactId('')
      router.refresh()
    } catch {
      setError('Could not reach the server. Your note is still here — try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {confirmation && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
        >
          <span className="flex items-center gap-2">
            <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
            {confirmation}
          </span>
          <button
            onClick={() => setConfirmation(null)}
            className="text-emerald-600 hover:text-emerald-800"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label="Activity type" className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={`rounded-md px-3 py-1 text-sm font-medium ${
                  type === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {ACTIVITY_LABEL[t]}
              </button>
            ))}
          </div>
          {contacts.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Contact
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="max-w-56 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">None</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
          }}
          placeholder={PLACEHOLDER[type]}
          aria-label="Activity note"
          rows={3}
          className="w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />

        <div className="flex items-center justify-between gap-3">
          {error ? (
            <span role="alert" className="text-xs text-red-600">{error}</span>
          ) : (
            <span className="text-xs text-slate-400">Saved to HubSpot · ⌘ Enter to log</span>
          )}
          <button
            onClick={save}
            disabled={!body.trim() || saving}
            className="shrink-0 rounded-md border border-indigo-600 bg-indigo-600 px-3.5 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Logging…' : 'Log activity'}
          </button>
        </div>
      </div>
    </div>
  )
}
