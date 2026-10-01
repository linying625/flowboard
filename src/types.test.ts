import { describe, expect, it } from 'vitest'
import { COLUMNS, isColumnId, isPriority } from './types'

describe('type guards', () => {
  it('accepts every defined column and rejects anything else', () => {
    COLUMNS.forEach((c) => expect(isColumnId(c.id)).toBe(true))
    for (const bad of ['', 'Done', 'archived', null, undefined, 1]) expect(isColumnId(bad)).toBe(false)
  })

  it('accepts the three priorities only', () => {
    for (const p of ['High', 'Medium', 'Low']) expect(isPriority(p)).toBe(true)
    for (const bad of ['high', 'Urgent', '', null]) expect(isPriority(bad)).toBe(false)
  })
})
