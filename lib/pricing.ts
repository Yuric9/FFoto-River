export function calcTotal(qtd: number, unit: number, pack: number, minPack: number) {
  if (qtd >= minPack) return qtd * pack
  return qtd * unit
}
