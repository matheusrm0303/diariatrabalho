import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Calendar, HandCoins } from "lucide-react";
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
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <HandCoins className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Total recebido em adiantamentos</p>
        </div>
        <p className="text-2xl font-semibold text-sky-600">{fmt.format(total)}</p>
      </Card>

      <Card className="p-4 mb-6">
        <h2 className="mb-3 text-sm font-medium">Novo adiantamento</h2>
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
          <Button type="submit" className="h-11">
            <Plus className="h-4 w-4" />
            Registrar adiantamento
          </Button>
        </form>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Lançamentos</h2>
        {ordenados.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhum adiantamento registrado ainda.
          </Card>
        ) : (
          <div className="grid gap-2">
            {ordenados.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                    {a.observacao && (
                      <p className="mt-1 text-sm">{a.observacao}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-sky-600">{fmt.format(a.valor)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remover(a.id)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
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
