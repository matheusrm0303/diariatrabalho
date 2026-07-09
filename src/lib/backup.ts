import { supabase } from "@/integrations/supabase/client";

export type BackupPayload = {
  formato: "diaria-facil-backup";
  versao: 1;
  exportadoEm: string;
  diarias: Array<Record<string, unknown>>;
  adiantamentos: Array<Record<string, unknown>>;
};

export async function exportarBackup(): Promise<BackupPayload> {
  const [d, a] = await Promise.all([
    supabase.from("diarias" as never).select("*").order("data", { ascending: false }),
    supabase.from("adiantamentos" as never).select("*").order("data", { ascending: false }),
  ]);
  if (d.error) throw d.error;
  if (a.error) throw a.error;
  return {
    formato: "diaria-facil-backup",
    versao: 1,
    exportadoEm: new Date().toISOString(),
    diarias: (d.data as unknown as Array<Record<string, unknown>>) ?? [],
    adiantamentos: (a.data as unknown as Array<Record<string, unknown>>) ?? [],
  };
}

export function baixarBackupJSON(payload: BackupPayload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `backup-diarias-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

type ImportResult = { diariasInseridas: number; adiantInseridos: number };

const CAMPOS_DIARIA = ["data", "local", "descricao", "valor", "tipo", "status", "alimentacao", "alimentacao_obs"];
const CAMPOS_ADIANT = ["data", "valor", "observacao"];

function pick(obj: Record<string, unknown>, campos: string[]) {
  const out: Record<string, unknown> = {};
  for (const c of campos) if (obj[c] !== undefined) out[c] = obj[c];
  return out;
}

export async function importarBackup(
  payload: BackupPayload,
  modo: "mesclar" | "substituir",
): Promise<ImportResult> {
  if (payload?.formato !== "diaria-facil-backup") {
    throw new Error("Arquivo inválido: não é um backup do Diária Fácil.");
  }
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  if (!user_id) throw new Error("Sessão expirada. Entre novamente.");

  if (modo === "substituir") {
    const [rd, ra] = await Promise.all([
      supabase.from("diarias" as never).delete().eq("user_id", user_id),
      supabase.from("adiantamentos" as never).delete().eq("user_id", user_id),
    ]);
    if (rd.error) throw rd.error;
    if (ra.error) throw ra.error;
  }

  const diarias = (payload.diarias ?? []).map((d) => ({
    ...pick(d, CAMPOS_DIARIA),
    user_id,
  }));
  const adiants = (payload.adiantamentos ?? []).map((a) => ({
    ...pick(a, CAMPOS_ADIANT),
    user_id,
  }));

  let diariasInseridas = 0;
  let adiantInseridos = 0;
  if (diarias.length > 0) {
    const { error, count } = await supabase
      .from("diarias" as never)
      .insert(diarias as never, { count: "exact" });
    if (error) throw error;
    diariasInseridas = count ?? diarias.length;
  }
  if (adiants.length > 0) {
    const { error, count } = await supabase
      .from("adiantamentos" as never)
      .insert(adiants as never, { count: "exact" });
    if (error) throw error;
    adiantInseridos = count ?? adiants.length;
  }

  return { diariasInseridas, adiantInseridos };
}
