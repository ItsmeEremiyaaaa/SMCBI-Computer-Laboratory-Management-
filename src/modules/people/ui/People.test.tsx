import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import People from './People';
import { AuthProvider } from '../../auth/hooks/auth';
import { api } from '../../../shared/data/api';

const renderTab = (tab: string) => render(
  <MemoryRouter initialEntries={[`/people/${tab}`]}>
    <AuthProvider><Routes><Route path="/people/:tab" element={<People />} /></Routes></AuthProvider>
  </MemoryRouter>,
);

describe('People', () => {
  beforeEach(async () => { await api.signIn('admin@smcbi.edu.ph', 'x'); });

  it('lets an admin approve a pending teacher', async () => {
    renderTab('teachers');
    // the row opens the person window, where the actions live
    await userEvent.click((await screen.findByText('Carlo Dizon')).closest('button')!);
    const win = await screen.findByRole('dialog', { name: 'Carlo Dizon' });
    await userEvent.click(within(win).getByRole('button', { name: /^approve$/i }));
    await waitFor(() => expect(within(win).queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument());
    expect((await api.listProfiles('teacher')).find((p) => p.full_name === 'Carlo Dizon')?.approved).toBe(true);
  });

  it('shows the error when adding a student with a duplicate ID', async () => {
    const u = userEvent.setup();
    renderTab('students');
    await u.click(await screen.findByRole('button', { name: /add student/i }));
    await u.type(screen.getByLabelText(/student id/i), 'C260001');
    await u.type(screen.getByLabelText(/full name/i), 'Copy Cat');
    await u.type(screen.getByLabelText(/email/i), 'copy@smcbi.edu.ph');
    await u.type(screen.getByLabelText(/section/i), 'A');
    await u.click(screen.getByRole('button', { name: /save student/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/student id already exists/i);
  });
});
