import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Calendar, Receipt, Car, TrendingUp } from "lucide-react";
import {
  useGastos,
  GASTO_CATEGORIAS,
  fmt,
  todayISO,
  type GastoCategoria,
} from "@/lib/diarias-store";

function labelCategoria(c: GastoCategoria) {
  return GASTO_CATEGORIAS.find((x) => x.value === c)?.label ?? "Outros";
}

export function GastosTab() {
  const { gastos, adicionar, remover } = useGastos();
  const [data, setData] = useState(todayISO());
  const [categoria, setCategoria] = useState<GastoCategoria>("uber");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");

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
            {ordenados.map((g) => (
              <Card key={g.id} className="rounded-2xl border-transparent p-4 shadow-sm">
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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remover(g.id)}
                      aria-label="Remover"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
