export type Coordenadas = { latitude: number; longitude: number };

/** Pede a localização atual do navegador. Rejeita com mensagem amigável em pt-BR. */
export function obterLocalizacaoAtual(): Promise<Coordenadas> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Seu navegador não suporta localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Permissão de localização negada. Libere o acesso no navegador."));
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error("Localização indisponível no momento."));
        } else {
          reject(new Error("Tempo esgotado ao buscar localização."));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

/** Link do Google Maps para as coordenadas. */
export function linkMapa(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

/** Link do Google Maps para um endereço digitado. */
export function linkMapaEndereco(endereco: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}

export type LocalizacaoInfo = {
  endereco?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function coordTxt(v: number) {
  return v.toFixed(5).replace(".", ",");
}

/** Texto mais completo da localização: o endereço digitado, senão as coordenadas. */
export function textoLocalizacao(d: LocalizacaoInfo): string {
  const end = (d.endereco ?? "").trim();
  if (end) return end;
  if (d.latitude != null && d.longitude != null)
    return `${coordTxt(d.latitude)}, ${coordTxt(d.longitude)}`;
  return "";
}

/** Linha pronta para mensagens (WhatsApp), com link do mapa quando há coordenadas. */
export function linhaWhatsAppLocalizacao(d: LocalizacaoInfo): string {
  const texto = textoLocalizacao(d);
  if (!texto) return "";
  const link =
    d.latitude != null && d.longitude != null
      ? linkMapa(d.latitude, d.longitude)
      : "";
  return link ? `📍 ${texto} — ${link}` : `📍 ${texto}`;
}

/** Converte coordenadas em endereço legível (OpenStreetMap). */
export async function buscarEndereco(c: Coordenadas): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=pt-BR&lat=${c.latitude}&lon=${c.longitude}`,
    );
    if (!r.ok) return "";
    const j = await r.json();
    const a = j.address ?? {};
    const rua = a.road || a.pedestrian || a.street || "";
    const partes = [
      [rua, a.house_number].filter(Boolean).join(", "),
      a.suburb || a.neighbourhood || "",
      a.city || a.town || a.village || a.municipality || "",
      a.state_code || a.state || "",
    ].filter(Boolean);
    return partes.length ? partes.join(" - ") : (j.display_name ?? "");
  } catch {
    return "";
  }
}
