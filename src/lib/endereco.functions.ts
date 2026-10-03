import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function credenciais() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) throw new Error("Google Maps não está conectado ao app.");
  return { lovable, maps };
}

async function tratarErro(res: Response): Promise<never> {
  const body = await res.text();
  console.error(`Google Maps falhou [${res.status}]: ${body}`);
  if (res.status === 403) {
    throw new Error(
      "A chave do Google Maps não permite esta consulta. Verifique as permissões da chave no Google Cloud."
    );
  }
  throw new Error(`Consulta ao Google Maps falhou (${res.status}).`);
}

export type SugestaoEndereco = { placeId: string; texto: string };

export const sugerirEnderecos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { texto: string; sessionToken: string }) => {
    const texto = (data?.texto ?? "").trim();
    if (texto.length < 3) throw new Error("Digite ao menos 3 letras.");
    if (texto.length > 200) throw new Error("Texto muito longo.");
    if (!data?.sessionToken) throw new Error("Sessão inválida.");
    return { texto, sessionToken: data.sessionToken };
  })
  .handler(async ({ data }): Promise<SugestaoEndereco[]> => {
    const { lovable, maps } = credenciais();
    const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": maps,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({
        input: data.texto,
        sessionToken: data.sessionToken,
        includedRegionCodes: ["br"],
        languageCode: "pt-BR",
      }),
    });
    if (!res.ok) await tratarErro(res);
    const json = (await res.json()) as {
      suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[];
    };
    return (json.suggestions ?? [])
      .map((s) => ({
        placeId: s.placePrediction?.placeId ?? "",
        texto: s.placePrediction?.text?.text ?? "",
      }))
      .filter((s) => s.placeId && s.texto)
      .slice(0, 6);
  });

export type DetalheEndereco = {
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  nome: string | null;
};

export const detalhesEndereco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { placeId: string; sessionToken: string }) => {
    if (!data?.placeId) throw new Error("Endereço inválido.");
    return { placeId: data.placeId, sessionToken: data.sessionToken ?? "" };
  })
  .handler(async ({ data }): Promise<DetalheEndereco> => {
    const { lovable, maps } = credenciais();
    const url = `${GATEWAY_URL}/places/v1/places/${encodeURIComponent(data.placeId)}?sessionToken=${encodeURIComponent(data.sessionToken)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": maps,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
      },
    });
    if (!res.ok) await tratarErro(res);
    const json = (await res.json()) as {
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
    };
    return {
      endereco: json.formattedAddress ?? "",
      latitude: json.location?.latitude ?? null,
      longitude: json.location?.longitude ?? null,
      nome: json.displayName?.text ?? null,
    };
  });
