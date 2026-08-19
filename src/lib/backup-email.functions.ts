import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const enviarBackupPorEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string })?.email;
    if (!email) return { ok: false as const, motivo: "sem-email" };

    const [{ data: diarias }, { data: adiantamentos }, { data: gastos }] =
      await Promise.all([
        supabase.from("diarias").select("*").eq("user_id", userId),
        supabase.from("adiantamentos").select("*").eq("user_id", userId),
        supabase.from("gastos").select("*").eq("user_id", userId),
      ]);

    const hoje = new Date();
    const stamp = hoje.toISOString().slice(0, 10);
    const lista = (diarias ?? []) as unknown as {
      valor: number | string;
      alimentacao: number | string | null;
      status: string;
    }[];
    const fmt = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const total = lista.reduce(
      (a, d) => a + Number(d.valor) + Number(d.alimentacao ?? 0),
      0,
    );
    const pendente = lista
      .filter((d) => d.status !== "pago")
      .reduce((a, d) => a + Number(d.valor) + Number(d.alimentacao ?? 0), 0);
    const totalAdiantado = (adiantamentos ?? []).reduce(
      (a: number, x: { valor: number | string }) => a + Number(x.valor),
      0,
    );
    const totalGastos = (gastos ?? []).reduce(
      (a: number, x: { valor: number | string }) => a + Number(x.valor),
      0,
    );

    const json = JSON.stringify(
      {
        versao: 1,
        geradoEm: hoje.toISOString(),
        diarias,
        adiantamentos,
        gastos,
      },
      null,
      2,
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${userId}/backup-manual-${Date.now()}.json`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("backups")
      .upload(path, new Blob([json], { type: "application/json" }), {
        upsert: true,
        contentType: "application/json",
      });
    if (upErr) throw upErr;
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("backups")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr) throw signErr;

    let pdfUrl: string | undefined;
    try {
      const { gerarFechamentoPDF } = await import("@/lib/fechamento-pdf.server");
      const pdf = await gerarFechamentoPDF({
        titulo: email,
        periodo: `Fechamento gerado em ${hoje.toLocaleDateString("pt-BR")}`,
        diarias: (diarias ?? []) as never[],
        adiantamentos: (adiantamentos ?? []) as never[],
      });
      const pdfPath = `${userId}/fechamento-manual-${Date.now()}.pdf`;
      const { error: pdfErr } = await supabaseAdmin.storage
        .from("backups")
        .upload(pdfPath, new Blob([pdf as BlobPart], { type: "application/pdf" }), {
          upsert: true,
          contentType: "application/pdf",
        });
      if (!pdfErr) {
        const { data: pdfSigned } = await supabaseAdmin.storage
          .from("backups")
          .createSignedUrl(pdfPath, 60 * 60 * 24 * 7);
        pdfUrl = pdfSigned?.signedUrl;
      }
    } catch (e) {
      console.error("backup manual: PDF falhou", e);
    }

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("backup-semanal", email, {
      idempotencyKey: `backup-manual-${userId}-${Date.now()}`,
      templateData: {
        periodo: `Backup gerado em ${hoje.toLocaleDateString("pt-BR")} (${stamp})`,
        qtdDiarias: lista.length,
        qtdAdiantamentos: (adiantamentos ?? []).length,
        totalDiarias: fmt.format(total),
        saldoReceber: fmt.format(pendente + totalGastos - totalAdiantado),
        downloadUrl: signed?.signedUrl,
        pdfUrl,
      },
    });

    return { ok: result.sent, email, motivo: result.sent ? null : result.reason };
  });
