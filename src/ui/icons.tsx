import type { AppTab } from '../store/store';

interface IconProps {
  size?: number;
}

const S = (size = 18) => ({ width: size, height: size, viewBox: '0 0 24 24' });

function base(children: React.ReactNode, size = 18) {
  return (
    <svg
      {...S(size)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const TabIcon = ({ tab, size = 18 }: { tab: AppTab; size?: number }) => {
  switch (tab) {
    case 'home':
      return base(
        <>
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M6.5 10.5V20h11v-9.5" />
          <path d="M10 20v-6h4v6" />
        </>,
        size,
      );
    case 'ladder':
      return base(
        <>
          <path d="M3 12h18" />
          <path d="M8 8v8" />
          <path d="M8 12h4" />
          <circle cx="16" cy="12" r="2.6" />
        </>,
        size,
      );
    case 'st':
      return base(
        <>
          <path d="M8 4 4 12l4 8" />
          <path d="M16 4l4 8-4 8" />
          <path d="M13.5 4 10.5 20" />
        </>,
        size,
      );
    case 'tags':
      return base(
        <>
          <path d="M4 6h16" />
          <path d="M4 12h10" />
          <path d="M4 18h13" />
          <circle cx="18.5" cy="12" r="2" />
        </>,
        size,
      );
    case 'io':
      return base(
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M4 10h16" />
          <path d="M9 14h6" />
        </>,
        size,
      );
    case 'plant':
      return base(
        <>
          <rect x="4" y="10" width="6" height="10" rx="1" />
          <path d="M10 14h4" />
          <circle cx="17" cy="16" r="3" />
          <path d="M17 8v3" />
        </>,
        size,
      );
    case 'hmi':
      return base(
        <>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M9 21h6" />
          <path d="M12 17v4" />
          <path d="M7 9h4" />
          <circle cx="16" cy="9" r="1.6" />
        </>,
        size,
      );
    case 'iiot':
      return base(
        <>
          <circle cx="6" cy="12" r="2.4" />
          <circle cx="18" cy="6" r="2.4" />
          <circle cx="18" cy="18" r="2.4" />
          <path d="M8.2 10.8 15.8 7.2" />
          <path d="M8.2 13.2 15.8 16.8" />
        </>,
        size,
      );
    case 'training':
      return base(
        <>
          <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
          <path d="M7 10.5V16c0 1 2.2 2 5 2s5-1 5-2v-5.5" />
          <path d="M21 8.5V14" />
        </>,
        size,
      );
  }
};

export const Glyph = {
  play: (p: IconProps = {}) =>
    base(<path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none" />, p.size),
  stop: (p: IconProps = {}) => base(<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none" />, p.size),
  reset: (p: IconProps = {}) =>
    base(
      <>
        <path d="M4 12a8 8 0 1 0 2.3-5.6" />
        <path d="M4 5v4h4" />
      </>,
      p.size,
    ),
  undo: (p: IconProps = {}) =>
    base(
      <>
        <path d="M9 7 4 12l5 5" />
        <path d="M4 12h11a5 5 0 0 1 0 10h-3" />
      </>,
      p.size,
    ),
  redo: (p: IconProps = {}) =>
    base(
      <>
        <path d="m15 7 5 5-5 5" />
        <path d="M20 12H9a5 5 0 0 0 0 10h3" />
      </>,
      p.size,
    ),
  plus: (p: IconProps = {}) =>
    base(
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>,
      p.size,
    ),
  download: (p: IconProps = {}) =>
    base(
      <>
        <path d="M12 4v11" />
        <path d="m7 11 5 5 5-5" />
        <path d="M5 20h14" />
      </>,
      p.size,
    ),
  upload: (p: IconProps = {}) =>
    base(
      <>
        <path d="M12 20V9" />
        <path d="m7 13 5-5 5 5" />
        <path d="M5 4h14" />
      </>,
      p.size,
    ),
  trash: (p: IconProps = {}) =>
    base(
      <>
        <path d="M4 7h16" />
        <path d="M9 7V5h6v2" />
        <path d="M6 7l1 13h10l1-13" />
      </>,
      p.size,
    ),
  close: (p: IconProps = {}) =>
    base(
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>,
      p.size,
    ),
  arrowUp: (p: IconProps = {}) => base(<path d="m6 14 6-6 6 6" />, p.size),
  arrowDown: (p: IconProps = {}) => base(<path d="m6 10 6 6 6-6" />, p.size),
  chevron: (p: IconProps = {}) => base(<path d="m9 6 6 6-6 6" />, p.size),
  ledger: (p: IconProps = {}) =>
    base(
      <>
        <path d="M4 5h16v14H4z" />
        <path d="M4 9h16" />
        <path d="M8 9v10" />
      </>,
      p.size,
    ),
  book: (p: IconProps = {}) =>
    base(
      <>
        <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z" />
        <path d="M8 7h7" />
        <path d="M8 11h7" />
      </>,
      p.size,
    ),
  help: (p: IconProps = {}) =>
    base(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
        <path d="M12 17h.01" />
      </>,
      p.size,
    ),
  gauge: (p: IconProps = {}) =>
    base(
      <>
        <path d="M4 15a8 8 0 1 1 16 0" />
        <path d="m12 15 3.5-4" />
      </>,
      p.size,
    ),
};

export type GlyphName = keyof typeof Glyph;

export function Icon({ name, size = 16 }: { name: GlyphName; size?: number }) {
  return Glyph[name]({ size });
}
