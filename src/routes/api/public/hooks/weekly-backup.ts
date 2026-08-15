import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type DiariaRow = { valor: number | string; alimentacao: number | string | null }

async function handler(request: Request) {
  const authHeader = request.headers.get('authorization') ?? ''
  const apiKey = request.headers.get('apikey') ?? authHeader.replace('Bearer ', '')
  const accepted = [
    process.env['SUPABASE_PUBLISHABLE_KEY'],
    process.env['VITE_SUPABASE_PUBLISHABLE_KEY'],
    process.env['SUPABASE_ANON_KEY'],
  ].filter(Boolean) as string[]
  if (!apiKey || !accepted.includes(apiKey)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env['SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (usersError) {
    console.error('weekly-backup: listUsers failed', usersError)
    return Response.json({ error: usersError.message }, { status: 500 })
  }

  const hoje = new Date()
  const inicio = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000)
  const periodo = `${inicio.toLocaleDateString('pt-BR')} a ${hoje.toLocaleDateString('pt-BR')}`
  const stamp = hoje.toISOString().slice(0, 10)

  let enviados = 0
  const erros: string[] = []

  for (const user of usersPage.users) {
    if (!user.email || !user.email_confirmed_at) continue
    try {
      const [{ data: diarias }, { data: adiantamentos }] = await Promise.all([
        supabase.from('diarias').select('*').eq('user_id', user.id),
        supabase.from('adiantamentos').select('*').eq('user_id', user.id),
      ])

      const listaDiarias = (diarias ?? []) as unknown as DiariaRow[]
      if (listaDiarias.length === 0 && (adiantamentos ?? []).length === 0) continue

      const total = listaDiarias.reduce(
        (acc, d) => acc + Number(d.valor) + Number(d.alimentacao ?? 0),
        0,
      )

      const backup = JSON.stringify(
        { versao: 1, geradoEm: hoje.toISOString(), diarias, adiantamentos },
        null,
        2,
      )

      const path = `${user.id}/backup-${stamp}.json`
      const { error: uploadError } = await supabase.storage
        .from('backups')
        .upload(path, new Blob([backup], { type: 'application/json' }), {
          upsert: true,
          contentType: 'application/json',
        })
      if (uploadError) throw uploadError

      const { data: signed, error: signError } = await supabase.storage
        .from('backups')
        .createSignedUrl(path, 60 * 60 * 24 * 7)
      if (signError) throw signError

      await sendTemplateEmail('backup-semanal', user.email, {
        idempotencyKey: `backup-semanal-${user.id}-${stamp}`,
        templateData: {
          periodo,
          qtdDiarias: listaDiarias.length,
          qtdAdiantamentos: (adiantamentos ?? []).length,
          totalDiarias: fmt.format(total),
          downloadUrl: signed?.signedUrl,
        },
      })
      enviados++
    } catch (e) {
      console.error(`weekly-backup: falha para ${user.id}`, e)
      erros.push(user.id)
    }
  }

  return Response.json({ success: true, enviados, erros: erros.length })
}

export const Route = createFileRoute('/api/public/hooks/weekly-backup')({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
    },
  },
})
