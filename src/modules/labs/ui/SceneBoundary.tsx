import { Component, type ReactNode } from 'react';

// Catches 3D crashes (lost WebGL context, blocked GPU, failed chunk load) so the page falls back instead of going blank.
export default class SceneBoundary extends Component<
  { fallback: ReactNode; onError?: (e: Error) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) { this.props.onError?.(e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
