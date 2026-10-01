import { useEffect, useRef, useState } from 'react'
import { Column } from './Column'
import { CardModal } from './CardModal'
import { useBoardState } from '../hooks/useBoardState'
import { COLUMNS } from '../types'
import type { Card, ColumnId } from '../types'
import logoIcon from '../assets/icons/logo.svg'

type ModalState =
  | { open: false }
  | { open: true; card: Card | null; columnId: ColumnId }

interface BoardProps {
  email: string
  onSignOut: () => void
}

export function Board({ email, onSignOut }: BoardProps) {
  const {
    cards,
    loading,
    error,
    clearError,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
  } = useBoardState()
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [announcement, setAnnouncement] = useState('')
  const pageRef = useRef<HTMLDivElement>(null)

  const closeModal = () => setModal({ open: false })

  // Make the page behind the modal unreachable by keyboard and screen readers.
  useEffect(() => {
    const page = pageRef.current
    if (!page) return
    if (modal.open) page.setAttribute('inert', '')
    else page.removeAttribute('inert')
    return () => page.removeAttribute('inert')
  }, [modal.open])

  const labelFor = (id: ColumnId) => COLUMNS.find((c) => c.id === id)?.label ?? id

  const handleMoveCard = (cardId: string, toColumnId: ColumnId, beforeCardId?: string) => {
    const card = cards.find((c) => c.id === cardId)
    moveCard(cardId, toColumnId, beforeCardId)
    if (card) setAnnouncement(`Moved ${card.title} to ${labelFor(toColumnId)}`)
  }

  return (
    <>
    <div className="board-page" ref={pageRef}>
      <a href="#main" className="skip-link">
        Skip to board
      </a>
      <header className="navbar">
        <div className="navbar__brand">
          <span className="navbar__logo">
            <img src={logoIcon} width={20} height={20} alt="" />
          </span>
          <span className="navbar__name">FlowBoard</span>
        </div>
        <div className="navbar__user">
          <span className="navbar__avatar" aria-hidden="true">
            {(email[0] ?? 'U').toUpperCase()}
          </span>
          <span className="navbar__email">{email}</span>
          <button type="button" className="navbar__signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="subbar">
        <h1 className="subbar__title">Team Board</h1>
        <span className="subbar__meta">{COLUMNS.length} columns</span>
      </div>

      {error && (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
          <button type="button" className="banner__close" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      <main id="main" className="board-main" tabIndex={-1}>
      {loading ? (
        <div className="page-status" role="status">
          Loading your board...
        </div>
      ) : (
        <div className="board">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              label={col.label}
              cards={cards.filter((c) => c.columnId === col.id)}
              onMoveCard={handleMoveCard}
              onAddCard={(columnId) => setModal({ open: true, card: null, columnId })}
              onEditCard={(card) =>
                setModal({ open: true, card, columnId: card.columnId })
              }
            />
          ))}
        </div>
      )}
      </main>
    </div>

      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {modal.open && (
        <CardModal
          key={modal.card?.id ?? `new-${modal.columnId}`}
          card={modal.card}
          initialColumnId={modal.columnId}
          onClose={closeModal}
          onSave={async (input, columnId) => {
            const result = modal.card
              ? await updateCard(modal.card.id, input, columnId)
              : await addCard(input, columnId)
            // Only close on success, so a failed write stays visible in the
            // modal instead of surfacing only as a page banner after the
            // user has already moved on.
            if (result.ok) {
              setAnnouncement(`Card ${modal.card ? 'saved' : 'added'}`)
              closeModal()
            }
            return result
          }}
          onDelete={
            modal.card
              ? async () => {
                  const result = await deleteCard(modal.card!.id)
                  if (result.ok) {
                    setAnnouncement('Card deleted')
                    closeModal()
                  }
                  return result
                }
              : undefined
          }
        />
      )}
    </>
  )
}
