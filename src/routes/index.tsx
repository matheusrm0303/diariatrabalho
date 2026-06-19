import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controle de Diárias" },
      { name: "description", content: "Registre e acompanhe suas diárias de rua." },
    ],
  }),
  component: Index,
});

type Tipo = "rua-200" | "rua-100" | "personalizada";

type Diaria = {
  id: string;
  data: string; // ISO date
  descricao: string;
  valor: number;
  tipo: Tipo;
};

const STORAGE_KEY = "diarias.v1";

const PRESETS: { tipo: Tipo; label: string; valor: number }[] = [
  { tipo: "rua-200", label: "Diária de Rua", valor: 200 },
  { tipo: "rua-100", label: "Diária de Rua", valor: 100 },
];

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function Index() {
  const [diarias, setDiarias] = useState<Diaria[]>([]);
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(todayISO());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDiarias(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diarias));
  }, [diarias]);

  const total = useMemo(() => diarias.reduce((s, d) => s + d.valor, 0), [diarias]);
  const totalMes = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return diarias
      .filter((d) => d.data.startsWith(ym))
      .reduce((s, d) => s + d.valor, 0);
  }, [diarias]);

  const ordenadas = useMemo(
    () => [...diarias].sort((a, b) => b.data.localeCompare(a.data)),
    [diarias],
  );

  function adicionarPreset(p: { tipo: Tipo; label: string; valor: number }) {
    setDiarias((prev) => [
      {
        id: crypto.randomUUID(),
        data: todayISO(),
        descricao: p.label,
        valor: p.valor,
        tipo: p.tipo,
      },
      ...prev,
    ]);
  }

  function abrirPersonalizada() {
    setValor("");
    setDescricao("");
    setData(todayISO());
    setOpen(true);
  }

  function salvarPersonalizada() {
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) return;
    setDiarias((prev) => [
      {
        id: crypto.randomUUID(),
        data,
        descricao: descricao.trim() || "Diária personalizada",
        valor: v,
        tipo: "personalizada",
      },
      ...prev,
    ]);
    setOpen(false);
  }

  function remover(id: string) {
    setDiarias((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Controle de Diárias</h1>
            <p className="text-sm text-muted-foreground">
              Registre suas diárias com poucos toques.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total do mês</p>
            <p className="mt-1 text-xl font-semibold">{fmt.format(totalMes)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total geral</p>
            <p className="mt-1 text-xl font-semibold">{fmt.format(total)}</p>
          </Card>
        </div>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Adicionar diária
          </h2>
          <div className="grid gap-3">
            {PRESETS.map((p) => (
              <Button
                key={p.tipo}
                onClick={() => adicionarPreset(p)}
                className="h-auto justify-between py-4"
                variant="secondary"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {p.label}
                </span>
                <span className="font-semibold">{fmt.format(p.valor)}</span>
              </Button>
            ))}
            <Button
              onClick={abrirPersonalizada}
              variant="outline"
              className="h-auto justify-between py-4"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Diária personalizada
              </span>
              <span className="text-muted-foreground">Definir valor</span>
            </Button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Histórico</h2>
          {ordenadas.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma diária registrada ainda.
            </Card>
          ) : (
            <div className="grid gap-2">
              {ordenadas.map((d) => (
                <Card key={d.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{d.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{fmt.format(d.valor)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remover(d.id)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Diária personalizada</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input
                id="valor"
                type="number"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                placeholder="Ex.: Diária especial"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarPersonalizada}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
