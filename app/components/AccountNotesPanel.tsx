'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type NoteItem = {
  id: string
  author: string
  body: string
  createdAtLabel: string
}

export function AccountNotesPanel({
  accountId,
  accountName,
  notes,
  contactEmail,
  contactName,
}: {
  accountId: string
  accountName: string
  notes: NoteItem[]
  contactEmail: string | null
  contactName: string | null
}) {
  const router = useRouter()
  const [panelOpen, setPanelOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})

  function toggleNote(id: string) {
    setOpenIds((s) => ({ ...s, [id]: !s[id] }))
  }

  async function save() {
    const body = draft.trim()
    if (!body || saving) return
    setSaving(true)
    const res = await fetch(`/api/accounts/${accountId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    setSaving(false)
    if (res.ok) {
      setComposing(false)
      setDraft('')
      router.refresh()
    }
  }

  function cancel() {
    setComposing(false)
    setDraft('')
  }

  return (
    <div className="space-y-4">
    <div className="overflow-hidden rounded-lg border border-slate-200 text-sm">
      <button
        onClick={() => setPanelOpen((v) => !v)}
        className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 ${
          panelOpen ? 'border-b border-slate-200 bg-slate-50' : 'bg-slate-50'
        }`}
      >
        <span className="text-slate-500">CS notes · {notes.length}</span>
        <span className={`text-slate-400 transition-transform ${panelOpen ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {panelOpen && (
        <>
          {composing && (
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-4">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
                  if (e.key === 'Escape') cancel()
                }}
                placeholder="Write a note about this account…"
                rows={4}
                className="resize-y rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">⌘ Enter to save</span>
                <div className="flex gap-2">
                  <button
                    onClick={cancel}
                    className="rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={save}
                    disabled={!draft.trim() || saving}
                    className="rounded-md border border-indigo-600 bg-indigo-600 px-3.5 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {notes.map((n) => {
            const open = !!openIds[n.id]
            return (
              <div key={n.id} className="border-b border-slate-100 last:border-0">
                <div
                  onClick={() => toggleNote(n.id)}
                  className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="whitespace-nowrap text-slate-500">
                    {n.createdAtLabel} · {n.author}
                  </span>
                  <span
                    className={`overflow-hidden text-ellipsis whitespace-nowrap text-slate-800 ${
                      open ? 'opacity-0' : ''
                    }`}
                  >
                    {n.body}
                  </span>
                  <span
                    className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
                  >
                    ▾
                  </span>
                </div>
                {open && (
                  <div className="whitespace-pre-wrap px-4 pb-4 leading-relaxed text-slate-700">
                    {n.body}
                  </div>
                )}
              </div>
            )
          })}

          {notes.length === 0 && !composing && (
            <div className="px-4 py-3 text-slate-500">No notes yet</div>
          )}
        </>
      )}
    </div>

      <div className="flex gap-3">
        {contactEmail && (
          <a
            href={`mailto:${contactEmail}?subject=Checking in — ${accountName}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Email {contactName ?? 'contact'} →
          </a>
        )}
        <button
          onClick={() => {
            setComposing(true)
            setPanelOpen(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-slate-50"
        >
          + Add Note
        </button>
      </div>
    </div>
  )
}
