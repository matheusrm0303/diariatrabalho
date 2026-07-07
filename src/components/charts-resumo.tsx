import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import html2canvas from "html2canvas-pro";
import { Card } from "@/components/ui/card";
import { fmt, type Diaria } from "@/lib/diarias-store";

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

const nomesMes = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const brl = (v: number) => fmt.format(v);
const shortMoney = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(v);
};

interface MesData {
  ano: number;
  mes: number;
  label: string;
  totalPago: number;
  totalPendente: number;
}

interface Props {
  diarias: Diaria[];
  resumoPorMes: MesData[];
  scope?: string;
}

export function ChartsResumo({ diarias, resumoPorMes, scope = "resumo" }: Props) {
  const mounted = useMounted();

  const ganhosPorMes = useMemo(
    () =>
      [...resumoPorMes]
        .sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes))
        .map((m) => ({
          nome: `${nomesMes[m.mes - 1]}/${String(m.ano).slice(2)}`,
          Pago: Math.round(m.totalPago),
          Pendente: Math.round(m.totalPendente),
        })),
    [resumoPorMes],
  );

  const statusData = useMemo(() => {
    let pago = 0;
    let pendente = 0;
    for (const d of diarias) {
      const total = d.valor + (d.alimentacao || 0);
      if (d.status === "pago") pago += total;
      else pendente += total;
    }
    return [
      { name: "Pago", value: Math.round(pago) },
      { name: "Pendente", value: Math.round(pendente) },
    ].filter((x) => x.value > 0);
  }, [diarias]);

  const evolucaoDiaria = useMemo(() => {
    if (diarias.length === 0) return [];
    const ordenadas = [...diarias].sort((a, b) => (a.data < b.data ? 1 : -1));
    const [ano, mes] = ordenadas[0].data.split("-");
    const filtro = diarias.filter((d) => d.data.startsWith(`${ano}-${mes}`));
    const map = new Map<string, number>();
    for (const d of filtro) {
      const dia = d.data.split("-")[2];
      map.set(dia, (map.get(dia) || 0) + d.valor + (d.alimentacao || 0));
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, valor]) => ({ dia, valor: Math.round(valor) }));
  }, [diarias]);

  if (!mounted || diarias.length === 0) return null;

  const barChartHeight = ganhosPorMes.length > 6 ? 260 : 220;

  return (
    <div className="grid gap-4 mb-6">
      {ganhosPorMes.length > 0 && (
        <Card className="p-3 sm:p-4" data-chart-export={scope}>
          <p className="text-sm font-medium mb-3">Ganhos por mês</p>
          <div style={{ width: "100%", height: barChartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ganhosPorMes}
                margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="nome"
                  fontSize={10}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={50}
                />
                <YAxis fontSize={10} tickFormatter={shortMoney} width={44} />
                <Tooltip formatter={brl} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Pago" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pendente" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {statusData.length > 0 && (
        <Card className="p-3 sm:p-4" data-chart-export={scope}>
          <p className="text-sm font-medium mb-3">Distribuição por status</p>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="70%"
                  label={(entry) => entry.name}
                >
                  {statusData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.name === "Pago" ? "#059669" : "#2563eb"}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={brl} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {evolucaoDiaria.length > 1 && (
        <Card className="p-3 sm:p-4" data-chart-export={scope}>
          <p className="text-sm font-medium mb-1">Evolução diária</p>
          <p className="text-xs text-muted-foreground mb-3">Mês mais recente</p>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={evolucaoDiaria}
                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="dia" fontSize={10} interval="preserveStartEnd" />
                <YAxis fontSize={10} tickFormatter={shortMoney} width={44} />
                <Tooltip formatter={brl} labelFormatter={(l) => `Dia ${l}`} />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

export function ChartComparativoMensal({
  resumoPorMes,
  scope = "fechamento",
}: {
  resumoPorMes: MesData[];
  scope?: string;
}) {
  const mounted = useMounted();

  const data = useMemo(
    () =>
      [...resumoPorMes]
        .sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes))
        .map((m) => ({
          nome: `${nomesMes[m.mes - 1]}/${String(m.ano).slice(2)}`,
          Pago: Math.round(m.totalPago),
          Pendente: Math.round(m.totalPendente),
        })),
    [resumoPorMes],
  );

  if (!mounted || data.length === 0) return null;

  const height = data.length > 6 ? 280 : 240;

  return (
    <Card className="p-3 sm:p-4 mb-6" data-chart-export={scope}>
      <p className="text-sm font-medium mb-3">Comparativo mensal</p>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="nome"
              fontSize={10}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={50}
            />
            <YAxis fontSize={10} tickFormatter={shortMoney} width={44} />
            <Tooltip formatter={brl} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Pago" stackId="a" fill="#059669" />
            <Bar dataKey="Pendente" stackId="a" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// -------- Period filter --------

export type PeriodoKey = "todos" | "este_mes" | "ultimos_3" | "ultimos_6" | "este_ano";

export const periodoOptions: { value: PeriodoKey; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "este_mes", label: "Este mês" },
  { value: "ultimos_3", label: "Últimos 3 meses" },
  { value: "ultimos_6", label: "Últimos 6 meses" },
  { value: "este_ano", label: "Este ano" },
];

export function filtrarPorPeriodo<T extends { data: string }>(
  itens: T[],
  periodo: PeriodoKey,
): T[] {
  if (periodo === "todos") return itens;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();

  let inicio: Date;
  if (periodo === "este_mes") inicio = new Date(ano, mes, 1);
  else if (periodo === "ultimos_3") inicio = new Date(ano, mes - 2, 1);
  else if (periodo === "ultimos_6") inicio = new Date(ano, mes - 5, 1);
  else inicio = new Date(ano, 0, 1);

  const iso = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-${String(inicio.getDate()).padStart(2, "0")}`;
  return itens.filter((i) => i.data >= iso);
}

// -------- PDF chart capture --------

export async function capturarGraficosParaPDF(scope: string): Promise<string[]> {
  if (typeof document === "undefined") return [];
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-chart-export="${scope}"]`),
  );
  const imgs: string[] = [];
  for (const node of nodes) {
    try {
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      imgs.push(canvas.toDataURL("image/png"));
    } catch (e) {
      console.warn("Falha ao capturar gráfico", e);
    }
  }
  return imgs;
}
