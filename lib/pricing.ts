// Total do pedido: a partir de `minPack` fotos, todas saem pelo preço do pacote.
// Arredonda para centavos (ex.: 3 x 8.10 em JavaScript dá 24.299999...).
export function calcTotal(qtd: number, unit: number, pack: number, minPack: number) {
  const total = qtd >= minPack ? qtd * pack : qtd * unit
  return Math.round(total * 100) / 100
}
