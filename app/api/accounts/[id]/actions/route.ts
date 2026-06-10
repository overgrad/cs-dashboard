import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { type, note, createdBy } = await request.json()

  if (!['complete', 'dismiss', 'snooze'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (type === 'dismiss' && !note?.trim()) {
    return NextResponse.json({ error: 'Reason required for dismiss' }, { status: 400 })
  }

  const suppressDays = type === 'snooze' ? 7 : type === 'dismiss' ? 30 : 0
  const suppressUntil =
    suppressDays > 0 ? new Date(Date.now() + suppressDays * 24 * 60 * 60 * 1000) : null

  const action = await prisma.queueAction.create({
    data: { accountId: id, type, note: note?.trim() || null, suppressUntil, createdBy: createdBy || null },
  })

  return NextResponse.json(action)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const actions = await prisma.queueAction.findMany({
    where: { accountId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(actions)
}
