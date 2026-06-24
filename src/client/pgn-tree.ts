import { Chess } from 'chess.js';
import { parseGame } from '@mliebelt/pgn-parser';

export type TreeNode = {
  id: number;
  san: string;
  fen: string;
  ply: number;
  parent: TreeNode | TreeRoot;
  children: TreeNode[];
  commentBefore?: string;
  commentAfter?: string;
  nag?: string;
};

export type TreeRoot = {
  id: 0;
  fen: string;
  children: TreeNode[];
  initialComment?: string;
  parent: null;
};

export type Tree = {
  root: TreeRoot;
  byId: Map<number, TreeNode | TreeRoot>;
};

const NAG_GLYPHS: Record<string, string> = {
  $1: '!',
  $2: '?',
  $3: '!!',
  $4: '??',
  $5: '!?',
  $6: '?!',
  $10: '=',
  $13: '∞',
  $14: '⩲',
  $15: '⩱',
  $16: '±',
  $17: '∓',
  $18: '+−',
  $19: '−+',
};

function mapNag(nag: string | undefined): string | undefined {
  if (!nag) return undefined;
  return NAG_GLYPHS[nag];
}

export function buildTree(pgn: string): Tree {
  const parsed = parseGame(pgn, { startRule: 'game' });
  const chess = new Chess();
  const fenTag = parsed.tags?.FEN;
  if (typeof fenTag === 'string' && fenTag.trim() !== '') {
    chess.load(fenTag.trim());
  }
  const initialComment = parsed.gameComment?.comment?.trim();
  const root: TreeRoot = {
    id: 0,
    fen: chess.fen(),
    children: [],
    parent: null,
    ...(initialComment ? { initialComment } : {}),
  };
  const byId = new Map<number, TreeNode | TreeRoot>();
  byId.set(0, root);

  let counter = 1;

  const walk = (moves: typeof parsed.moves, parent: TreeNode | TreeRoot): void => {
    let prev: TreeNode | TreeRoot = parent;
    for (const m of moves) {
      const startFen = chess.fen();
      const san = m.notation.notation;
      const result = chess.move(san);
      if (!result) {
        throw new Error(`Illegal move in PGN: ${san} at ${startFen}`);
      }
      const commentAfterRaw = (m.commentAfter ?? m.commentDiag?.comment)?.trim();
      const commentBeforeRaw = m.commentMove?.trim();
      const nagGlyph = mapNag(m.nag?.[0]);
      const node: TreeNode = {
        id: counter++,
        san: result.san,
        fen: chess.fen(),
        ply: (prev === root ? 0 : (prev as TreeNode).ply) + 1,
        parent: prev,
        children: [],
        ...(commentBeforeRaw ? { commentBefore: commentBeforeRaw } : {}),
        ...(commentAfterRaw ? { commentAfter: commentAfterRaw } : {}),
        ...(nagGlyph ? { nag: nagGlyph } : {}),
      };
      prev.children.push(node);
      byId.set(node.id, node);

      if (m.variations && m.variations.length > 0) {
        for (const variation of m.variations) {
          chess.load(startFen);
          walk(variation, prev);
        }
        chess.load(node.fen);
      }

      prev = node;
    }
  };

  walk(parsed.moves, root);
  return { root, byId };
}

export function nextNode(node: TreeNode | TreeRoot): TreeNode | null {
  return node.children[0] ?? null;
}

export function prevNode(node: TreeNode | TreeRoot): TreeNode | TreeRoot | null {
  if (node.id === 0) return null;
  return (node as TreeNode).parent;
}

export function enterVariation(
  node: TreeNode | TreeRoot
): TreeNode | null {
  return node.children[1] ?? null;
}

export function exitVariation(
  node: TreeNode | TreeRoot
): TreeNode | null {
  let current: TreeNode | TreeRoot = node;
  while (current.id !== 0) {
    const parent = (current as TreeNode).parent;
    const idx = parent.children.indexOf(current as TreeNode);
    if (idx >= 1) {
      return parent.children[0] ?? null;
    }
    current = parent;
  }
  return null;
}

export function endOfLine(node: TreeNode | TreeRoot): TreeNode | TreeRoot {
  let current: TreeNode | TreeRoot = node;
  while (current.children[0]) {
    current = current.children[0];
  }
  return current;
}

export function mainlinePlyCount(tree: Tree): number {
  let count = 0;
  let cur: TreeNode | TreeRoot = tree.root;
  while (cur.children[0]) {
    cur = cur.children[0];
    count++;
  }
  return count;
}
