import { useEffect, useMemo, useState } from "react";
import { Calculator, ChevronDown, Copy, Minus, Plus, TriangleAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fmt, todayISO, type Diaria } from "@/lib/diarias-store";
import { useMyDefaults } from "@/lib/admin";
import {
  SIMULACAO_VAZIA,
  VALORES_PADRAO,
  diasUteisNoMes,
  diasUteisRestantes,
  moverMes,
  rotuloMes,
  simular,
  type Simulacao,
} from "@/lib/simulador";

const KEY = "simulacao";
const pad = (n: number) => String(n).padStart(2, "0");
const mesDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const keyFor = (userId: string | null) => (userId ? `${KEY}:${userId}` : `${KEY}:guest`);

type Salvo = { sim: Simulacao; mes: string; aberto: boolean };

const n = (v: unknown, min = 0) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, v) : min;

function lerSalvo(userId: string | null): Salvo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Salvo>;
    if (!p || typeof p !== "object" || !p.sim || !/^\d{4}-\d{2}$/.test(String(p.mes))) return null;
    return {
      sim: {
        rua: n(p.sim.rua),
        deposito: n(p.sim.deposito),
        personalizadas: n(p.sim.personalizadas),
        valorPersonalizado: n(p.sim.valorPersonalizado),
        alimentacao: n(p.sim.alimentacao),
      },
      mes: String(p.mes),
      aberto: p.aberto !== false,
    };
  } catch {
    return null;
  }
}

function Passo({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-muted/30 p-2.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-xs font-semibold">
          {label}
        </Label>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Diminuir ${label}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="h-8 w-14 min-w-0 rounded-lg px-1 text-center text-sm font-semibold"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => onChange(value + 1)}
          aria-label={`Aumentar ${label}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SimuladorCard({ diarias, embutido = false }: { diarias: Diaria[]; embutido?: boolean }) {
  const defaults = useMyDefaults();
  const valores = useMemo(() => defaults ?? VALORES_PADRAO, [defaults]);

  const hojeIso = todayISO();
  const [userId, setUserId] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [mes, setMes] = useState(() => mesDe(new Date()));
  const [sim, setSim] = useState<Simulacao>(SIMULACAO_VAZIA);
  const [aberto, setAberto] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      const id = data.user?.id ?? null;
      setUserId(id);
      const salvo = lerSalvo(id);
      if (salvo) {
        setSim(salvo.sim);
        setMes(salvo.mes);
        setAberto(salvo.aberto);
      }
      setPronto(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!pronto || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(keyFor(userId), JSON.stringify({ sim, mes, aberto }));
    } catch {
      /* armazenamento cheio: a simulação continua funcionando sem salvar */
    }
  }, [sim, mes, aberto, userId, pronto]);

  const res = useMemo(() => simular(sim, valores), [sim, valores]);
  const diasUteis = diasUteisNoMes(mes);
  const restantes = diasUteisRestantes(mes, hojeIso);
  const excede = res.dias > restantes;

  const registrado = useMemo(() => {
    let soma = 0;
    for (const d of diarias) if (d.data.startsWith(mes)) soma += d.valor + (d.alimentacao || 0);
    return soma;
  }, [diarias, mes]);

  function mudar<K extends keyof Simulacao>(campo: K, valor: Simulacao[K]) {
    setSim((s) => ({ ...s, [campo]: valor }));
  }

  function copiar() {
    const linhas = [
      `Simulação — ${rotuloMes(mes)}`,
      `Diárias de rua: ${sim.rua} x ${fmt.format(valores.valor_rua)} = ${fmt.format(res.rua)}`,
      `Diárias de depósito: ${sim.deposito} x ${fmt.format(valores.valor_deposito)} = ${fmt.format(res.deposito)}`,
      `Personalizadas: ${sim.personalizadas} x ${fmt.format(sim.valorPersonalizado)} = ${fmt.format(res.personalizadas)}`,
      `Alimentação: ${res.dias} x ${fmt.format(sim.alimentacao)} = ${fmt.format(res.alimentacao)}`,
      `Total simulado: ${fmt.format(res.total)}`,
      `Média por dia: ${fmt.format(res.mediaPorDia)}`,
      `Previsto no mês: ${fmt.format(registrado + res.total)}`,
    ];
    navigator.clipboard
      .writeText(linhas.join("\n"))
      .then(() => toast.success("Resumo copiado!"))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  const mostrar = embutido || aberto;

  return (
    <Card className={cn("min-w-0 overflow-hidden rounded-3xl border-transparent p-0 shadow-sm", embutido ? "shadow-none pt-1" : "mb-6")}>
      {!embutido && <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-3 text-left sm:p-4"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Calculator className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-sm font-bold">Simular dias futuros</span>
          <span className="block truncate text-xs text-muted-foreground">
            {res.dias > 0
              ? `${res.dias} dia${res.dias === 1 ? "" : "s"} · ${fmt.format(res.total)}`
              : "Veja quanto você ganha trabalhando mais dias"}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </button>}

      {mostrar && (
        <div className="space-y-3 px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-2 py-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMes((m) => moverMes(m, -1))} aria-label="Mês anterior">
              <ChevronDown className="h-4 w-4 rotate-90" />
            </Button>
            <div className="min-w-0 text-center">
              <p className="truncate font-display text-sm font-bold capitalize">{rotuloMes(mes)}</p>
              <p className="text-[11px] text-muted-foreground">
                {diasUteis} dias úteis · {restantes} ainda pela frente
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMes((m) => moverMes(m, 1))} aria-label="Próximo mês">
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </Button>
          </div>

          <div className="grid gap-2">
            <Passo
              id="sim-rua"
              label="Dias de rua"
              hint={`${fmt.format(valores.valor_rua)} por dia`}
              value={sim.rua}
              onChange={(v) => mudar("rua", v)}
            />
            <Passo
              id="sim-deposito"
              label="Dias de depósito"
              hint={`${fmt.format(valores.valor_deposito)} por dia`}
              value={sim.deposito}
              onChange={(v) => mudar("deposito", v)}
            />
            <Passo
              id="sim-personalizadas"
              label="Dias personalizados"
              hint="Use o valor que combinou"
              value={sim.personalizadas}
              onChange={(v) => mudar("personalizadas", v)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="sim-valor" className="text-xs">
                Valor personalizado (R$)
              </Label>
              <Input
                id="sim-valor"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={sim.valorPersonalizado}
                onChange={(e) => mudar("valorPersonalizado", Math.max(0, Number(e.target.value) || 0))}
                className="h-9 min-w-0"
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="sim-alim" className="text-xs">
                Alimentação por dia (R$)
              </Label>
              <Input
                id="sim-alim"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={sim.alimentacao}
                onChange={(e) => mudar("alimentacao", Math.max(0, Number(e.target.value) || 0))}
                className="h-9 min-w-0"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={restantes === 0}
              onClick={() => mudar("rua", restantes)}
            >
              Preencher os {restantes} dias úteis que faltam
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-8 flex-1 text-xs" onClick={copiar}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar resumo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 flex-1 text-xs text-muted-foreground"
                onClick={() => setSim(SIMULACAO_VAZIA)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Limpar
              </Button>
            </div>
          </div>

          <div className="rounded-2xl bg-primary/10 p-3">
            <div className="flex items-end justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total simulado
              </p>
              <p className="font-display text-2xl font-bold text-primary">{fmt.format(res.total)}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-lg bg-background/70 px-2 py-0.5">{res.dias} dias</span>
              <span className="rounded-lg bg-background/70 px-2 py-0.5">média {fmt.format(res.mediaPorDia)}/dia</span>
              {res.rua > 0 && <span className="rounded-lg bg-background/70 px-2 py-0.5">rua {fmt.format(res.rua)}</span>}
              {res.deposito > 0 && <span className="rounded-lg bg-background/70 px-2 py-0.5">depósito {fmt.format(res.deposito)}</span>}
              {res.personalizadas > 0 && (
                <span className="rounded-lg bg-background/70 px-2 py-0.5">pers. {fmt.format(res.personalizadas)}</span>
              )}
              {res.alimentacao > 0 && (
                <span className="rounded-lg bg-background/70 px-2 py-0.5">alimentação {fmt.format(res.alimentacao)}</span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {registrado > 0
                ? `${rotuloMes(mes)} já tem ${fmt.format(registrado)} · previsto ${fmt.format(registrado + res.total)}`
                : `Previsto para ${rotuloMes(mes)}: ${fmt.format(res.total)}`}
            </p>
            {excede && (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {res.dias} dias é mais que os {restantes} dias úteis que faltam em {rotuloMes(mes)}.
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
