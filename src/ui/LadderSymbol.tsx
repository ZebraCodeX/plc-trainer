import { glyph, isCoil, isContact } from '../ladder/glyphs';

interface Props {
  op: string;
  hot?: boolean;
  /** Logical state of the bit (contacts show a continuous line when conducting). */
  bit?: boolean;
}

const WIRE = '#7f8fa3';
const HOT = '#2fbf67';
const BODY = '#c7d3e0';

/**
 * Allen-Bradley / Logix style ladder symbols. Contacts are drawn as a gap in the
 * rung with two short vertical bars; when conducting the gap is bridged by a
 * continuous line (closed). Coils are a rounded parenthesis pair. Function
 * blocks are a bordered tile with a mnemonic glyph.
 */
export function LadderSymbol({ op, hot = false, bit = false }: Props) {
  const u = op.toUpperCase();
  const wire = hot ? HOT : WIRE;
  const body = hot ? HOT : BODY;

  if (isContact(u)) {
    const conducting = u === 'XIC' ? bit : u === 'XIO' ? !bit : bit;
    return (
      <svg width="64" height="26" viewBox="0 0 64 26" className="sym">
        <line x1="0" y1="13" x2="64" y2="13" stroke={conducting ? body : 'transparent'} strokeWidth="2.4" />
        <line x1="0" y1="13" x2="14" y2="13" stroke={wire} strokeWidth="2" />
        <line x1="50" y1="13" x2="64" y2="13" stroke={wire} strokeWidth="2" />
        <line x1="14" y1="4" x2="14" y2="22" stroke={body} strokeWidth="2.4" />
        <line x1="50" y1="4" x2="50" y2="22" stroke={body} strokeWidth="2.4" />
        {u === 'XIO' && <line x1="58" y1="19" x2="64" y2="7" stroke={body} strokeWidth="2" />}
        {u === 'ONS' && <path d="M44 16 L50 8 L56 16" fill="none" stroke={body} strokeWidth="1.6" />}
      </svg>
    );
  }

  if (isCoil(u)) {
    const letter = u === 'OTL' ? 'L' : u === 'OTU' ? 'U' : '';
    return (
      <svg width="64" height="26" viewBox="0 0 64 26" className="sym">
        <line x1="0" y1="13" x2="20" y2="13" stroke={wire} strokeWidth="2" />
        <line x1="44" y1="13" x2="64" y2="13" stroke={wire} strokeWidth="2" />
        <path d="M20 4 Q30 13 20 22" fill="none" stroke={body} strokeWidth="2.4" />
        <path d="M44 4 Q34 13 44 22" fill="none" stroke={body} strokeWidth="2.4" />
        {letter && (
          <text x="32" y="18" fontSize="12" fontWeight="700" fill={body} textAnchor="middle">
            {letter}
          </text>
        )}
      </svg>
    );
  }

  return (
    <svg width="72" height="26" viewBox="0 0 72 26" className="sym">
      <line x1="0" y1="13" x2="10" y2="13" stroke={wire} strokeWidth="2" />
      <line x1="62" y1="13" x2="72" y2="13" stroke={wire} strokeWidth="2" />
      <rect x="10" y="3" width="52" height="20" rx="2" fill="#10161f" stroke={body} strokeWidth="1.4" />
      <text
        x="36"
        y="17"
        fontSize="12"
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
