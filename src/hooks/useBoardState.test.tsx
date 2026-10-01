import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDb, row } from '../test/supabaseMock'
import { useBoardState } from './useBoardState'

vi.mock('../lib/supabase', async () => await import('../test/supabaseMock'))

const input = { title: 'New', assignee: 'Bo', priority: 'High' as const, dueDate: '2099-02-02' }

async function setup(rows: Array<Record<string, unknown>> = []) {
  mockDb.rows = rows
  const hook = renderHook(() => useBoardState())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

const ids = (cards: Array<{ id: string }>) => cards.map((c) => c.id)

let consoleError: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  mockDb.reset()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => consoleError.mockRestore())

describe('loading', () => {
  it('maps rows to cards, sorted by position', async () => {
    const { result } = await setup([
      row({ id: 'b', position: 2, due_date: '2099-05-05' }),
      row({ id: 'a', position: 1 }),
    ])
    expect(ids(result.current.cards)).toEqual(['a', 'b'])
    expect(result.current.cards[1]).toMatchObject({ dueDate: '2099-05-05', columnId: 'backlog' })
  })

  it('drops rows with an unknown priority or column instead of crashing', async () => {
    const { result } = await setup([
      row({ id: 'ok' }),
      row({ id: 'bad-priority', priority: 'Urgent' }),
      row({ id: 'bad-column', column_id: 'archived' }),
    ])
    expect(ids(result.current.cards)).toEqual(['ok'])
  })
})

describe('creating', () => {
  it('adds optimistically to the backlog and inserts a snake_case row', async () => {
    const { result } = await setup([row({ id: 'a', position: 4 })])
    let res!: Awaited<ReturnType<typeof result.current.addCard>>
    await act(async () => {
      res = await result.current.addCard(input)
    })
    expect(res.ok).toBe(true)
    const added = result.current.cards.find((c) => c.id !== 'a')!
    expect(added).toMatchObject({ ...input, columnId: 'backlog', position: 5 })
    expect(mockDb.writes()).toHaveLength(1)
    expect(mockDb.writes()[0]).toMatchObject({
      table: 'cards',
      op: 'insert',
      payload: { id: added.id, title: 'New', due_date: '2099-02-02', column_id: 'backlog', position: 5 },
    })
  })

  it('puts the card in the requested column, starting at position 1', async () => {
    const { result } = await setup()
    await act(async () => {
      await result.current.addCard(input, 'done')
    })
    expect(result.current.cards[0]).toMatchObject({ columnId: 'done', position: 1 })
  })
})

describe('editing', () => {
  it('updates fields in place and keeps position when the column is unchanged', async () => {
    const { result } = await setup([row({ id: 'a', position: 3 })])
    await act(async () => {
      await result.current.updateCard('a', input, 'backlog')
    })
    expect(result.current.cards[0]).toMatchObject({ id: 'a', ...input, position: 3 })
    expect(mockDb.writes()[0]).toMatchObject({
      op: 'update',
      filters: [['id', 'a']],
      payload: { title: 'New', priority: 'High', column_id: 'backlog', position: 3 },
    })
  })

  it('moves to the end of the new column when the column changes', async () => {
    const { result } = await setup([
      row({ id: 'a', column_id: 'backlog', position: 1 }),
      row({ id: 'b', column_id: 'done', position: 7 }),
    ])
    await act(async () => {
      await result.current.updateCard('a', input, 'done')
    })
    expect(result.current.cards.find((c) => c.id === 'a')).toMatchObject({
      columnId: 'done',
      position: 8,
    })
  })
})

describe('deleting', () => {
  it('removes the card immediately and deletes by id', async () => {
    const { result } = await setup([row({ id: 'a' }), row({ id: 'b', position: 2 })])
    await act(async () => {
      await result.current.deleteCard('a')
    })
    expect(ids(result.current.cards)).toEqual(['b'])
    expect(mockDb.writes()[0]).toMatchObject({ op: 'delete', filters: [['id', 'a']] })
  })
})

describe('moving', () => {
  const rows = () => [
    row({ id: 'a', column_id: 'backlog', position: 1 }),
    row({ id: 'x', column_id: 'done', position: 1 }),
    row({ id: 'y', column_id: 'done', position: 2 }),
  ]
  const inColumn = (cards: ReturnType<typeof useBoardState>['cards'], col: string) =>
    ids(cards.filter((c) => c.columnId === col))

  async function move(...args: Parameters<ReturnType<typeof useBoardState>['moveCard']>) {
    const hook = await setup(rows())
    await act(async () => {
      hook.result.current.moveCard(...args)
    })
    return hook
  }

  it('appends when dropped on the column itself', async () => {
    const { result } = await move('a', 'done')
    expect(inColumn(result.current.cards, 'done')).toEqual(['x', 'y', 'a'])
    expect(mockDb.writes()[0]).toMatchObject({
      op: 'update',
      payload: { column_id: 'done', position: 3 },
    })
  })

  it('inserts before the first card', async () => {
    const { result } = await move('a', 'done', 'x')
    expect(inColumn(result.current.cards, 'done')).toEqual(['a', 'x', 'y'])
  })

  it('inserts between two cards using the midpoint position', async () => {
    const { result } = await move('a', 'done', 'y')
    expect(inColumn(result.current.cards, 'done')).toEqual(['x', 'a', 'y'])
    expect(result.current.cards.find((c) => c.id === 'a')!.position).toBe(1.5)
  })

  it('reorders within the same column', async () => {
    const { result } = await move('y', 'done', 'x')
    expect(inColumn(result.current.cards, 'done')).toEqual(['y', 'x'])
  })

  it('is a no-op when dropped onto itself or when the card is unknown', async () => {
    await move('x', 'done', 'x')
    expect(mockDb.writes()).toHaveLength(0)
    await move('ghost', 'done')
    expect(mockDb.writes()).toHaveLength(0)
  })
})

// Regression: audit fixes around error handling.
describe('regression: error handling', () => {
  it('shows a generic message when loading fails and never leaks DB detail', async () => {
    mockDb.errors.select = 'column "due_date" does not exist'
    const { result } = await setup()
    expect(result.current.error).toBe('Could not load the board. Please try again.')
    expect(result.current.error).not.toMatch(/due_date|column/)
    expect(consoleError).toHaveBeenCalledWith('Could not load cards:', 'column "due_date" does not exist')
  })

  it('on a failed write: reports ok:false, shows a generic error and reloads server state', async () => {
    const { result } = await setup([row({ id: 'a' })])
    mockDb.errors.insert = 'violates check constraint "cards_priority_check"'
    let res!: Awaited<ReturnType<typeof result.current.addCard>>
    await act(async () => {
      res = await result.current.addCard(input)
    })
    expect(res).toEqual({ ok: false, error: 'Could not save your changes. Please try again.' })
    expect(result.current.error).toBe(res.error)
    expect(result.current.error).not.toMatch(/constraint|priority_check/)
    // Optimistic card is rolled back by the reload (server still only has 'a').
    expect(ids(result.current.cards)).toEqual(['a'])
    expect(mockDb.calls.filter((c) => c.op === 'select')).toHaveLength(2)
  })

  it('clearError dismisses the error', async () => {
    mockDb.errors.select = 'boom'
    const { result } = await setup()
    act(() => result.current.clearError())
    expect(result.current.error).toBeNull()
  })
})
