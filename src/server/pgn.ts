import { createHash } from 'node:crypto';
import { Chess } from 'chess.js';
import type { PgnHeaders, ValidatedPgn, ValidationError } from '../shared/pgn';

const MAX_PGN_LENGTH = 36_000;

export function normalizePgn(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim();
}

function nonEmpty(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '?') return undefined;
  return trimmed;
}

export function extractHeaders(chess: Chess): PgnHeaders {
  const raw = chess.header();
  return {
    event: nonEmpty(raw['Event']),
    site: nonEmpty(raw['Site']),
    date: nonEmpty(raw['Date']),
    round: nonEmpty(raw['Round']),
    white: nonEmpty(raw['White']),
    black: nonEmpty(raw['Black']),
    result: nonEmpty(raw['Result']),
  };
}

export function validatePgn(
  input: unknown,
  title: string
): ValidatedPgn | ValidationError {
  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (!trimmedTitle) {
    return { valid: false, message: 'Title is required.' };
  }
  if (trimmedTitle.length > 300) {
    return { valid: false, message: 'Title must be 300 characters or fewer.' };
  }

  const pgn = normalizePgn(input);
  if (!pgn) {
    return { valid: false, message: 'PGN text is required.' };
  }
  if (pgn.length > MAX_PGN_LENGTH) {
    return {
      valid: false,
      message: `PGN must be ${MAX_PGN_LENGTH.toLocaleString()} characters or fewer.`,
    };
  }

  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : '';
    const hint =
      'Each move should be in standard algebraic notation (e.g., e4, Nf3, O-O).';
    const message = detail
      ? `Invalid PGN: ${detail}. ${hint}`
      : `Invalid PGN – could not be parsed. ${hint}`;
    return { valid: false, message };
  }

  const history = chess.history({ verbose: true });
  if (history.length === 0) {
    return {
      valid: false,
      message:
        'PGN contains no moves. Paste the full game starting with "1. e4 ..." (headers in [brackets] are optional).',
    };
  }

  const plyCount = history.length;
  const headers = extractHeaders(chess);
  const pgnSha256 = createHash('sha256').update(pgn).digest('hex');
  const pgnLength = pgn.length;
  const textFallback = buildTextFallback(pgn);

  return {
    valid: true,
    pgn,
    headers,
    plyCount,
    pgnSha256,
    pgnLength,
    textFallback,
  };
}

export function buildTextFallback(pgn: string): string {
  return '```\n' + pgn + '\n```';
}
