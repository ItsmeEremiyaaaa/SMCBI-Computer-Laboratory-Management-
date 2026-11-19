import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from '../modules/auth/hooks/auth';
import { api } from '../shared/data/api';

const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>);

describe('auth gate', () => {
  beforeEach(async () => { await api.signOut(); });

  it('shows sign-in when nobody is signed in', async () => {
    renderAt('/reservations');
    expect(await screen.findByRole('heading', { name: /hello/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows the waiting page to an unapproved teacher on any route', async () => {
    await api.signIn('newteacher@smcbi.edu.ph', 'x');
    renderAt('/labs');
    expect(await screen.findByRole('heading', { name: /almost there/i })).toBeInTheDocument();
    expect(screen.getByText(/needs to approve/i)).toBeInTheDocument();
  });

  it('sends a teacher away from admin-only People pages', async () => {
    await api.signIn('teacher@smcbi.edu.ph', 'x');
    renderAt('/people/staff');
    expect(await screen.findByRole('heading', { level: 1, name: /overview/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /people/i })).not.toBeInTheDocument();
  });

  it('hides People from the teacher sidebar', async () => {
    await api.signIn('teacher@smcbi.edu.ph', 'x');
    renderAt('/');
    await screen.findByRole('heading', { level: 1, name: /overview/i });
    expect(screen.queryByRole('link', { name: /people/i })).not.toBeInTheDocument();
  });

  it('asks for a school email on sign-up', async () => {
    renderAt('/signup');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /^teacher$/i })); // teacher sign-up has the course field
    await u.type(screen.getByLabelText(/full name/i), 'Test User');
    await u.type(screen.getByLabelText(/email/i), 'test@gmail.com');
    await u.type(screen.getByLabelText(/^password/i), 'Passw0rd!');
    await u.type(screen.getByLabelText(/course/i), 'IT');
    await u.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/use your @smcbi\.edu\.ph email/i)).toBeInTheDocument();
  });
});
