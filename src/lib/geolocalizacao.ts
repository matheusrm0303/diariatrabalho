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
