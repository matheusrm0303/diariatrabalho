import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Calendar, HandCoins, TrendingUp, Wallet } from "lucide-react";
import { useAdiantamentos, fmt, todayISO } from "@/lib/diarias-store";

export function AdiantamentoTab() {
  const { adiantamentos, adicionar, remover } = useAdiantamentos();
  const [data, setData] = useState(todayISO());
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");

  const total = useMemo(
    () => adiantamentos.reduce((s, a) => s + a.valor, 0),
    [adiantamentos],
  );

  const totalMes = useMemo(() => {
    const hoje = new Date();
    const prefix = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    return adiantamentos
      .filter((a) => a.data.startsWith(prefix))
      .reduce((s, a) => s + a.valor, 0);
  }, [adiantamentos]);

  const media = adiantamentos.length > 0 ? total / adiantamentos.length : 0;

  const ordenados = useMemo(
    () => [...adiantamentos].sort((a, b) => b.data.localeCompare(a.data)),
    [adiantamentos],
  );

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) return;
    adicionar({ data, valor: v, observacao: observacao.trim() || undefined });
    setValor("");
    setObservacao("");
  }

  return (
    <div>
      {/* KPI bento */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 to-sky-600 p-5 text-white shadow-lg shadow-sky-500/20">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider opacity-90">
            <HandCoins className="h-3.5 w-3.5" />
            Total recebido
          </div>
          <h2 className="mt-1 font-display text-3xl font-bold">{fmt.format(total)}</h2>
          <p className="mt-2 text-xs opacity-90">
            {adiantamentos.length} {adiantamentos.length === 1 ? "lançamento" : "lançamentos"} registrados
          </p>
        </div>

        <Card className="rounded-3xl border-transparent p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Calendar className="h-3 w-3" /> Este mês
          </div>
          <p className="mt-1 font-display text-lg font-bold text-sky-600 dark:text-sky-400">
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
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
            <Wallet className="h-4 w-4" />
          </div>
          <h2 className="font-display text-base font-bold">Novo adiantamento</h2>
        </div>
        <form onSubmit={salvar} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="adiant-data">Data</Label>
              <Input
                id="adiant-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="adiant-valor">Valor (R$)</Label>
              <Input
                id="adiant-valor"
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
            <Label htmlFor="adiant-obs">Observação</Label>
            <Textarea
              id="adiant-obs"
              placeholder="Ex.: adiantamento referente ao evento de sábado"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>
          <Button type="submit" className="h-12 rounded-xl text-sm font-bold">
            <Plus className="h-4 w-4" />
            Registrar adiantamento
          </Button>
        </form>
      </Card>

      {/* Lançamentos */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Lançamentos</h2>
          <span className="text-xs font-medium text-muted-foreground">
            {ordenados.length} {ordenados.length === 1 ? "item" : "itens"}
          </span>
        </div>
        {ordenados.length === 0 ? (
          <Card className="rounded-2xl border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum adiantamento registrado ainda.
          </Card>
        ) : (
          <div className="grid gap-2">
            {ordenados.map((a) => (
              <Card key={a.id} className="rounded-2xl border-transparent p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
                    <HandCoins className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {a.observacao && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.observacao}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-display text-base font-bold text-sky-600 dark:text-sky-400">
                      {fmt.format(a.valor)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remover(a.id)}
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
