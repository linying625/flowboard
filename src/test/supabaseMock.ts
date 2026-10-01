// In-memory stand-in for `src/lib/supabase`. Tests import `mockDb` to seed rows,
// force failures and inspect the writes the app attempted.
import { vi } from 'vitest'

type Op = 'select' | 'insert' | 'update' | 'delete'

export interface Call {
  table: string
  op: Op
  payload?: unknown
  filters: Array<[string, unknown]>
}

export const mockDb = {
  rows: [] as Array<Record<string, unknown>>,
  /** Message to fail each operation with; undefined means it succeeds. */
  errors: {} as Partial<Record<Op, string>>,
  calls: [] as Call[],
  reset() {
    this.rows = []
    this.errors = {}
    this.calls = []
  },
  writes() {
    return this.calls.filter((c) => c.op !== 'select')
  },
}

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] }
  const b = {
    select: () => b,
    order: () => b,
    insert: (payload: unknown) => ((call.op = 'insert'), (call.payload = payload), b),
    update: (payload: unknown) => ((call.op = 'update'), (call.payload = payload), b),
    delete: () => ((call.op = 'delete'), b),
    eq: (col: string, val: unknown) => (call.filters.push([col, val]), b),
    // Awaiting the builder runs the "query", like the real client.
    then(resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) {
      mockDb.calls.push(call)
      const message = mockDb.errors[call.op]
      const result = message
        ? { data: null, error: { message } }
        : { data: call.op === 'select' ? structuredClone(mockDb.rows) : null, error: null }
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  return b
}

export const supabase = {
  from: vi.fn((table: string) => builder(table)),
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  },
}

export function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c1',
    title: 'Card',
    assignee: 'Ana',
    priority: 'Medium',
    due_date: '2099-01-01',
    column_id: 'backlog',
    position: 1,
    ...over,
  }
}
