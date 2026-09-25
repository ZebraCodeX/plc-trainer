import { glyph, isCoil, isContact } from '../ladder/glyphs';

interface Props {
  op: string;
  hot?: boolean;
}

/**
 * IEC / Allen-Bradley style ladder symbols drawn as SVG:
 *  - normally open / closed contacts
 *  - output coils (energize / latch / unlatch)
 *  - function blocks with a mnemonic (timers, counters, math …)
 */
export function LadderSymbol({ op, hot = false }: Props) {
  const u = op.toUpperCase();
  const wire = hot ? '#35c46b' : '#6a829b';
  const body = hot ? '#35c46b' : '#9bb8d3';
  const glow = hot ? 'drop-shadow(0 0 4px #35c46b)' : undefined;

  if (isContact(u)) {
    return (
      <svg width="92" height="34" viewBox="0 0 92 34" style={{ filter: glow }}>
        <line x1="0" y1="17" x2="30" y2="17" stroke={wire} strokeWidth="2" />
        <line x1="62" y1="17" x2="92" y2="17" stroke={wire} strokeWidth="2" />
        <line x1="30" y1="4" x2="30" y2="30" stroke={body} strokeWidth="2.5" />
        <line x1="62" y1="4" x2="62" y2="30" stroke={body} strokeWidth="2.5" />
        {u === 'XIO' && (
          <line x1="26" y1="29" x2="66" y2="5" stroke={body} strokeWidth="2.5" />
        )}
        {u === 'ONS' && (
          <>
            <line x1="46" y1="26" x2="46" y2="10" stroke={body} strokeWidth="2" />
            <path d="M40 16 L46 9 L52 16" fill="none" stroke={body} strokeWidth="2" />
          </>
        )}
      </svg>
    );
  }

  if (isCoil(u)) {
    const letter = u === 'OTL' ? 'L' : u === 'OTU' ? 'U' : '';
    return (
      <svg width="92" height="34" viewBox="0 0 92 34" style={{ filter: glow }}>
        <line x1="0" y1="17" x2="36" y2="17" stroke={wire} strokeWidth="2" />
        <line x1="56" y1="17" x2="92" y2="17" stroke={wire} strokeWidth="2" />
        <path d="M36 5 Q22 17 36 29" fill="none" stroke={body} strokeWidth="2.5" />
        <path d="M56 5 Q70 17 56 29" fill="none" stroke={body} strokeWidth="2.5" />
        {letter && (
          <text x="46" y="22" fontSize="13" fontWeight="700" fill={body} textAnchor="middle">
            {letter}
          </text>
        )}
      </svg>
    );
  }

  // function block
  return (
    <svg width="92" height="34" viewBox="0 0 92 34" style={{ filter: glow }}>
      <line x1="0" y1="17" x2="12" y2="17" stroke={wire} strokeWidth="2" />
      <line x1="80" y1="17" x2="92" y2="17" stroke={wire} strokeWidth="2" />
      <rect x="12" y="4" width="68" height="26" rx="4" fill="#1a2330" stroke={body} strokeWidth="1.5" />
      <text
        x="46"
        y="23"
        fontSize="14"
        fontWeight="600"
        fill={body}
        textAnchor="middle"
        fontFamily="var(--mono)"
      >
        {glyph(u)}
      </text>
    </svg>
  );
}
