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
}

export function ChartsResumo({ diarias, resumoPorMes }: Props) {
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
    // Mês mais recente
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

  const tooltipFmt = (v: number) => fmt.format(v);

  return (
    <div className="grid gap-4 mb-6">
      {ganhosPorMes.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Ganhos por mês</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ganhosPorMes}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="nome" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={tooltipFmt} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Pago" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pendente" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {statusData.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Distribuição por status</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => entry.name}
                >
                  {statusData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.name === "Pago" ? "#059669" : "#2563eb"}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={tooltipFmt} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {evolucaoDiaria.length > 1 && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-1">Evolução diária</p>
          <p className="text-xs text-muted-foreground mb-3">
            Mês mais recente
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoDiaria}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={tooltipFmt} labelFormatter={(l) => `Dia ${l}`} />
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

export function ChartComparativoMensal({ resumoPorMes }: { resumoPorMes: MesData[] }) {
  const mounted = useMounted();

  const data = useMemo(
    () =>
      [...resumoPorMes]
        .sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes))
        .map((m) => ({
          nome: `${nomesMes[m.mes - 1]}/${String(m.ano).slice(2)}`,
          Pago: Math.round(m.totalPago),
          Pendente: Math.round(m.totalPendente),
          Total: Math.round(m.totalPago + m.totalPendente),
        })),
    [resumoPorMes],
  );

  if (!mounted || data.length === 0) return null;

  return (
    <Card className="p-4 mb-6">
      <p className="text-sm font-medium mb-3">Comparativo mensal</p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="nome" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: number) => fmt.format(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Pago" stackId="a" fill="#059669" />
            <Bar dataKey="Pendente" stackId="a" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
