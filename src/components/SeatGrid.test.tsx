import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeatGrid from './SeatGrid';
import { STATUS_COLOR } from './ui';
import type { LivePc } from '../hooks/useLabLive';

const lab = { id: 'lab1', name: 'Computer Laboratory 1', rows: 5, cols: 6 };
const pcs: LivePc[] = Array.from({ length: 30 }, (_, i) => ({
  id: `p${i + 1}`, lab_id: 'lab1', label: `PC-${String(i + 1).padStart(2, '0')}`, row: Math.floor(i / 6), col: i % 6,
  status: 'free', note: null, updated_at: '', shown: i === 4 ? 'reserved' : 'free',
}));

describe('SeatGrid', () => {
  it('renders one button per PC', () => {
    render(<SeatGrid lab={lab} pcs={pcs} selectedId={null} onSelect={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(30);
    expect(screen.getByRole('button', { name: /PC-01/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PC-30/ })).toBeInTheDocument();
  });

  it('shows a reserved PC in the reserved color with its status in the name', () => {
    render(<SeatGrid lab={lab} pcs={pcs} selectedId={null} onSelect={() => {}} />);
    const b = screen.getByRole('button', { name: 'PC-05, Reserved' });
    expect(b.querySelector('.led')).toHaveStyle({ color: STATUS_COLOR.reserved });
  });

  it('calls onSelect with the PC id', async () => {
    const picked: string[] = [];
    render(<SeatGrid lab={lab} pcs={pcs} selectedId={null} onSelect={(id) => picked.push(id)} />);
    await userEvent.click(screen.getByRole('button', { name: /PC-07/ }));
    expect(picked).toEqual(['p7']);
  });
});
