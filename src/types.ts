export type ColumnId = 'backlog' | 'in-progress' | 'in-review' | 'done'

export type Priority = 'High' | 'Medium' | 'Low'

export interface Card {
  id: string
  title: string
  assignee: string
  priority: Priority
  /** ISO date, YYYY-MM-DD */
  dueDate: string
  columnId: ColumnId
  /** Sort order within a column (ascending). */
  position: number
}

export type CardInput = Omit<Card, 'id' | 'columnId' | 'position'>

export const COLUMNS: ReadonlyArray<{ id: ColumnId; label: string }> = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'in-review', label: 'In Review' },
  { id: 'done', label: 'Done' },
]

export const PRIORITIES: ReadonlyArray<Priority> = ['High', 'Medium', 'Low']

export function isColumnId(value: unknown): value is ColumnId {
  return COLUMNS.some((c) => c.id === value)
}

export function isPriority(value: unknown): value is Priority {
  return PRIORITIES.some((p) => p === value)
}
