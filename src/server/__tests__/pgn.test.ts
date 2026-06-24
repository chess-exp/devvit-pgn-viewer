import { describe, it, expect } from 'vitest';
import { validatePgn, normalizePgn, extractHeaders, buildTextFallback } from '../pgn';
import { Chess } from 'chess.js';

const VALID_PGN = `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6`;

const WITH_HEADERS = `[Event "Test Match"]
[Site "Chess.com"]
[Date "2024.01.15"]
[Round "1"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O`;

const WITH_COMMENTS = `1. e4 {good move} e5 2. Nf3 Nc6`;

const WITH_NAGS = `1. e4!? e5 2. Nf3 Nc6`;

const PROMOTION = `1. a4 h5 2. a5 h4 3. a6 h3 4. axb7 hxg2 5. bxa8=Q gxh1=Q`;

const CHECKMATE = `1. f3 e5 2. g4 Qh4#`;

describe('normalizePgn', () => {
  it('trims whitespace', () => {
    expect(normalizePgn('  foo  ')).toBe('foo');
  });

  it('returns empty string for non-string input', () => {
    expect(normalizePgn(null)).toBe('');
    expect(normalizePgn(undefined)).toBe('');
    expect(normalizePgn(123)).toBe('');
  });
});

describe('validatePgn', () => {
  it('accepts valid PGN with title', () => {
    const result = validatePgn(VALID_PGN, 'My Game');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.plyCount).toBe(6);
      expect(result.pgnLength).toBe(VALID_PGN.length);
      expect(result.pgnSha256).toHaveLength(64);
    }
  });

  it('rejects empty title', () => {
    const result = validatePgn(VALID_PGN, '');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toMatch(/title/i);
    }
  });

  it('rejects blank title', () => {
    const result = validatePgn(VALID_PGN, '   ');
    expect(result.valid).toBe(false);
  });

  it('rejects overly long title', () => {
    const result = validatePgn(VALID_PGN, 'x'.repeat(301));
    expect(result.valid).toBe(false);
  });

  it('rejects empty PGN', () => {
    const result = validatePgn('', 'Title');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.message).toMatch(/pgn/i);
  });

  it('rejects oversized PGN', () => {
    // Create a valid PGN that exceeds 36000 chars
    const base = WITH_HEADERS;
    const padding = 'x'.repeat(37000 - base.length);
    const long = `[Comment "${padding}"]\n\n${base}`;
    expect(long.length).toBeGreaterThan(36000);
    const result = validatePgn(long, 'Title');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.message).toMatch(/36,000|characters/);
  });

  it('rejects unparseable PGN', () => {
    const result = validatePgn('this is not pgn', 'Title');
    expect(result.valid).toBe(false);
  });

  it('includes an SAN hint in the rejection message', () => {
    const result = validatePgn('this is not pgn', 'Title');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toMatch(/standard algebraic notation/i);
    }
  });

  it('surfaces the offending move when a PGN has an illegal move', () => {
    const result = validatePgn('1. e4 e5 2. Nf3 NN3', 'Title');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message.toLowerCase()).toContain('nn3');
    }
  });

  it('rejects PGN with zero moves', () => {
    const result = validatePgn('', 'Title');
    expect(result.valid).toBe(false);
  });

  it('accepts PGN with comments', () => {
    const result = validatePgn(WITH_COMMENTS, 'Comments');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.plyCount).toBe(4);
    }
  });

  it('accepts PGN with NAGs', () => {
    const result = validatePgn(WITH_NAGS, 'NAGs');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.plyCount).toBe(4);
    }
  });

  it('accepts castling', () => {
    const result = validatePgn(WITH_HEADERS, 'Castling');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.plyCount).toBe(16);
    }
  });

  it('accepts promotion', () => {
    const result = validatePgn(PROMOTION, 'Promotion');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.plyCount).toBe(10);
    }
  });

  it('accepts checkmate', () => {
    const result = validatePgn(CHECKMATE, 'Mate');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.plyCount).toBe(4);
    }
  });

  it('extracts headers from PGN with metadata', () => {
    const result = validatePgn(WITH_HEADERS, 'Headers');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.headers.white).toBe('Alice');
      expect(result.headers.black).toBe('Bob');
      expect(result.headers.result).toBe('1-0');
      expect(result.headers.event).toBe('Test Match');
    }
  });

  it('returns placeholder headers for PGN without metadata', () => {
    const result = validatePgn(CHECKMATE, 'No Headers');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.headers.white).toBeUndefined();
    }
  });
});

describe('extractHeaders', () => {
  it('returns empty strings for missing header fields', () => {
    const chess = new Chess();
    chess.loadPgn(`1. e4 e5`);
    const h = extractHeaders(chess);
    expect(h).toHaveProperty('event');
    expect(h).toHaveProperty('white');
    expect(h).toHaveProperty('black');
  });
});

describe('buildTextFallback', () => {
  it('wraps PGN in code fence', () => {
    const fb = buildTextFallback('1. e4');
    expect(fb).toContain('```');
    expect(fb).toContain('1. e4');
  });
});
