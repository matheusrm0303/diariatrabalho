import { createFileRoute, useNavigate, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { useDiarias, fmt, type Tipo, type Status } from "@/lib/diarias-store";

export const Route = createFileRoute("/editar/$id")({
  head: () => ({
    meta: [
      { title: "Editar diária" },
      { name: "description", content: "Edite uma diária registrada." },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm text-muted-foreground">Diária não encontrada.</p>
      <Button asChild className="mt-4">
        <Link to="/">Voltar</Link>
      </Button>
    </div>
  ),
  component: Editar,
});

const PRESETS: { tipo: Tipo; label: string; valor: number }[] = [
  { tipo: "rua-200", label: "Rua R$ 200", valor: 200 },
  { tipo: "deposito-100", label: "Depósito R$ 100", valor: 100 },
  { tipo: "personalizada", label: "Personalizada", valor: 0 },
];

function Editar() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { diarias, atualizar } = useDiarias();
  const atual = diarias.find((d) => d.id === id);

  const [tipo, setTipo] = useState<Tipo>("rua-200");
  const [valor, setValor] = useState<string>("");
  const [local, setLocal] = useState("");
  const [data, setData] = useState("");
  const [status, setStatus] = useState<Status>("pendente");
  const [incluiAlim, setIncluiAlim] = useState(false);
  const [alimentacao, setAlimentacao] = useState("");
  const [alimentacaoObs, setAlimentacaoObs] = useState("");
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (atual && !carregado) {
      setTipo(atual.tipo);
      setValor(String(atual.valor));
      setLocal(atual.local);
      setData(atual.data);
      setIncluiAlim(!!(atual.alimentacao || atual.alimentacaoObs));
      setAlimentacao(atual.alimentacao ? String(atual.alimentacao) : "");
      setAlimentacaoObs(atual.alimentacaoObs || "");
      setCarregado(true);
    }
  }, [atual, carregado]);

  if (!atual && diarias.length > 0 && carregado === false) {
    // diárias carregadas mas id inexistente
    throw notFound();
  }

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
    atualizar(id, {
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
            <h1 className="text-xl font-semibold tracking-tight">Editar diária</h1>
            <p className="text-sm text-muted-foreground">Atualize os dados do evento.</p>
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
              <div className="grid gap-3">
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
                <div className="grid gap-2">
                  <Label htmlFor="alim-obs">Observação</Label>
                  <Textarea
                    id="alim-obs"
                    placeholder="Ex.: almoço no restaurante X"
                    value={alimentacaoObs}
                    onChange={(e) => setAlimentacaoObs(e.target.value)}
                  />
                </div>
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
              Salvar alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
