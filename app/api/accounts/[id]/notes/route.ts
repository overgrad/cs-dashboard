import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { body } = await request.json()
  if (!body?.trim()) {
    return NextResponse.json({ error: 'Note body required' }, { status: 400 })
  }

  const note = await prisma.note.create({
    data: { accountId: id, author: session.user.email, body: body.trim() },
  })

  return NextResponse.json(note)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const notes = await prisma.note.findMany({
    where: { accountId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(notes)
}
