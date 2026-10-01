import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { COLUMNS, PRIORITIES } from '../types'
import type { Card, CardInput, ColumnId, Priority } from '../types'
import closeA from '../assets/icons/close-a.svg'
import closeB from '../assets/icons/close-b.svg'

export interface SaveResult {
  ok: boolean
  error?: string
}

interface CardModalProps {
  /** Card being edited, or null when creating a new one. */
  card: Card | null
  /** Column to preselect when creating a card (the one whose "Add card" button was clicked). */
  initialColumnId: ColumnId
  onSave: (input: CardInput, columnId: ColumnId) => Promise<SaveResult>
  onDelete?: () => Promise<SaveResult>
  onClose: () => void
}

export function CardModal({ card, initialColumnId, onSave, onDelete, onClose }: CardModalProps) {
  const [title, setTitle] = useState(card?.title ?? '')
  const [assignee, setAssignee] = useState(card?.assignee ?? '')
  const [priority, setPriority] = useState<Priority>(card?.priority ?? 'Medium')
  const [dueDate, setDueDate] = useState(card?.dueDate ?? '')
  const [columnId, setColumnId] = useState<ColumnId>(card?.columnId ?? initialColumnId)
  const [submitted, setSubmitted] = useState(false)
  // Which action is in flight, so the right button shows feedback and the
  // other stays enabled (e.g. Cancel still works while Save is pending).
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Move focus into the dialog, and put it back where it came from on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    titleRef.current?.focus()
    return () => {
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  // Escape closes; Tab / Shift+Tab are trapped inside the dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const errors = {
    title: title.trim() ? '' : 'Title is required',
    assignee: assignee.trim() ? '' : 'Assignee is required',
    dueDate: dueDate ? '' : 'Due date is required',
  }
  const valid = !errors.title && !errors.assignee && !errors.dueDate

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!valid) {
      // Send focus to the first invalid field so the error is announced.
      const first = errors.title ? 'card-title' : errors.assignee ? 'card-assignee' : 'card-due'
      document.getElementById(first)?.focus()
      return
    }
    setServerError(null)
    setBusy('saving')
    const result = await onSave(
      { title: title.trim(), assignee: assignee.trim(), priority, dueDate },
      columnId,
    )
    setBusy(null)
    // On success the parent closes the modal; on failure, stay open and
    // show why, instead of closing and leaving the user to notice a
    // page-level banner after the fact.
    if (!result.ok) setServerError(result.error ?? 'Could not save this card. Please try again.')
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setServerError(null)
    setBusy('deleting')
    const result = await onDelete()
    setBusy(null)
    if (!result.ok) setServerError(result.error ?? 'Could not delete this card. Please try again.')
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
      >
        <div className="modal__header">
          <h2 id="card-modal-title" className="modal__title">
            {card ? 'Edit card' : 'Add card'}
          </h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="modal__close-icon" aria-hidden="true">
              <span>
                <img src={closeA} alt="" />
              </span>
              <span>
                <img src={closeB} alt="" />
              </span>
            </span>
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit} noValidate>
          <div className="field field--primary">
            <label htmlFor="card-title">Title</label>
            <input
              id="card-title"
              ref={titleRef}
              placeholder="Enter card title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={submitted && !!errors.title}
              aria-required="true"
              aria-describedby={submitted && errors.title ? 'card-title-error' : undefined}
            />
            {submitted && errors.title && (
              <p id="card-title-error" className="field__error">
                {errors.title}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="card-assignee">Assignee</label>
            <input
              id="card-assignee"
              placeholder="Who is responsible?"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              aria-invalid={submitted && !!errors.assignee}
              aria-required="true"
              aria-describedby={submitted && errors.assignee ? 'card-assignee-error' : undefined}
            />
            {submitted && errors.assignee && (
              <p id="card-assignee-error" className="field__error">
                {errors.assignee}
              </p>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="card-column">Column</label>
              <select
                id="card-column"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value as ColumnId)}
              >
                {COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="card-priority">Priority</label>
              <select
                id="card-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="card-due">Due Date</label>
              <input
                id="card-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-invalid={submitted && !!errors.dueDate}
              aria-required="true"
              aria-describedby={submitted && errors.dueDate ? 'card-due-error' : undefined}
              />
              {submitted && errors.dueDate && (
                <p id="card-due-error" className="field__error">
                {errors.dueDate}
              </p>
              )}
            </div>
          </div>

          {serverError && (
            <p className="modal__error" role="alert">
              {serverError}
            </p>
          )}

          <div className="modal__footer">
            {onDelete ? (
              <button
                type="button"
                className="modal__delete"
                onClick={handleDelete}
                disabled={busy !== null}
              >
                {busy === 'deleting' ? 'Deleting...' : 'Delete card'}
              </button>
            ) : (
              <span />
            )}
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy !== null}>
                {busy === 'saving' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
