import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FlipVertical2,
  Copy,
  Check,
} from 'lucide-react';
import type {
  PgnApiResponse,
  PgnHeaders,
  PgnSubmitter,
} from '../../shared/pgn';
import {
  buildTree,
  endOfLine,
  enterVariation,
  exitVariation,
  mainlinePlyCount,
  nextNode,
  prevNode,
  type Tree,
  type TreeNode,
  type TreeRoot,
} from '../pgn-tree';

type ViewerState =
  | { status: 'loading' }
  | { status: 'error'; message: string; description?: string }
  | {
      status: 'ready';
      pgn: string;
      headers: PgnHeaders;
      tree: Tree;
      puzzleMode: boolean;
      submitter?: PgnSubmitter;
      description?: string;
    };

type PositionStatus = {
  kind: 'check' | 'checkmate';
  label: string;
  kingSquare?: string;
};

type ViewerLayout = 'stacked' | 'split';

const LAST_MOVE_SHADOW = 'inset 0 0 0 9999px rgba(250, 204, 21, 0.34)';
const CHECK_SHADOW =
  'inset 0 0 0 3px rgba(220, 38, 38, 0.95), inset 0 0 0 9999px rgba(239, 68, 68, 0.22)';
const SPLIT_LAYOUT_MIN_WIDTH = 620;
const SPLIT_LAYOUT_MIN_HEIGHT = 420;

function addSquareShadow(
  squareStyles: Record<string, CSSProperties>,
  square: string,
  shadow: string,
  placement: 'front' | 'back' = 'back'
) {
  const existing = squareStyles[square]?.boxShadow;
  const boxShadow =
    typeof existing === 'string' && existing.length > 0
      ? placement === 'front'
        ? `${shadow}, ${existing}`
        : `${existing}, ${shadow}`
      : shadow;

  squareStyles[square] = {
    ...squareStyles[square],
    boxShadow,
  };
}

function positionStatusForFen(fen: string): PositionStatus | null {
  const chess = new Chess(fen);
  if (!chess.isCheck()) return null;

  const [kingSquare] = chess.findPiece({ type: 'k', color: chess.turn() });
  return {
    kind: chess.isCheckmate() ? 'checkmate' : 'check',
    label: chess.isCheckmate() ? 'Checkmate' : 'Check',
    ...(kingSquare ? { kingSquare } : {}),
  };
}

function squareStylesForBoard(
  node: TreeNode | null,
  checkedKingSquare: string | undefined
): Record<string, CSSProperties> {
  const squareStyles: Record<string, CSSProperties> = {};

  if (node) {
    addSquareShadow(squareStyles, node.lastMove.from, LAST_MOVE_SHADOW);
    addSquareShadow(squareStyles, node.lastMove.to, LAST_MOVE_SHADOW);

    for (const highlight of node.highlights ?? []) {
      addSquareShadow(
        squareStyles,
        highlight.square,
        `inset 0 0 0 9999px ${highlight.color}66`
      );
    }
  }

  if (checkedKingSquare) {
    addSquareShadow(squareStyles, checkedKingSquare, CHECK_SHADOW, 'front');
  }

  return squareStyles;
}

export function Viewer() {
  const [state, setState] = useState<ViewerState>({ status: 'loading' });
  const [currentNodeId, setCurrentNodeId] = useState<number>(0);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(
    'white'
  );
  const [copiedPgn, setCopiedPgn] = useState(false);
  const [copiedFen, setCopiedFen] = useState(false);
  const [viewerLayout, setViewerLayout] = useState<ViewerLayout>('stacked');
  const [puzzleRevealed, setPuzzleRevealed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const movesPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/pgn')
      .then((res) => res.json())
      .then((data: PgnApiResponse) => {
        if (data.status === 'error') {
          setState({
            status: 'error',
            message: data.message,
            ...(data.description ? { description: data.description } : {}),
          });
          return;
        }
        if (data.errorMessage) {
          setState({
            status: 'error',
            message: data.errorMessage,
            ...(data.description ? { description: data.description } : {}),
          });
          return;
        }
        try {
          const tree = buildTree(data.pgn);
          const puzzleMode = Boolean(data.puzzleMode);
          setPuzzleRevealed(false);
          setCurrentNodeId(tree.root.id);
          setState({
            status: 'ready',
            pgn: data.pgn,
            headers: data.headers,
            tree,
            puzzleMode,
            ...(data.submitter ? { submitter: data.submitter } : {}),
            ...(data.description ? { description: data.description } : {}),
          });
        } catch (err) {
          console.error('Failed to parse PGN:', err);
          const detail = err instanceof Error ? err.message : '';
          setState({
            status: 'error',
            message: detail
              ? `Could not display this game: ${detail}`
              : 'Could not display this game: the PGN appears malformed.',
            ...(data.description ? { description: data.description } : {}),
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load PGN:', err);
        setState({
          status: 'error',
          message: 'Failed to load game data',
        });
      });
  }, []);

  const tree = state.status === 'ready' ? state.tree : null;
  const currentNode = tree ? (tree.byId.get(currentNodeId) ?? tree.root) : null;
  const currentFen = currentNode?.fen ?? new Chess().fen();
  const positionStatus = useMemo(
    () => positionStatusForFen(currentFen),
    [currentFen]
  );
  const boardAnnotations = useMemo(() => {
    const node =
      currentNode && currentNode.id !== 0 ? (currentNode as TreeNode) : null;
    return {
      arrows: node?.arrows ?? [],
      squareStyles: squareStylesForBoard(node, positionStatus?.kingSquare),
    };
  }, [currentNode, positionStatus?.kingSquare]);

  useEffect(() => {
    rootRef.current?.focus();
  }, [tree]);

  useEffect(() => {
    if (state.status !== 'ready') return;

    const root = rootRef.current;
    if (!root) return;

    const updateLayout = () => {
      const { width, height } = root.getBoundingClientRect();
      const nextLayout: ViewerLayout =
        width >= SPLIT_LAYOUT_MIN_WIDTH && height >= SPLIT_LAYOUT_MIN_HEIGHT
          ? 'split'
          : 'stacked';

      setViewerLayout((current) =>
        current === nextLayout ? current : nextLayout
      );
    };

    updateLayout();

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateLayout);

    resizeObserver?.observe(root);
    window.addEventListener('resize', updateLayout);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, [state.status]);

  useEffect(() => {
    if (!movesPanelRef.current || currentNodeId === 0) return;
    const el = movesPanelRef.current.querySelector(
      `[data-node-id="${currentNodeId}"]`
    );
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [currentNodeId]);

  const totalPly = useMemo(() => (tree ? mainlinePlyCount(tree) : 0), [tree]);

  if (state.status === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center text-neutral-700 dark:text-neutral-300">
        <p>Loading game...</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="viewer-root flex flex-col p-3 sm:p-6">
        <Banner
          errorMessage={state.message}
          {...(state.description ? { description: state.description } : {})}
        />
        <div className="mt-3 flex justify-center sm:mt-4">
          <div className="viewer-board-column">
            <div className="viewer-board-shell">
              <Chessboard
                options={{
                  position: new Chess().fen(),
                  boardOrientation: 'white',
                  allowDragging: false,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentNode) {
    return (
      <div className="flex h-dvh items-center justify-center text-neutral-700 dark:text-neutral-300">
        <p>Loading game...</p>
      </div>
    );
  }

  const currentPly = currentNode.id === 0 ? 0 : (currentNode as TreeNode).ply;
  const solutionVisible = !state.puzzleMode || puzzleRevealed;

  const goTo = (target: TreeNode | TreeRoot | null) => {
    if (!target) return;
    setCurrentNodeId(target.id);
  };

  const goToStart = () => goTo(state.tree.root);
  const goToPrevious = () => goTo(prevNode(currentNode));
  const goToNext = () => goTo(nextNode(currentNode));
  const goToEnd = () => goTo(endOfLine(currentNode));
  const goDown = () => goTo(enterVariation(currentNode));
  const goUp = () => goTo(exitVariation(currentNode));

  const toggleOrientation = () => {
    setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
  };

  const copyToClipboard = async (text: string, type: 'pgn' | 'fen') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'pgn') {
        setCopiedPgn(true);
        setTimeout(() => setCopiedPgn(false), 2000);
      } else {
        setCopiedFen(true);
        setTimeout(() => setCopiedFen(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }
    if (!solutionVisible && e.key !== 'f' && e.key !== 'F') {
      return;
    }
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        goToPrevious();
        break;
      case 'ArrowRight':
        e.preventDefault();
        goToNext();
        break;
      case 'ArrowDown':
        e.preventDefault();
        goDown();
        break;
      case 'ArrowUp':
        e.preventDefault();
        goUp();
        break;
      case 'Home':
        e.preventDefault();
        goToStart();
        break;
      case 'End':
        e.preventDefault();
        goToEnd();
        break;
      case 'f':
      case 'F':
        toggleOrientation();
        break;
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      data-layout={viewerLayout}
      className="viewer-root flex flex-col p-3 outline-none sm:p-6"
    >
      <Banner
        className="viewer-desktop-banner hidden md:flex"
        {...(state.submitter ? { submitter: state.submitter } : {})}
        {...(state.description ? { description: state.description } : {})}
      />
      <div className="viewer-content mt-2 flex w-full flex-col gap-2 md:mt-4 md:min-h-0 md:flex-1 md:flex-row md:items-start md:justify-center md:gap-6 first:mt-0">
        {/* Board and controls column - prioritized on mobile */}
        <div className="viewer-board-column mx-auto flex flex-none flex-col gap-2 md:mx-0 md:gap-3">
          <div className="viewer-board-shell flex-shrink-0">
            <Chessboard
              options={{
                position: currentFen,
                boardOrientation,
                allowDragging: false,
                arrows: boardAnnotations.arrows,
                squareStyles: boardAnnotations.squareStyles,
              }}
            />
          </div>

          {/* Navigation controls - directly under board on mobile */}
          {solutionVisible ? (
            <div className="viewer-nav flex items-center justify-between gap-1 rounded-lg bg-white p-2 shadow dark:bg-neutral-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
              <button
                onClick={goToStart}
                disabled={currentNodeId === 0}
                className="rounded p-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800"
                aria-label="Go to start"
              >
                <ChevronsLeft size={18} />
              </button>
              <button
                onClick={goToPrevious}
                disabled={currentNodeId === 0}
                className="rounded p-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800"
                aria-label="Previous move"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="whitespace-nowrap px-1 text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
                {currentPly} / {totalPly}
              </span>
              {positionStatus && (
                <span
                  className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold leading-none ${
                    positionStatus.kind === 'checkmate'
                      ? 'bg-red-600 text-white dark:bg-red-500 dark:text-white'
                      : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200'
                  }`}
                >
                  {positionStatus.label}
                </span>
              )}
              <button
                onClick={goToNext}
                disabled={!nextNode(currentNode)}
                className="rounded p-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800"
                aria-label="Next move"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={goToEnd}
                disabled={!nextNode(currentNode)}
                className="rounded p-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800"
                aria-label="Go to end"
              >
                <ChevronsRight size={18} />
              </button>
              <button
                onClick={toggleOrientation}
                className="ml-1 rounded p-1.5 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                aria-label="Flip board"
                title="Flip board"
              >
                <FlipVertical2 size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPuzzleRevealed(true)}
                className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200 dark:shadow-none dark:ring-1 dark:ring-white/10 dark:hover:bg-neutral-800"
              >
                Reveal solution
              </button>
              <button
                onClick={toggleOrientation}
                className="rounded-lg bg-white p-2 text-neutral-700 shadow hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none dark:ring-1 dark:ring-white/10 dark:hover:bg-neutral-800"
                aria-label="Flip board"
                title="Flip board"
              >
                <FlipVertical2 size={18} />
              </button>
            </div>
          )}

          {/* Copy buttons - compact on mobile */}
          {solutionVisible && (
            <div className="viewer-copy-desktop hidden gap-2 md:flex">
              <button
                onClick={() => copyToClipboard(state.pgn, 'pgn')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none dark:ring-1 dark:ring-white/10 dark:hover:bg-neutral-800"
                aria-label="Copy PGN"
              >
                {copiedPgn ? (
                  <>
                    <Check size={16} />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span className="hidden sm:inline">Copy PGN</span>
                  </>
                )}
              </button>
              <button
                onClick={() => copyToClipboard(currentFen, 'fen')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none dark:ring-1 dark:ring-white/10 dark:hover:bg-neutral-800"
                aria-label="Copy current FEN"
              >
                {copiedFen ? (
                  <>
                    <Check size={16} />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span className="hidden sm:inline">Copy FEN</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Info and moves sidebar - below board on mobile, beside on desktop */}
        {solutionVisible ? (
          <div className="viewer-sidebar mt-0 flex flex-none flex-col gap-2 md:mt-0 md:max-h-[calc(100vh-3rem)] md:min-h-0 md:w-80 md:flex-initial md:gap-3">
            <div className="viewer-game-card order-2 rounded-lg bg-white p-3 shadow dark:bg-neutral-900 dark:shadow-none dark:ring-1 dark:ring-white/10 md:order-1 md:p-4">
              <h2 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {state.headers.white ?? 'White'} vs{' '}
                {state.headers.black ?? 'Black'}
              </h2>
              {state.headers.event && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {state.headers.event}
                </p>
              )}
              {state.headers.date && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {state.headers.date}
                </p>
              )}
              {state.headers.result && (
                <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Result: {state.headers.result}
                </p>
              )}
            </div>

            <div
              ref={movesPanelRef}
              className="viewer-moves-panel order-1 max-h-32 overflow-y-auto rounded-lg bg-white p-3 shadow dark:bg-neutral-900 dark:shadow-none dark:ring-1 dark:ring-white/10 md:order-2 md:max-h-none md:min-h-0 md:flex-1 md:p-4"
            >
              <h3 className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Moves
              </h3>
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1 text-sm leading-relaxed">
                {state.tree.root.initialComment && (
                  <span className="mr-2 italic text-neutral-600 dark:text-neutral-400">
                    {state.tree.root.initialComment}
                  </span>
                )}
                <Line
                  parent={state.tree.root}
                  nodes={state.tree.root.children}
                  currentNodeId={currentNodeId}
                  onSelect={(id) => setCurrentNodeId(id)}
                  forceNumber={Boolean(state.tree.root.initialComment)}
                />
              </div>
            </div>

            <Banner
              className="viewer-mobile-banner order-3 md:hidden"
              {...(state.submitter ? { submitter: state.submitter } : {})}
              {...(state.description ? { description: state.description } : {})}
            />

            <div className="viewer-copy-mobile order-4 flex gap-2 md:hidden">
              <button
                onClick={() => copyToClipboard(state.pgn, 'pgn')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none dark:ring-1 dark:ring-white/10 dark:hover:bg-neutral-800"
                aria-label="Copy PGN"
              >
                {copiedPgn ? (
                  <>
                    <Check size={16} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy PGN</span>
                  </>
                )}
              </button>
              <button
                onClick={() => copyToClipboard(currentFen, 'fen')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none dark:ring-1 dark:ring-white/10 dark:hover:bg-neutral-800"
                aria-label="Copy current FEN"
              >
                {copiedFen ? (
                  <>
                    <Check size={16} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy FEN</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <Banner
            className="viewer-mobile-banner md:hidden"
            {...(state.submitter ? { submitter: state.submitter } : {})}
            {...(state.description ? { description: state.description } : {})}
          />
        )}
      </div>
    </div>
  );
}

type BannerProps = {
  description?: string;
  errorMessage?: string;
  submitter?: PgnSubmitter;
  className?: string;
};

function submitterLabel(submitter: PgnSubmitter | undefined): string {
  const username = submitter?.username.trim().replace(/^u\//i, '');
  return username ? `u/${username}` : '';
}

function Banner({
  description,
  errorMessage,
  submitter,
  className = '',
}: BannerProps) {
  const submitterText = submitterLabel(submitter);

  if (!description && !errorMessage && !submitterText) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {errorMessage && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="break-words">{errorMessage}</p>
        </div>
      )}
      {(description || submitterText) && (
        <div className="rounded-lg bg-white px-4 py-3 text-sm text-neutral-700 shadow dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none dark:ring-1 dark:ring-white/10">
          {description && (
            <p className="whitespace-pre-wrap break-words">{description}</p>
          )}
          {submitterText && (
            <p
              className={`break-words text-[11px] leading-snug text-neutral-400 dark:text-neutral-600 ${
                description ? 'mt-2' : ''
              }`}
            >
              submitted by {submitterText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

type LineProps = {
  parent: TreeNode | TreeRoot;
  nodes: TreeNode[];
  currentNodeId: number;
  onSelect: (id: number) => void;
  forceNumber?: boolean;
  inVariation?: boolean;
};

function Line({
  parent,
  nodes,
  currentNodeId,
  onSelect,
  forceNumber = false,
  inVariation = false,
}: LineProps) {
  if (nodes.length === 0) return null;

  const mainline = nodes[0]!;
  const altVariations = nodes.slice(1);

  const isWhite = mainline.ply % 2 === 1;
  const moveNumber = Math.ceil(mainline.ply / 2);

  const parentHadInterruption =
    forceNumber ||
    Boolean(parent.id === 0 ? (parent as TreeRoot).initialComment : false);
  const showNumber =
    isWhite || parentHadInterruption || Boolean(mainline.commentBefore);
  const numberLabel = isWhite ? `${moveNumber}.` : `${moveNumber}...`;

  const continuationNodes = mainline.children;

  return (
    <Fragment>
      {mainline.commentBefore && (
        <span className="mx-1 italic text-neutral-600 dark:text-neutral-400">
          {mainline.commentBefore}
        </span>
      )}
      {showNumber && (
        <span
          className={`text-neutral-500 dark:text-neutral-400 ${isWhite ? 'ml-1' : ''}`}
        >
          {numberLabel}
        </span>
      )}
      <button
        data-node-id={mainline.id}
        onClick={() => onSelect(mainline.id)}
        className={`rounded px-1.5 py-0.5 ${
          currentNodeId === mainline.id
            ? 'bg-blue-100 font-semibold text-blue-900 dark:bg-blue-900 dark:text-blue-100'
            : inVariation
              ? 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              : 'text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800'
        }`}
      >
        {mainline.san}
        {mainline.nag && <span className="ml-0.5">{mainline.nag}</span>}
      </button>
      {mainline.commentAfter && (
        <span className="mx-1 italic text-neutral-600 dark:text-neutral-400">
          {mainline.commentAfter}
        </span>
      )}
      {altVariations.map((v) => (
        <span
          key={v.id}
          className="mx-1 text-neutral-600 dark:text-neutral-400"
        >
          (
          <Line
            parent={parent}
            nodes={[v]}
            currentNodeId={currentNodeId}
            onSelect={onSelect}
            forceNumber
            inVariation
          />
          )
        </span>
      ))}
      {continuationNodes.length > 0 && (
        <Line
          parent={mainline}
          nodes={continuationNodes}
          currentNodeId={currentNodeId}
          onSelect={onSelect}
          forceNumber={Boolean(
            mainline.commentAfter || altVariations.length > 0
          )}
          inVariation={inVariation}
        />
      )}
    </Fragment>
  );
}
