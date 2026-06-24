import { describe, expect, it } from 'vitest';
import { buildTree } from './pgn-tree';

describe('buildTree', () => {
  it('preserves PGN colored square and arrow annotations', () => {
    const tree = buildTree('1. e4 {[%csl Ge4,Yd5][%cal Gg1f3,Rd1d8]} e5 *');
    const firstMove = tree.root.children[0]!;

    expect(firstMove.lastMove).toEqual({ from: 'e2', to: 'e4' });
    expect(firstMove.highlights).toEqual([
      { square: 'e4', color: '#4caf50' },
      { square: 'd5', color: '#f59e0b' },
    ]);
    expect(firstMove.arrows).toEqual([
      { startSquare: 'g1', endSquare: 'f3', color: '#4caf50' },
      { startSquare: 'd1', endSquare: 'd8', color: '#ef4444' },
    ]);
  });

  it('keeps text comments when drawing annotations are present', () => {
    const tree = buildTree('1. e4 {central [%csl Ge4][%cal Ge2e4]} e5 *');
    const firstMove = tree.root.children[0]!;

    expect(firstMove.commentAfter).toBe('central');
    expect(firstMove.highlights).toEqual([{ square: 'e4', color: '#4caf50' }]);
    expect(firstMove.arrows).toEqual([
      { startSquare: 'e2', endSquare: 'e4', color: '#4caf50' },
    ]);
  });

  it('accepts whitespace inside drawing annotation lists', () => {
    const tree = buildTree('1. e4 {[%csl Ge4, Yd5][%cal Gg1f3, Rd1d8]} e5 *');
    const firstMove = tree.root.children[0]!;

    expect(firstMove.highlights).toEqual([
      { square: 'e4', color: '#4caf50' },
      { square: 'd5', color: '#f59e0b' },
    ]);
    expect(firstMove.arrows).toEqual([
      { startSquare: 'g1', endSquare: 'f3', color: '#4caf50' },
      { startSquare: 'd1', endSquare: 'd8', color: '#ef4444' },
    ]);
  });

  it('uses the FEN header as the root position for position-only posts', () => {
    const fen = '8/8/8/8/4k3/8/4K3/4Q3 w - - 0 1';
    const tree = buildTree(`[FEN "${fen}"]\n[SetUp "1"]\n\n*`);

    expect(tree.root.fen).toBe(fen);
    expect(tree.root.children).toHaveLength(0);
  });
});
