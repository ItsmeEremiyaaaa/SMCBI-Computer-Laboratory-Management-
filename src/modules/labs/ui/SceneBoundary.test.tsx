import { render, screen } from '@testing-library/react';
import SceneBoundary from './SceneBoundary';

function Boom(): never { throw new Error('WebGL context lost'); }

describe('SceneBoundary', () => {
  it('shows the fallback and reports when the 3D view crashes', () => {
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SceneBoundary onError={(e) => errors.push(e.message)} fallback={<p>Floor plan</p>}><Boom /></SceneBoundary>);
    expect(screen.getByText('Floor plan')).toBeInTheDocument();
    expect(errors).toEqual(['WebGL context lost']);
  });
});
