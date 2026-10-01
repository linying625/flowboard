import { useState } from 'react'
import type { DragEvent } from 'react'
import { Card } from './Card'
import plusIcon from '../assets/icons/plus.svg'
import uploadIcon from '../assets/icons/upload.svg'
import type { Card as CardType, ColumnId } from '../types'

interface ColumnProps {
  id: ColumnId
  label: string
  cards: CardType[]
  onMoveCard: (cardId: string, toColumnId: ColumnId, beforeCardId?: string) => void
  onAddCard: (columnId: ColumnId) => void
  onEditCard: (card: CardType) => void
}

export function Column({
  id,
  label,
  cards,
  onMoveCard,
  onAddCard,
  onEditCard,
}: ColumnProps) {
  const [over, setOver] = useState(false)

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLElement>) => {
    // Ignore leave events fired when moving between children of this column.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setOver(false)
    const cardId = e.dataTransfer.getData('text/plain')
    if (!cardId) return
    // Dropping on a card inserts before it; dropping elsewhere appends.
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-card-id]')
    onMoveCard(cardId, id, target?.dataset.cardId)
  }

  return (
    <section
      className={`column${over ? ' column--over' : ''}`}
      aria-labelledby={`column-${id}-title`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="column__header">
        <h2 id={`column-${id}-title`} className="column__title">
          {label}
        </h2>
        <span
          className="column__count"
          aria-label={`${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`}
        >
          {cards.length}
        </span>
      </header>

      <div className="column__cards">
        {cards.map((card) => (
          <Card key={card.id} card={card} onEdit={onEditCard} />
        ))}
        {cards.length === 0 && (
          <div className="column__empty">
            <img src={uploadIcon} width={24} height={24} alt="" />
            <p>Drop a card here or add one below</p>
          </div>
        )}
      </div>

      <button
        type="button"
        className="column__add"
        onClick={() => onAddCard(id)}
      >
        <img src={plusIcon} width={16} height={16} alt="" />
        <span>Add card<span className="sr-only"> to {label}</span></span>
      </button>
    </section>
  )
}
