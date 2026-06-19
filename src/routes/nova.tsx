import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { useDiarias, todayISO, fmt, type Tipo } from "@/lib/diarias-store";

export const Route = createFileRoute("/nova")({
  head: () => ({
    meta: [
      { title: "Nova diária" },
      { name: "description", content: "Cadastre uma nova diária." },
    ],
  }),
  component: Nova,
});

const PRESETS: { tipo: Tipo; label: string; valor: number }[] = [
  { tipo: "rua-200", label: "Rua R$ 200", valor: 200 },
  { tipo: "deposito-100", label: "Depósito R$ 100", valor: 100 },
  { tipo: "personalizada", label: "Personalizada", valor: 0 },
];

function Nova() {
  const navigate = useNavigate();
  const { adicionar } = useDiarias();

  const [tipo, setTipo] = useState<Tipo>("rua-200");
  const [valor, setValor] = useState<string>("200");
  const [local, setLocal] = useState("");
  const [data, setData] = useState(todayISO());
  const [incluiAlim, setIncluiAlim] = useState(false);
  const [alimentacao, setAlimentacao] = useState("");
  const [alimentacaoObs, setAlimentacaoObs] = useState("");

  function selecionarTipo(p: (typeof PRESETS)[number]) {
    setTipo(p.tipo);
    if (p.tipo !== "personalizada") setValor(String(p.valor));
    else setValor("");
  }

  function parseNum(v: string) {
    return parseFloat(v.replace(",", ".")) || 0;
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseNum(valor);
    if (!local.trim() || v <= 0) return;
    adicionar({
      data,
      local: local.trim(),
      descricao: PRESETS.find((p) => p.tipo === tipo)?.label || "Diária",
      valor: v,
      tipo,
      alimentacao: incluiAlim ? parseNum(alimentacao) : 0,
      alimentacaoObs: incluiAlim ? alimentacaoObs.trim() : "",
    });
    navigate({ to: "/" });
  }

  const total = parseNum(valor) + (incluiAlim ? parseNum(alimentacao) : 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link to="/" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Nova diária</h1>
            <p className="text-sm text-muted-foreground">Preencha os dados do evento.</p>
          </div>
        </header>

        <form onSubmit={salvar} className="grid gap-5">
          <Card className="p-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="local">Local do evento</Label>
              <Input
                id="local"
                placeholder="Ex.: Arena Centro"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="data">Dia</Label>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
          </Card>

          <Card className="p-4 grid gap-3">
            <Label>Tipo de diária</Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => {
                const active = tipo === p.tipo;
                return (
                  <button
                    key={p.tipo}
                    type="button"
                    onClick={() => selecionarTipo(p)}
                    className={
                      "rounded-md border px-3 py-3 text-sm transition-colors " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent")
                    }
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input
                id="valor"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0,00"
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value);
                  setTipo("personalizada");
                }}
                required
              />
            </div>
          </Card>

          <Card className="p-4 grid gap-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="alim-switch">Alimentação</Label>
                <p className="text-xs text-muted-foreground">
                  Adicionar valor de alimentação
                </p>
              </div>
              <Switch
                id="alim-switch"
                checked={incluiAlim}
                onCheckedChange={setIncluiAlim}
              />
            </div>
            {incluiAlim && (
              <div className="grid gap-2">
                <Label htmlFor="alim">Valor alimentação (R$)</Label>
                <Input
                  id="alim"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0,00"
                  value={alimentacao}
                  onChange={(e) => setAlimentacao(e.target.value)}
                />
              </div>
            )}
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold">{fmt.format(total)}</span>
          </Card>

          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/">Cancelar</Link>
            </Button>
            <Button type="submit" className="flex-1">
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
