import { isCoil, isContact } from '../ladder/glyphs';

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
      <svg width="52" height="26" viewBox="0 0 52 26" className="sym">
        <line x1="0" y1="13" x2="52" y2="13" stroke={conducting ? body : 'transparent'} strokeWidth="2.4" />
        <line x1="0" y1="13" x2="12" y2="13" stroke={wire} strokeWidth="2" />
        <line x1="40" y1="13" x2="52" y2="13" stroke={wire} strokeWidth="2" />
        <line x1="12" y1="4" x2="12" y2="22" stroke={body} strokeWidth="2.4" />
        <line x1="40" y1="4" x2="40" y2="22" stroke={body} strokeWidth="2.4" />
        {u === 'XIO' && <line x1="46" y1="19" x2="52" y2="7" stroke={body} strokeWidth="2" />}
        {u === 'ONS' && <path d="M37 16 L43 8 L49 16" fill="none" stroke={body} strokeWidth="1.6" />}
      </svg>
    );
  }

  if (isCoil(u)) {
    const letter = u === 'OTL' ? 'L' : u === 'OTU' ? 'U' : '';
    return (
      <svg width="52" height="26" viewBox="0 0 52 26" className="sym">
        <line x1="0" y1="13" x2="16" y2="13" stroke={wire} strokeWidth="2" />
        <line x1="36" y1="13" x2="52" y2="13" stroke={wire} strokeWidth="2" />
        <path d="M16 4 Q26 13 16 22" fill="none" stroke={body} strokeWidth="2.4" />
        <path d="M36 4 Q26 13 36 22" fill="none" stroke={body} strokeWidth="2.4" />
        {letter && (
          <text x="26" y="19" fontSize="14" fontWeight="700" fill={body} textAnchor="middle">
            {letter}
          </text>
        )}
      </svg>
    );
  }

  // Function-block instructions show their mnemonic (TON, ADD, MOV, …) so the
  // tile reads like a real Logix block, which is clearer than a glyph.
  const label = u;
  const size = label.length <= 3 ? 13 : label.length === 4 ? 11 : 9.5;
  return (
    <svg width="52" height="26" viewBox="0 0 52 26" className="sym">
      <line x1="0" y1="13" x2="7" y2="13" stroke={wire} strokeWidth="2" />
      <line x1="45" y1="13" x2="52" y2="13" stroke={wire} strokeWidth="2" />
      <rect x="7" y="3" width="38" height="20" rx="2" fill="#10161f" stroke={body} strokeWidth="1.4" />
      <text
        x="26"
        y="18.5"
        fontSize={size}
        fontWeight="700"
        letterSpacing="0.3"
        fill={body}
        textAnchor="middle"
        fontFamily="var(--mono)"
      >
        {label}
      </text>
    </svg>
  );
}
