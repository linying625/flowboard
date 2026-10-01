import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDb, row } from '../test/supabaseMock'
import { Board } from './Board'

vi.mock('../lib/supabase', async () => await import('../test/supabaseMock'))

const column = (name: string) => screen.getByRole('region', { name })

async function renderBoard(rows: Array<Record<string, unknown>> = []) {
  mockDb.rows = rows
  const onSignOut = vi.fn()
  render(<Board email="ana@example.com" onSignOut={onSignOut} />)
  await screen.findByRole('heading', { name: 'Backlog' })
  return { onSignOut }
}

async function fillAndSave(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.type(screen.getByLabelText('Title'), title)
  await user.type(screen.getByLabelText('Assignee'), 'Bo')
  fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2099-03-03' } })
  await user.click(screen.getByRole('button', { name: 'Save' }))
}

beforeEach(() => {
  mockDb.reset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('board', () => {
  it('renders cards in their columns with counts', async () => {
    await renderBoard([
      row({ id: 'a', title: 'Write docs' }),
      row({ id: 'b', title: 'Ship it', column_id: 'done', position: 1 }),
    ])
    expect(within(column('Backlog')).getByText('Write docs')).toBeInTheDocument()
    expect(within(column('Done')).getByText('Ship it')).toBeInTheDocument()
    expect(within(column('Backlog')).getByLabelText('1 card')).toBeInTheDocument()
    expect(within(column('In Review')).getByLabelText('0 cards')).toBeInTheDocument()
  })

  it('shows the user and signs out', async () => {
    const { onSignOut } = await renderBoard()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalled()
  })
})

describe('creating a card', () => {
  it('opens from a column, saves, closes and shows the card there', async () => {
    const user = userEvent.setup()
    await renderBoard()
    await user.click(within(column('In Review')).getByRole('button', { name: /Add card/ }))
    expect(screen.getByLabelText('Column')).toHaveValue('in-review')
    await fillAndSave(user, 'Fresh card')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(column('In Review')).getByText('Fresh card')).toBeInTheDocument()
    expect(mockDb.writes()[0]).toMatchObject({
      op: 'insert',
      payload: { title: 'Fresh card', assignee: 'Bo', column_id: 'in-review', priority: 'Medium' },
    })
  })

  it('validates required fields, focuses the first invalid one and does not write', async () => {
    const user = userEvent.setup()
    await renderBoard()
    await user.click(within(column('Backlog')).getByRole('button', { name: /Add card/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(screen.getByText('Assignee is required')).toBeInTheDocument()
    expect(screen.getByText('Due date is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveFocus()
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(mockDb.writes()).toHaveLength(0)
  })

  it('treats whitespace-only values as empty and trims saved values', async () => {
    const user = userEvent.setup()
    await renderBoard()
    await user.click(within(column('Backlog')).getByRole('button', { name: /Add card/ }))
    await user.type(screen.getByLabelText('Title'), '   ')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Title is required')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Title'))
    await fillAndSave(user, '  Padded  ')
    await waitFor(() => expect(mockDb.writes()).toHaveLength(1))
    expect(mockDb.writes()[0].payload).toMatchObject({ title: 'Padded' })
  })
})

describe('editing a card', () => {
  it('prefills the form, saves changes and moves the card to the chosen column', async () => {
    const user = userEvent.setup()
    await renderBoard([row({ id: 'a', title: 'Old title' })])
    await user.click(screen.getByRole('button', { name: 'Edit Old title' }))
    expect(screen.getByRole('heading', { name: 'Edit card' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Old title')

    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'New title')
    await user.selectOptions(screen.getByLabelText('Column'), 'done')
    await user.selectOptions(screen.getByLabelText('Priority'), 'Low')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(column('Done')).getByText('New title')).toBeInTheDocument()
    expect(within(column('Backlog')).queryByText('Old title')).not.toBeInTheDocument()
    expect(mockDb.writes()[0]).toMatchObject({
      op: 'update',
      filters: [['id', 'a']],
      payload: { title: 'New title', column_id: 'done', priority: 'Low' },
    })
  })
})

describe('deleting a card', () => {
  it('only offers delete for existing cards, then removes the card', async () => {
    const user = userEvent.setup()
    await renderBoard([row({ id: 'a', title: 'Doomed' })])
    await user.click(within(column('Backlog')).getByRole('button', { name: /Add card/ }))
    expect(screen.queryByRole('button', { name: 'Delete card' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Edit Doomed' }))
    await user.click(screen.getByRole('button', { name: 'Delete card' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('Doomed')).not.toBeInTheDocument()
    expect(mockDb.writes()[0]).toMatchObject({ op: 'delete', filters: [['id', 'a']] })
  })
})

describe('moving a card (drag and drop)', () => {
  const dropOn = (target: Element, cardId: string) =>
    fireEvent.drop(target, { dataTransfer: { getData: () => cardId } })

  it('moves a card to another column and announces it', async () => {
    await renderBoard([row({ id: 'a', title: 'Drag me' })])
    dropOn(column('In Progress'), 'a')

    expect(within(column('In Progress')).getByText('Drag me')).toBeInTheDocument()
    expect(within(column('Backlog')).queryByText('Drag me')).not.toBeInTheDocument()
    expect(screen.getByText('Moved Drag me to In Progress')).toBeInTheDocument()
    await waitFor(() => expect(mockDb.writes()).toHaveLength(1))
    expect(mockDb.writes()[0]).toMatchObject({
      op: 'update',
      payload: { column_id: 'in-progress' },
    })
  })

  it('drops before the card it lands on', async () => {
    await renderBoard([
      row({ id: 'a', title: 'First', column_id: 'done', position: 1 }),
      row({ id: 'b', title: 'Mover', position: 1 }),
    ])
    dropOn(screen.getByText('First'), 'b')
    const titles = within(column('Done'))
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(titles).toEqual(['Mover', 'First'])
  })
})

// Regression: audit fixes around failure handling and accessibility.
describe('regression: failed saves', () => {
  it('keeps the modal open with a generic error and does not leak DB detail', async () => {
    const user = userEvent.setup()
    await renderBoard()
    mockDb.errors.insert = 'new row violates row-level security policy for table "cards"'
    await user.click(within(column('Backlog')).getByRole('button', { name: /Add card/ }))
    await fillAndSave(user, 'Will fail')

    const alert = await screen.findAllByRole('alert')
    expect(alert.map((a) => a.textContent)).toContain('Could not save your changes. Please try again.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/row-level security|violates/)
    // Reload rolled back the optimistic card.
    expect(screen.queryByText('Will fail')).not.toBeInTheDocument()
  })

  it('keeps the modal open when delete fails', async () => {
    const user = userEvent.setup()
    await renderBoard([row({ id: 'a', title: 'Sticky' })])
    mockDb.errors.delete = 'permission denied'
    await user.click(screen.getByRole('button', { name: 'Edit Sticky' }))
    await user.click(screen.getByRole('button', { name: 'Delete card' }))
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Sticky')).toBeInTheDocument()
  })

  it('shows a dismissible banner with a generic message when the board fails to load', async () => {
    mockDb.errors.select = 'relation "public.cards" does not exist'
    render(<Board email="a@b.c" onSignOut={() => {}} />)
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Could not load the board. Please try again.')
    expect(banner).not.toHaveTextContent('relation')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('regression: modal accessibility', () => {
  it('is a labelled modal dialog, makes the page inert, and restores both on close', async () => {
    const user = userEvent.setup()
    await renderBoard()
    const addButton = within(column('Backlog')).getByRole('button', { name: /Add card/ })
    await user.click(addButton)

    const dialog = screen.getByRole('dialog', { name: 'Add card' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Title')).toHaveFocus()
    expect(document.querySelector('.board-page')).toHaveAttribute('inert')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('.board-page')).not.toHaveAttribute('inert')
    expect(addButton).toHaveFocus()
  })

  it('traps Tab inside the dialog in both directions', async () => {
    const user = userEvent.setup()
    await renderBoard()
    await user.click(within(column('Backlog')).getByRole('button', { name: /Add card/ }))
    const dialog = screen.getByRole('dialog')
    const save = within(dialog).getByRole('button', { name: 'Save' })

    save.focus()
    await user.tab()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(save).toHaveFocus()
  })

  it('closes when the backdrop is clicked but not when the dialog is', async () => {
    const user = userEvent.setup()
    await renderBoard()
    await user.click(within(column('Backlog')).getByRole('button', { name: /Add card/ }))
    await user.click(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.mouseDown(document.querySelector('.modal-backdrop')!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
