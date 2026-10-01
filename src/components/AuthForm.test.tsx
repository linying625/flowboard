import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthForm } from './AuthForm'

async function submit(user: ReturnType<typeof userEvent.setup>, email: string, pw = 'password1') {
  await user.type(screen.getByLabelText('Email Address'), email)
  await user.type(screen.getByLabelText('Password'), pw)
  // The mode tab and the submit button can share a name, so pick by type.
  const submitButton = screen.getAllByRole('button').find((b) => b.getAttribute('type') === 'submit')!
  await user.click(submitButton)
}

describe('AuthForm', () => {
  it('signs in with a trimmed email', async () => {
    const user = userEvent.setup()
    const onSignIn = vi.fn().mockResolvedValue({ error: null })
    render(<AuthForm onSignIn={onSignIn} onSignUp={vi.fn()} />)
    await submit(user, '  a@b.co  ')
    expect(onSignIn).toHaveBeenCalledWith('a@b.co', 'password1')
  })

  it('shows sign-in errors in an alert', async () => {
    const user = userEvent.setup()
    const onSignIn = vi.fn().mockResolvedValue({ error: 'Invalid login credentials' })
    render(<AuthForm onSignIn={onSignIn} onSignUp={vi.fn()} />)
    await submit(user, 'a@b.co')
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
  })

  it('after sign-up needing confirmation, shows a notice and returns to sign-in', async () => {
    const user = userEvent.setup()
    const onSignUp = vi.fn().mockResolvedValue({ error: null, needsConfirmation: true })
    render(<AuthForm onSignIn={vi.fn()} onSignUp={onSignUp} />)
    await user.click(screen.getByRole('button', { name: 'Sign up' }))
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument()
    await submit(user, 'new@b.co')
    expect(onSignUp).toHaveBeenCalledWith('new@b.co', 'password1')
    expect(await screen.findByRole('status')).toHaveTextContent('Check your email')
    expect(screen.getByRole('button', { name: 'Sign in', pressed: true })).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })
})
