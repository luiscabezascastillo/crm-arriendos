import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { resource, user_id, topic, application_id, attempts, sent, received } = body

    await supabase.from('ml_notificaciones').insert([{
      topic,
      resource,
      user_id: String(user_id || ''),
      application_id: String(application_id || ''),
      attempts: attempts || 1,
      sent,
      received,
      procesado: false,
      created_at: new Date().toISOString(),
    }])

    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err) {
    console.error('ML callback error:', err)
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }
}