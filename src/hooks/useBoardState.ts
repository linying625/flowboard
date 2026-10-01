import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isColumnId, isPriority } from '../types'
import type { Card, CardInput, ColumnId } from '../types'

interface CardRow {
  id: string
  title: string
  assignee: string
  priority: string
  due_date: string
  column_id: string
  position: number
}

function fromRow(row: CardRow): Card | null {
  if (!isPriority(row.priority) || !isColumnId(row.column_id)) return null
  return {
    id: row.id,
    title: row.title,
    assignee: row.assignee,
    priority: row.priority,
    dueDate: row.due_date,
    columnId: row.column_id,
    position: row.position,
  }
}

const byPosition = (a: Card, b: Card) => a.position - b.position

type FetchResult = { cards: Card[]; error: null } | { cards: []; error: string }
type PersistResult = { ok: true; error?: undefined } | { ok: false; error: string }

async function fetchCards(): Promise<FetchResult> {
  const { data, error } = await supabase
    .from('cards')
    .select('id, title, assignee, priority, due_date, column_id, position')
    .order('position', { ascending: true })
  if (error) return { cards: [], error: error.message }
  const cards = (data as CardRow[]).map(fromRow).filter((c): c is Card => c !== null)
  return { cards, error: null }
}

export function useBoardState() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Latest cards, so actions can compute from current state synchronously.
  const cardsRef = useRef<Card[]>([])

  const commit = useCallback((next: Card[]) => {
    cardsRef.current = next
    setCards(next)
  }, [])

  const apply = useCallback(
    (result: FetchResult) => {
      if (result.error) {
        // Log the real reason for developers; show a generic message to the
        // user so database/schema detail (column names, constraints) never
        // leaks into the UI.
        console.error('Could not load cards:', result.error)
        setError('Could not load the board. Please try again.')
      } else {
        commit(result.cards)
      }
      setLoading(false)
    },
    [commit],
  )

  const load = useCallback(async () => apply(await fetchCards()), [apply])

  // The Board is remounted per user (keyed in App), so this runs once per session.
  useEffect(() => {
    let active = true
    fetchCards().then((result) => {
      if (active) apply(result)
    })
    return () => {
      active = false
    }
  }, [apply])

  // Optimistic update: the UI changes immediately. The caller gets the
  // outcome back so modal-driven actions can wait for it before closing;
  // on failure we also report a page-level error and reload server state
  // so the board never silently drifts from the database.
  const persist = useCallback(
    async (write: PromiseLike<{ error: { message: string } | null }>): Promise<PersistResult> => {
      const { error: err } = await write
      if (err) {
        // Same reasoning as `apply`: log the detail, show a generic message.
        console.error('Could not save changes:', err.message)
        const message = 'Could not save your changes. Please try again.'
        setError(message)
        await load()
        return { ok: false, error: message }
      }
      return { ok: true }
    },
    [load],
  )

  const nextPosition = (columnId: ColumnId, excludeId?: string) => {
    const inColumn = cardsRef.current.filter(
      (c) => c.columnId === columnId && c.id !== excludeId,
    )
    return inColumn.length ? Math.max(...inColumn.map((c) => c.position)) + 1 : 1
  }

  const addCard = useCallback(
    (input: CardInput, columnId: ColumnId = 'backlog'): Promise<PersistResult> => {
      const position = nextPosition(columnId)
      const card: Card = { ...input, id: crypto.randomUUID(), columnId, position }
      commit([...cardsRef.current, card])
      return persist(
        supabase.from('cards').insert({
          id: card.id,
          title: card.title,
          assignee: card.assignee,
          priority: card.priority,
          due_date: card.dueDate,
          column_id: card.columnId,
          position: card.position,
        }),
      )
    },
    [commit, persist],
  )

  const updateCard = useCallback(
    (id: string, input: CardInput, columnId: ColumnId): Promise<PersistResult> => {
      const current = cardsRef.current.find((c) => c.id === id)
      const moved = !!current && current.columnId !== columnId
      const position = moved ? nextPosition(columnId, id) : current?.position ?? 0

      commit(
        cardsRef.current.map((c) =>
          c.id === id ? { ...c, ...input, columnId, position } : c,
        ),
      )
      return persist(
        supabase
          .from('cards')
          .update({
            title: input.title,
            assignee: input.assignee,
            priority: input.priority,
            due_date: input.dueDate,
            column_id: columnId,
            position,
          })
          .eq('id', id),
      )
    },
    [commit, persist],
  )

  const deleteCard = useCallback(
    (id: string): Promise<PersistResult> => {
      commit(cardsRef.current.filter((c) => c.id !== id))
      return persist(supabase.from('cards').delete().eq('id', id))
    },
    [commit, persist],
  )

  const moveCard = useCallback(
    (id: string, toColumnId: ColumnId, beforeCardId?: string) => {
      const moving = cardsRef.current.find((c) => c.id === id)
      if (!moving || id === beforeCardId) return

      const target = cardsRef.current
        .filter((c) => c.columnId === toColumnId && c.id !== id)
        .sort(byPosition)
      const beforeIndex = beforeCardId ? target.findIndex((c) => c.id === beforeCardId) : -1

      let position: number
      if (beforeIndex === -1) {
        position = target.length ? target[target.length - 1].position + 1 : 1
      } else if (beforeIndex === 0) {
        position = target[0].position - 1
      } else {
        position = (target[beforeIndex - 1].position + target[beforeIndex].position) / 2
      }

      commit(
        cardsRef.current.map((c) =>
          c.id === id ? { ...c, columnId: toColumnId, position } : c,
        ),
      )
      persist(
        supabase
          .from('cards')
          .update({ column_id: toColumnId, position })
          .eq('id', id),
      )
    },
    [commit, persist],
  )

  const sorted = useMemo(() => [...cards].sort(byPosition), [cards])
  const clearError = useCallback(() => setError(null), [])

  return {
    cards: sorted,
    loading,
    error,
    clearError,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
  }
}
