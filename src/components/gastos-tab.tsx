import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  Plus,
  Calendar,
  Receipt,
  Car,
  TrendingUp,
  Pencil,
  Check,
  X,
  Camera,
  Loader2,
  Sparkles,
} from "lucide-react";
import { lerNotasGastos } from "@/lib/gasto-ocr.functions";
import {
  useGastos,
  enviarComprovante,
  urlComprovante,
  GASTO_CATEGORIAS,
  fmt,
  todayISO,
  type GastoCategoria,
} from "@/lib/diarias-store";

function labelCategoria(c: GastoCategoria) {
  return GASTO_CATEGORIAS.find((x) => x.value === c)?.label ?? "Outros";
}

const CATEGORIA_VALUES = GASTO_CATEGORIAS.map((c) => c.value);

type Refeicao = "almoco" | "janta";

type Detectado = {
  key: string;
  data: string;
  categoria: GastoCategoria;
  refeicao: Refeicao;
  descricao: string;
  valor: string;
  foto?: string;
};

function comRefeicao(d: Detectado) {
  const base = d.descricao.trim().replace(/^(almo[çc]o|janta|jantar)\s*[-–—:]\s*/i, "");
  if (d.categoria !== "alimentacao") return base;
  const rot = d.refeicao === "janta" ? "Janta" : "Almoço";
  return base ? `${rot} — ${base}` : rot;
}

async function comprimirImagem(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.7);
}

export function GastosTab() {
  const { gastos, adicionar, remover, atualizar } = useGastos();
  const [data, setData] = useState(todayISO());
  const [categoria, setCategoria] = useState<GastoCategoria>("uber");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [eData, setEData] = useState(todayISO());
  const [eCategoria, setECategoria] = useState<GastoCategoria>("uber");
  const [eDescricao, setEDescricao] = useState("");
  const [eValor, setEValor] = useState("");
  const [lendo, setLendo] = useState(false);
  const [salvandoLote, setSalvandoLote] = useState(false);
  const [detectados, setDetectados] = useState<Detectado[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const lerNotas = useServerFn(lerNotasGastos);

  async function onFotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const lista = Array.from(files).slice(0, 10);
    setLendo(true);
    try {
      const imagens = await Promise.all(lista.map(comprimirImagem));
      const res = await lerNotas({ data: { imagens, hoje: todayISO() } });
      const brutos = JSON.parse(res.gastosJson) as Array<Record<string, unknown>>;
      const itens: Detectado[] = brutos
        .map((g, i) => {
          const v = Number(g["valor"]);
          const idxImg = Number(g["indiceImagem"]);
          const foto =
            imagens[Number.isFinite(idxImg) && idxImg >= 0 ? idxImg : i] ?? imagens[0];
          const cat = String(g["categoria"] ?? "outros") as GastoCategoria;
          const ref = String(g["refeicao"] ?? "").toLowerCase();
          return {
            key: `${Date.now()}-${i}`,
            data: /^\d{4}-\d{2}-\d{2}$/.test(String(g["data"] ?? ""))
              ? String(g["data"])
              : todayISO(),
            categoria: CATEGORIA_VALUES.includes(cat) ? cat : "outros",
            refeicao: (ref.startsWith("jant") ? "janta" : "almoco") as Refeicao,
            descricao: String(g["descricao"] ?? ""),
            valor: Number.isFinite(v) && v > 0 ? String(v) : "",
            foto,
          };
        })
        .filter((g) => g.valor !== "");
      if (itens.length === 0) {
        toast.error("Nenhum gasto identificado nas fotos.");
      } else {
        setDetectados((prev) => [...prev, ...itens]);
        toast.success(`${itens.length} gasto(s) identificado(s). Confira e registre.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao ler as fotos.");
    } finally {
      setLendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function registrarTodos() {
    const validos = detectados.filter((d) => parseFloat(d.valor.replace(",", ".")) > 0);
    if (validos.length === 0) return;
    setSalvandoLote(true);
    try {
      for (const d of validos) {
        const comprovantePath = d.foto ? await enviarComprovante(d.foto) : null;
        await adicionar({
          data: d.data,
          categoria: d.categoria,
          descricao: comRefeicao(d),
          valor: parseFloat(d.valor.replace(",", ".")),
          comprovantePath,
        });
      }
      setDetectados([]);
      toast.success(`${validos.length} gasto(s) registrado(s).`);
    } finally {
      setSalvandoLote(false);
    }
  }

  function patchDetectado(key: string, patch: Partial<Detectado>) {
    setDetectados((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  const total = useMemo(() => gastos.reduce((s, g) => s + g.valor, 0), [gastos]);


  const totalMes = useMemo(() => {
    const hoje = new Date();
    const prefix = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    return gastos
      .filter((g) => g.data.startsWith(prefix))
      .reduce((s, g) => s + g.valor, 0);
  }, [gastos]);

  const media = gastos.length > 0 ? total / gastos.length : 0;

  const ordenados = useMemo(
    () => [...gastos].sort((a, b) => b.data.localeCompare(a.data)),
    [gastos],
  );

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) return;
    void adicionar({ data, categoria, descricao: descricao.trim(), valor: v });
    setValor("");
    setDescricao("");
  }

  return (
    <div className="pb-28">
      {/* KPI bento */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white shadow-lg shadow-amber-500/20">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider opacity-90">
            <Receipt className="h-3.5 w-3.5" />
            Total em gastos (reembolso)
          </div>
          <h2 className="mt-1 font-display text-3xl font-bold">{fmt.format(total)}</h2>
          <p className="mt-2 text-xs opacity-90">
            {gastos.length} {gastos.length === 1 ? "gasto" : "gastos"} registrados
          </p>
        </div>

        <Card className="rounded-3xl border-transparent p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Calendar className="h-3 w-3" /> Este mês
          </div>
          <p className="mt-1 font-display text-lg font-bold text-amber-600 dark:text-amber-400">
            {fmt.format(totalMes)}
          </p>
        </Card>
        <Card className="rounded-3xl border-transparent p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Média
          </div>
          <p className="mt-1 font-display text-lg font-bold">{fmt.format(media)}</p>
        </Card>
      </div>

      {/* Leitura de notas com IA */}
      <Card className="mb-6 rounded-3xl border-transparent p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold">Ler notas com IA</h2>
            <p className="text-xs text-muted-foreground">
              Selecione até 10 fotos de uma vez — os gastos são criados automaticamente.
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void onFotos(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={lendo}
          onClick={() => fileRef.current?.click()}
          className="h-12 w-full rounded-xl text-sm font-bold"
        >
          {lendo ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo fotos...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" /> Enviar fotos das notas
            </>
          )}
        </Button>

        {detectados.length > 0 && (
          <div className="mt-4 grid gap-3">
            <p className="text-xs font-semibold text-muted-foreground">
              {detectados.length} gasto(s) identificado(s) — confira antes de registrar
            </p>
            {detectados.map((d) => (
              <div key={d.key} className="grid gap-2 rounded-2xl border border-dashed p-3">
                <div className="flex flex-wrap gap-1.5">
                  {GASTO_CATEGORIAS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => patchDetectado(d.key, { categoria: c.value })}
                      className={
                        "rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors " +
                        (d.categoria === c.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent")
                      }
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {d.categoria === "alimentacao" && (
                  <div className="flex gap-1.5">
                    {(["almoco", "janta"] as Refeicao[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => patchDetectado(d.key, { refeicao: r })}
                        className={
                          "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors " +
                          (d.refeicao === r
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-input bg-background hover:bg-accent")
                        }
                      >
                        {r === "almoco" ? "Almoço" : "Janta"}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={d.data}
                    onChange={(e) => patchDetectado(d.key, { data: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={d.valor}
                    onChange={(e) => patchDetectado(d.key, { valor: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Descrição"
                    value={d.descricao}
                    onChange={(e) => patchDetectado(d.key, { descricao: e.target.value })}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Descartar"
                    onClick={() => setDetectados((prev) => prev.filter((x) => x.key !== d.key))}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={salvandoLote}
                onClick={() => void registrarTodos()}
                className="h-11 flex-1 rounded-xl text-sm font-bold"
              >
                {salvandoLote ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Registrando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Registrar {detectados.length} gasto(s)
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl text-sm font-bold"
                onClick={() => setDetectados([])}
              >
                Limpar
              </Button>
            </div>
          </div>
        )}
      </Card>


      {/* Form */}
      <Card className="mb-6 rounded-3xl border-transparent p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
            <Car className="h-4 w-4" />
          </div>
          <h2 className="font-display text-base font-bold">Novo gasto</h2>
        </div>
        <form onSubmit={salvar} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-2">
              {GASTO_CATEGORIAS.map((c) => {
                const active = categoria === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategoria(c.value)}
                    className={
                      "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent")
                    }
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="gasto-data">Data</Label>
              <Input
                id="gasto-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gasto-valor">Valor (R$)</Label>
              <Input
                id="gasto-valor"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gasto-desc">Descrição</Label>
            <Input
              id="gasto-desc"
              placeholder="Ex.: Uber até a Arena Centro"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 rounded-xl text-sm font-bold">
            <Plus className="h-4 w-4" />
            Registrar gasto
          </Button>
        </form>
      </Card>

      {/* Lista */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Gastos</h2>
          <span className="text-xs font-medium text-muted-foreground">
            {ordenados.length} {ordenados.length === 1 ? "item" : "itens"}
          </span>
        </div>
        {ordenados.length === 0 ? (
          <Card className="rounded-2xl border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum gasto adicional registrado ainda.
          </Card>
        ) : (
          <div className="grid gap-2">
            {ordenados.map((g) => {
              const editando = editId === g.id;
              return (
              <Card key={g.id} className="rounded-2xl border-transparent p-4 shadow-sm">
                {editando ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = parseFloat(eValor.replace(",", "."));
                      if (!v || v <= 0) return;
                      void atualizar(g.id, {
                        data: eData,
                        categoria: eCategoria,
                        descricao: eDescricao.trim(),
                        valor: v,
                      });
                      setEditId(null);
                    }}
                    className="grid gap-3"
                  >
                    <div className="flex flex-wrap gap-2">
                      {GASTO_CATEGORIAS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setECategoria(c.value)}
                          className={
                            "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors " +
                            (eCategoria === c.value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background hover:bg-accent")
                          }
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="date"
                        value={eData}
                        onChange={(e) => setEData(e.target.value)}
                        required
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={eValor}
                        onChange={(e) => setEValor(e.target.value)}
                        required
                      />
                    </div>
                    <Input
                      placeholder="Descrição"
                      value={eDescricao}
                      onChange={(e) => setEDescricao(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" className="h-10 flex-1 rounded-xl text-xs font-bold">
                        <Check className="h-4 w-4" /> Salvar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 flex-1 rounded-xl text-xs font-bold"
                        onClick={() => setEditId(null)}
                      >
                        <X className="h-4 w-4" /> Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{labelCategoria(g.categoria)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(g.data + "T00:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {g.descricao ? ` • ${g.descricao}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-display text-base font-bold text-amber-600 dark:text-amber-400">
                      {fmt.format(g.valor)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditId(g.id);
                          setEData(g.data);
                          setECategoria(g.categoria);
                          setEDescricao(g.descricao);
                          setEValor(String(g.valor));
                        }}
                        aria-label="Editar"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Apagar o gasto de ${fmt.format(g.valor)}? Essa ação não pode ser desfeita.`,
                            )
                          )
                            void remover(g.id);
                        }}
                        aria-label="Remover"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                )}
              </Card>
              );
            })}

          </div>
        )}
      </section>
    </div>
  );
}
