import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  periodo?: string
  qtdDiarias?: number
  qtdAdiantamentos?: number
  totalDiarias?: string
  downloadUrl?: string
  pdfUrl?: string
  qtdGastos?: number
  diariasPendentes?: string
  gastosPendentes?: string
  totalAdiantado?: string
  saldoReceber?: string
}

const Email = ({
  periodo,
  qtdDiarias = 0,
  qtdAdiantamentos = 0,
  totalDiarias = 'R$ 0,00',
  downloadUrl,
  pdfUrl,
  qtdGastos = 0,
  diariasPendentes = 'R$ 0,00',
  gastosPendentes = 'R$ 0,00',
  totalAdiantado = 'R$ 0,00',
  saldoReceber = 'R$ 0,00',
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu backup semanal das diárias está pronto</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Backup semanal das suas diárias</Heading>
        <Text style={text}>
          Geramos automaticamente uma cópia de segurança dos seus dados
          {periodo ? ` (${periodo})` : ''}. Guarde este arquivo em um lugar seguro.
        </Text>

        <Section style={saldoCard}>
          <Text style={saldoLabel}>Saldo a receber</Text>
          <Text style={saldoValor}>{saldoReceber}</Text>
          <Text style={saldoSub}>
            Diárias pendentes {diariasPendentes} + gastos pendentes {gastosPendentes}
          </Text>
        </Section>

        <Section style={card}>
          <Text style={row}>
            <strong>Diárias registradas:</strong> {qtdDiarias}
          </Text>
          <Text style={row}>
            <strong>Adiantamentos:</strong> {qtdAdiantamentos}
          </Text>
          <Text style={row}>
            <strong>Total em diárias:</strong> {totalDiarias}
          </Text>
          <Text style={row}>
            <strong>Gastos registrados:</strong> {qtdGastos}
          </Text>
          <Text style={row}>
            <strong>Total adiantado:</strong> {totalAdiantado}
          </Text>
        </Section>

        {downloadUrl ? (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            {pdfUrl ? (
              <Button style={{ ...button, marginBottom: '12px' }} href={pdfUrl}>
                Ver fechamento (PDF)
              </Button>
            ) : null}
            <br />
            <Button style={button} href={downloadUrl}>
              Baixar backup (.json)
            </Button>
            <Text style={small}>O link de download expira em 7 dias.</Text>
          </Section>
        ) : (
          <Text style={text}>
            Abra o aplicativo em Minha conta para baixar o backup manualmente.
          </Text>
        )}

        <Hr style={hr} />
        <Text style={small}>
          Você recebe este e-mail semanalmente para não perder seus registros de diárias.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Backup semanal das suas diárias',
  displayName: 'Backup semanal',
  previewData: {
    periodo: '08/08/2026 a 15/08/2026',
    qtdDiarias: 41,
    qtdAdiantamentos: 8,
    totalDiarias: 'R$ 8.200,00',
    downloadUrl: 'https://example.com/backup.json',
    pdfUrl: 'https://example.com/fechamento.pdf',
    qtdGastos: 5,
    diariasPendentes: 'R$ 1.900,00',
    gastosPendentes: 'R$ 120,00',
    totalAdiantado: 'R$ 14.800,00',
    saldoReceber: 'R$ 2.020,00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#334155' }
const card = {
  backgroundColor: '#f1f5f9',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '20px 0',
}
const row = { fontSize: '15px', color: '#0f172a', margin: '6px 0' }
const button = {
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '12px 22px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const small = { fontSize: '12px', color: '#64748b' }
const saldoCard = { backgroundColor: '#1d4ed8', borderRadius: '12px', padding: '16px 20px', margin: '20px 0' }
const saldoLabel = { fontSize: '13px', color: '#dbeafe', margin: 0 }
const saldoValor = { fontSize: '28px', fontWeight: 700, color: '#ffffff', margin: '4px 0' }
const saldoSub = { fontSize: '12px', color: '#dbeafe', margin: 0 }
