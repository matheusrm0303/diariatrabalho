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

export type DiariaImportada = {
  data: string;
  local?: string;
  descricao?: string;
  valor: number;
  tipo?: string;
  status?: string;
  alimentacao?: number;
  alimentacaoObs?: string;
};
export type AdiantImportado = { data: string; valor: number; observacao?: string };

/** Insere registros já normalizados (ex.: vindos da análise por IA), mesclando com os atuais. */
export async function importarRegistros(
  diariasIn: DiariaImportada[],
  adiantIn: AdiantImportado[],
): Promise<ImportResult> {
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  if (!user_id) throw new Error("Sessão expirada. Entre novamente.");

  const diarias = diariasIn.map((d) => ({
    user_id,
    data: d.data,
    local: d.local ?? "",
    descricao: d.descricao ?? "",
    valor: Number(d.valor) || 0,
    tipo: d.tipo ?? "personalizada",
    status: d.status === "pago" ? "pago" : "pendente",
    alimentacao: Number(d.alimentacao) || 0,
    alimentacao_obs: d.alimentacaoObs ?? "",
  }));
  const adiants = adiantIn.map((a) => ({
    user_id,
    data: a.data,
    valor: Number(a.valor) || 0,
    observacao: a.observacao ?? "",
  }));

  let diariasInseridas = 0;
  let adiantInseridos = 0;
  const idsDiarias: string[] = [];
  const idsAdiant: string[] = [];
  if (diarias.length > 0) {
    const { data, error } = await supabase
      .from("diarias" as never)
      .insert(diarias as never)
      .select("id");
    if (error) throw error;
    diariasInseridas = diarias.length;
    for (const r of (data ?? []) as { id: string }[]) idsDiarias.push(r.id);
  }
  if (adiants.length > 0) {
    const { data, error } = await supabase
      .from("adiantamentos" as never)
      .insert(adiants as never)
      .select("id");
    if (error) throw error;
    adiantInseridos = adiants.length;
    for (const r of (data ?? []) as { id: string }[]) idsAdiant.push(r.id);
  }
  salvarUltimaImportacao({ diarias: idsDiarias, adiantamentos: idsAdiant, em: new Date().toISOString() });
  return { diariasInseridas, adiantInseridos };
}

/* ---- Desfazer última importação ---- */
export type UltimaImportacao = { diarias: string[]; adiantamentos: string[]; em: string };
const KEY_IMPORT = "import:ultima";

function salvarUltimaImportacao(v: UltimaImportacao) {
  try {
    localStorage.setItem(KEY_IMPORT, JSON.stringify(v));
  } catch { /* ignore */ }
}

export function ultimaImportacao(): UltimaImportacao | null {
  try {
    const raw = localStorage.getItem(KEY_IMPORT);
    if (!raw) return null;
    const v = JSON.parse(raw) as UltimaImportacao;
    if (!v || (!v.diarias?.length && !v.adiantamentos?.length)) return null;
    return v;
  } catch {
    return null;
  }
}

export function limparUltimaImportacao() {
  try {
    localStorage.removeItem(KEY_IMPORT);
  } catch { /* ignore */ }
}

/** Remove do banco os registros da última importação. */
export async function desfazerUltimaImportacao(): Promise<ImportResult> {
  const v = ultimaImportacao();
  if (!v) return { diariasInseridas: 0, adiantInseridos: 0 };
  if (v.diarias.length > 0) {
    const { error } = await supabase.from("diarias" as never).delete().in("id", v.diarias);
    if (error) throw error;
  }
  if (v.adiantamentos.length > 0) {
    const { error } = await supabase.from("adiantamentos" as never).delete().in("id", v.adiantamentos);
    if (error) throw error;
  }
  limparUltimaImportacao();
  return { diariasInseridas: v.diarias.length, adiantInseridos: v.adiantamentos.length };
}


/* ---- Lembrete semanal de backup ---- */
const KEY_ULTIMO = "backup:ultimo";
const KEY_ADIADO = "backup:adiado";
export const INTERVALO_BACKUP_MS = 7 * 24 * 60 * 60 * 1000;

export function marcarBackupFeito() {
  try {
    localStorage.setItem(KEY_ULTIMO, new Date().toISOString());
    localStorage.removeItem(KEY_ADIADO);
  } catch { /* ignore */ }
}

export function adiarLembreteBackup(dias = 1) {
  try {
    localStorage.setItem(KEY_ADIADO, new Date(Date.now() + dias * 86_400_000).toISOString());
  } catch { /* ignore */ }
}

export function ultimoBackupEm(): Date | null {
  try {
    const v = localStorage.getItem(KEY_ULTIMO);
    return v ? new Date(v) : null;
  } catch { return null; }
}

export function precisaBackup(): boolean {
  try {
    const adiado = localStorage.getItem(KEY_ADIADO);
    if (adiado && Date.now() < new Date(adiado).getTime()) return false;
  } catch { /* ignore */ }
  const ultimo = ultimoBackupEm();
  if (!ultimo) return true;
  return Date.now() - ultimo.getTime() >= INTERVALO_BACKUP_MS;
}
