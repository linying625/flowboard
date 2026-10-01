import { useState } from 'react'
import type { DragEvent } from 'react'
import type { Card as CardType } from '../types'

interface CardProps {
  card: CardType
  onEdit: (card: CardType) => void
}

function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function Card({ card, onEdit }: CardProps) {
  const [dragging, setDragging] = useState(false)
  const overdue = card.columnId !== 'done' && card.dueDate < todayISO()

  const handleDragStart = (e: DragEvent<HTMLElement>) => {
    e.dataTransfer.setData('text/plain', card.id)
    e.dataTransfer.effectAllowed = 'move'
    setDragging(true)
  }

  return (
    <article
      className={`card${dragging ? ' card--dragging' : ''}`}
      data-card-id={card.id}
      draggable
      onClick={() => onEdit(card)}
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
    >
      <div className="card__top">
        <h3 className="card__title">
          <button
            type="button"
            className="card__title-button"
            aria-label={`Edit ${card.title}`}
          >
            {card.title}
          </button>
        </h3>
        <span className={`badge badge--${card.priority.toLowerCase()}`}>
          <span className="sr-only">Priority: </span>
          {card.priority}
        </span>
      </div>
      <div className="card__meta">
        <span className="card__assignee">
          <span className="sr-only">Assignee: </span>
          {card.assignee}
        </span>
        <span className={`card__due${overdue ? ' card__due--overdue' : ''}`}>
          {overdue && <span className="card__overdue-flag">Overdue: </span>}
          {formatDate(card.dueDate)}
        </span>
      </div>
    </article>
  )
}
