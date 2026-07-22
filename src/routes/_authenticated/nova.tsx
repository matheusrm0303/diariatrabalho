import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, X } from "lucide-react";
import { useDiarias, todayISO, fmt, type Tipo, type Status } from "@/lib/diarias-store";
import { useMyDefaults } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/nova")({
  head: () => ({
    meta: [
      { title: "Nova diária" },
      { name: "description", content: "Cadastre uma nova diária." },
    ],
  }),
  component: Nova,
});

function Nova() {
  const navigate = useNavigate();
  const { adicionar } = useDiarias();
  const defaults = useMyDefaults();

  const valorRua = defaults?.valor_rua ?? 200;
  const valorDep = defaults?.valor_deposito ?? 100;

  const PRESETS: { tipo: Tipo; label: string; valor: number }[] = [
    { tipo: "rua-200", label: `Rua ${fmt.format(valorRua)}`, valor: valorRua },
    { tipo: "deposito-100", label: `Depósito ${fmt.format(valorDep)}`, valor: valorDep },
    { tipo: "personalizada", label: "Personalizada", valor: 0 },
  ];

  const [tipo, setTipo] = useState<Tipo>("rua-200");
  const [valor, setValor] = useState<string>(String(valorRua));
  const [local, setLocal] = useState("");
  const [data, setData] = useState(todayISO());
  const [dias, setDias] = useState<string[]>([todayISO()]);
  const [status, setStatus] = useState<Status>("pendente");
  const [incluiAlim, setIncluiAlim] = useState(false);
  const [alimentacao, setAlimentacao] = useState("");
  const [alimentacaoObs, setAlimentacaoObs] = useState("");

  // When defaults load, refresh preset value if user hasn't chosen custom
  useEffect(() => {
    if (!defaults) return;
    if (tipo === "rua-200") setValor(String(defaults.valor_rua));
    else if (tipo === "deposito-100") setValor(String(defaults.valor_deposito));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults]);

  function selecionarTipo(p: (typeof PRESETS)[number]) {
    setTipo(p.tipo);
    if (p.tipo !== "personalizada") setValor(String(p.valor));
    else setValor("");
  }

  function parseNum(v: string) {
    return parseFloat(v.replace(",", ".")) || 0;
  }

  function adicionarDia() {
    if (!data) return;
    setDias((prev) => (prev.includes(data) ? prev : [...prev, data].sort()));
  }

  function removerDia(d: string) {
    setDias((prev) => prev.filter((x) => x !== d));
  }

  function formatarDia(iso: string) {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseNum(valor);
    if (!local.trim() || v <= 0 || dias.length === 0) return;
    const descricao = PRESETS.find((p) => p.tipo === tipo)?.label || "Diária";
    const alim = incluiAlim ? parseNum(alimentacao) : 0;
    const alimObs = incluiAlim ? alimentacaoObs.trim() : "";
    for (const dia of dias) {
      await adicionar({
        data: dia,
        local: local.trim(),
        descricao,
        valor: v,
        tipo,
        status,
        alimentacao: alim,
        alimentacaoObs: alimObs,
      });
    }
    navigate({ to: "/" });
  }

  const totalPorDia = parseNum(valor) + (incluiAlim ? parseNum(alimentacao) : 0);
  const totalGeral = totalPorDia * dias.length;

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
              <Label htmlFor="data">Dias</Label>
              <div className="flex gap-2">
                <Input
                  id="data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={adicionarDia}
                  disabled={!data || dias.includes(data)}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              {dias.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Selecione ao menos um dia. Cada dia é lançado como uma diária separada.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {dias.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-full border border-input bg-accent/40 px-2.5 py-1 text-xs"
                    >
                      {formatarDia(d)}
                      <button
                        type="button"
                        onClick={() => removerDia(d)}
                        className="rounded-full p-0.5 hover:bg-accent"
                        aria-label={`Remover ${formatarDia(d)}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {dias.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Serão lançadas {dias.length} diárias separadas.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["pendente", "pago"] as Status[]).map((s) => {
                  const active = status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={
                        "rounded-md border px-3 py-2 text-sm transition-colors capitalize " +
                        (active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent")
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
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
            {tipo === "personalizada" && (
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
            )}
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

          <Card className="p-4 grid gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total por dia</span>
              <span className="text-base font-medium">{fmt.format(totalPorDia)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total geral ({dias.length} {dias.length === 1 ? "dia" : "dias"})
              </span>
              <span className="text-lg font-semibold">{fmt.format(totalGeral)}</span>
            </div>
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
