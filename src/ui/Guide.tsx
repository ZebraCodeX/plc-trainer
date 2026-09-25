import { useState, type ReactNode } from 'react';

export function Guide({
  title = 'How this page works',
  children,
  defaultOpen = false,
}: {
  title?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`guide ${open ? 'open' : ''}`}>
      <button className="guide-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="guide-icon">?</span>
        <span>{title}</span>
        <span className="guide-caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="guide-body">{children}</div>}
    </div>
  );
}

export function Info({ children }: { children: ReactNode }) {
  return <div className="info">{children}</div>;
}
