import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
  type StreamParser,
} from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { isKeyword } from './lexer';

interface StState {
  inBlockComment: boolean;
}

const stParser: StreamParser<StState> = {
  startState: () => ({ inBlockComment: false }),
  token(stream, state) {
    if (state.inBlockComment) {
      while (!stream.eol()) {
        if (stream.match('*)')) {
          state.inBlockComment = false;
          break;
        }
        stream.next();
      }
      return 'comment';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('(*')) {
      state.inBlockComment = true;
      while (!stream.eol()) {
        if (stream.match('*)')) {
          state.inBlockComment = false;
          break;
        }
        stream.next();
      }
      return 'comment';
    }
    if (stream.match(/'/)) {
      while (!stream.eol()) {
        const c = stream.next();
        if (c === "'") break;
      }
      return 'string';
    }
    if (stream.match(/^[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?/)) return 'number';
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current().toUpperCase();
      if (isKeyword(word)) return 'keyword';
      if (['ABS', 'SQRT', 'SIN', 'COS', 'TAN', 'LN', 'LOG', 'EXP', 'MIN', 'MAX'].includes(word))
        return 'atom';
      return 'variableName';
    }
    if (stream.match(/^(:=|<=|>=|<>|\*\*)/)) return 'operator';
    if (stream.match(/^[+\-*/=<>]/)) return 'operator';
    if (stream.match(/^[()[\]{},;:.]/)) return 'bracket';
    stream.next();
    return null;
  },
};

export const stLanguage = StreamLanguage.define(stParser);

const stHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#ff7b9c', fontWeight: 'bold' },
  { tag: t.controlKeyword, color: '#ff7b9c', fontWeight: 'bold' },
  { tag: t.comment, color: '#6a7a8c', fontStyle: 'italic' },
  { tag: t.string, color: '#e6c07b' },
  { tag: t.number, color: '#f5b301' },
  { tag: t.operator, color: '#9be89b' },
  { tag: t.bracket, color: '#9bb8d3' },
  { tag: t.variableName, color: '#7fd6ff' },
  { tag: t.special(t.variableName), color: '#a98bff' },
  { tag: t.atom, color: '#a98bff' },
  { tag: t.bool, color: '#f5b301' },
]);

export const stTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#0f1319', color: '#dbe4ef', height: '100%' },
    '.cm-content': { fontFamily: 'var(--mono)', fontSize: '13px' },
    '.cm-gutters': { backgroundColor: '#161c24', color: '#5b6a7c', border: 'none' },
    '.cm-activeLine': { backgroundColor: '#1a2230' },
    '.cm-activeLineGutter': { backgroundColor: '#1a2230' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground, ::selection': { backgroundColor: '#1c3b57' },
  },
  { dark: true },
);

export interface TagSuggestion {
  name: string;
  dataType: string;
}

function completionSource(getTags: () => TagSuggestion[], getRoutines: () => string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_.]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    const kw = [
      'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF', 'CASE', 'OF', 'END_CASE', 'FOR', 'TO', 'BY',
      'DO', 'END_FOR', 'WHILE', 'END_WHILE', 'REPEAT', 'UNTIL', 'END_REPEAT', 'VAR', 'END_VAR',
      'TRUE', 'FALSE', 'AND', 'OR', 'NOT', 'XOR', 'MOD', 'RETURN', 'EXIT', 'CONTINUE',
      'TON', 'TOF', 'RTO', 'RES', 'CTU', 'CTD', 'MOV', 'CLR', 'ADD', 'SUB', 'MUL', 'DIV',
      'MOD', 'SQR', 'ABS', 'NEG', 'CPT', 'JSR',
    ];
    const options = [
      ...kw.map((label) => ({ label, type: 'keyword' })),
      ...getTags().map((tg) => ({
        label: tg.name,
        type: 'variable',
        detail: tg.dataType,
      })),
      ...getRoutines().map((r) => ({ label: r, type: 'function', detail: 'routine' })),
    ];
    return { from: word.from, options };
  };
}

export function stExtensions(
  getTags: () => TagSuggestion[],
  getRoutines: () => string[],
): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    dropCursor(),
    drawSelection(),
    indentUnit.of('  '),
    EditorView.lineWrapping,
    bracketMatching(),
    closeBrackets(),
    autocompletion({ override: [completionSource(getTags, getRoutines)] }),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    indentOnInput(),
    syntaxHighlighting(stHighlight),
    stTheme,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
  ];
}
