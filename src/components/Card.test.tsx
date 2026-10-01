import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Card } from './Card'
import type { Card as CardType } from '../types'

const base: CardType = {
  id: 'c1',
  title: 'Task',
  assignee: 'Ana',
  priority: 'High',
  dueDate: '2026-06-10',
  columnId: 'backlog',
  position: 1,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 5, 15, 12))
})
afterEach(() => vi.useRealTimers())

describe('Card', () => {
  it('shows title, priority and assignee with screen-reader labels', () => {
    render(<Card card={base} onEdit={() => {}} />)
    expect(screen.getByRole('button', { name: 'Edit Task' })).toBeInTheDocument()
    expect(screen.getByText('Priority:')).toBeInTheDocument()
    expect(screen.getByText('High')).toHaveClass('badge', { exact: false })
    expect(screen.getByText('Assignee:')).toBeInTheDocument()
  })

  it('calls onEdit with the card when clicked', async () => {
    const onEdit = vi.fn()
    render(<Card card={base} onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Task' }))
    expect(onEdit).toHaveBeenCalledWith(base)
  })

  it('flags past-due cards with text, not just colour', () => {
    render(<Card card={base} onEdit={() => {}} />)
    expect(screen.getByText('Overdue:')).toBeInTheDocument()
  })

  it('does not flag a card due today, in the future, or already done', () => {
    const { rerender } = render(<Card card={{ ...base, dueDate: '2026-06-15' }} onEdit={() => {}} />)
    expect(screen.queryByText('Overdue:')).not.toBeInTheDocument()
    rerender(<Card card={{ ...base, dueDate: '2026-07-01' }} onEdit={() => {}} />)
    expect(screen.queryByText('Overdue:')).not.toBeInTheDocument()
    rerender(<Card card={{ ...base, columnId: 'done' }} onEdit={() => {}} />)
    expect(screen.queryByText('Overdue:')).not.toBeInTheDocument()
  })

  it('formats the date in local time without a day shift', () => {
    render(<Card card={{ ...base, dueDate: '2026-01-01' }} onEdit={() => {}} />)
    expect(screen.getByText(/Jan 1, 2026|1 Jan 2026/)).toBeInTheDocument()
  })
})
