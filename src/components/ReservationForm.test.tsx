import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReservationForm from './ReservationForm';
import type { Pc, ReservationInput } from '../lib/types';

const labs = [{ id: 'lab1', name: 'Computer Laboratory 1', rows: 5, cols: 6 }];
const pcs: Pc[] = [{ id: 'lab1-pc05', lab_id: 'lab1', label: 'PC-05', row: 0, col: 4, status: 'free', note: null, updated_at: '' }];

async function fill(u: ReturnType<typeof userEvent.setup>, end: string) {
  await u.type(screen.getByLabelText(/title/i), 'Programming 1');
  await u.type(screen.getByLabelText(/purpose/i), 'Lab class');
  await u.type(screen.getByLabelText(/date/i), '2099-01-05');
  await u.type(screen.getByLabelText(/start/i), '08:00');
  await u.type(screen.getByLabelText(/end/i), end);
}

describe('ReservationForm', () => {
  it('shows an error and does not submit when end is not after start', async () => {
    const calls: ReservationInput[] = [];
    const u = userEvent.setup();
    render(<ReservationForm labs={labs} pcs={pcs} role="teacher" approved={[]} schedules={[]} onSubmit={async (i) => { calls.push(i); }} onCancel={() => {}} />);
    await fill(u, '08:00');
    await u.click(screen.getByRole('button', { name: /send request/i }));
    expect(await screen.findByText(/end time must be after start time/i)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('submits once with pc_id null for a whole-lab booking', async () => {
    const calls: ReservationInput[] = [];
    const u = userEvent.setup();
    render(<ReservationForm labs={labs} pcs={pcs} role="teacher" approved={[]} schedules={[]} onSubmit={async (i) => { calls.push(i); }} onCancel={() => {}} />);
    await fill(u, '10:00');
    await u.click(screen.getByRole('button', { name: /send request/i }));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ lab_id: 'lab1', pc_id: null, start_time: '08:00', end_time: '10:00' });
  });

  it('prefills a single PC and shows server errors', async () => {
    const u = userEvent.setup();
    render(<ReservationForm labs={labs} pcs={pcs} role="teacher" approved={[]} schedules={[]} initial={{ lab_id: 'lab1', pc_id: 'lab1-pc05' }}
      onSubmit={async () => { throw new Error('This slot overlaps an approved reservation.'); }} onCancel={() => {}} />);
    expect(screen.getByLabelText(/seat/i)).toHaveValue('lab1-pc05');
    await fill(u, '10:00');
    await u.click(screen.getByRole('button', { name: /send request/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/overlaps/);
  });
});
