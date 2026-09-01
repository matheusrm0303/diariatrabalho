type StorageLike = {
  storage: {
    from: (b: string) => {
      download: (p: string) => Promise<{ data: Blob | null; error: unknown }>
      createSignedUrl: (
        p: string,
        s: number,
      ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>
    }
  }
}

export type GastoComNota = {
  data: string
  categoria: string
  descricao: string | null
  valor: number | string
  comprovante_path?: string | null
}

function toBase64(bytes: Uint8Array) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

/** Baixa as fotos das notas e devolve os gastos com a imagem em dataURL. */
export async function anexarFotosGastos(
  client: StorageLike,
  gastos: GastoComNota[],
  limite = 25,
) {
  let usados = 0
  return await Promise.all(
    gastos.map(async (g) => {
      if (!g.comprovante_path || usados >= limite) return { ...g, imagem: null }
      usados++
      try {
        const { data, error } = await client.storage.from('recibos').download(g.comprovante_path)
        if (error || !data) return { ...g, imagem: null }
        const buf = new Uint8Array(await data.arrayBuffer())
        return { ...g, imagem: `data:image/jpeg;base64,${toBase64(buf)}` }
      } catch (e) {
        console.error('comprovante: download falhou', e)
        return { ...g, imagem: null }
      }
    }),
  )
}

/** Gera links temporários (7 dias) para as fotos das notas. */
export async function assinarFotosGastos(client: StorageLike, gastos: GastoComNota[]) {
  return await Promise.all(
    gastos.map(async (g) => {
      if (!g.comprovante_path) return { ...g, comprovanteUrl: null }
      const { data } = await client.storage
        .from('recibos')
        .createSignedUrl(g.comprovante_path, 60 * 60 * 24 * 7)
      return { ...g, comprovanteUrl: data?.signedUrl ?? null }
    }),
  )
}
