import { describe, it, expect } from 'vitest'
import { calcTotal } from '@/lib/pricing'

describe('calcTotal', () => {
  it('abaixo do mínimo do pacote usa o preço unitário', () => {
    expect(calcTotal(3, 10, 8, 10)).toBe(30)
  })

  it('a partir do mínimo, todas as fotos saem pelo preço do pacote', () => {
    expect(calcTotal(10, 10, 8, 10)).toBe(80)
    expect(calcTotal(12, 10, 8, 10)).toBe(96)
  })

  it('arredonda para centavos (3 x 8.10 não vira 24.299999...)', () => {
    expect(calcTotal(3, 8.1, 8.1, 10)).toBe(24.3)
  })
})
