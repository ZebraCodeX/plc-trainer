/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { App } from './App';

afterEach(cleanup);

describe('App shell', () => {
  it('renders the header and home screen', () => {
    render(<App />);
    expect(screen.getAllByText(/PLC Trainer/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Run/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Getting started in 5 minutes/)).toBeTruthy();
  });

  it('loads the demo project and shows ladder symbols', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ladder Logic' }));
    // Demo project loads two rungs with contacts and coils.
    expect(screen.getAllByText('XIC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OTE').length).toBeGreaterThan(0);
  });

  it('switches tabs', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Tag Database' }));
    expect(screen.getByRole('button', { name: '+ Add Tag' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I/O Configuration' }));
    expect(screen.getByText('Chassis I/O Configuration')).toBeTruthy();
  });
});
