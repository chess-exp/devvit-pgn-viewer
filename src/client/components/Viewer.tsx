import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
import type { PgnApiResponse, PgnHeaders } from '../../shared/pgn';
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
      description?: string;
    };

export function Viewer() {
  const [state, setState] = useState<ViewerState>({ status: 'loading' });
  const [currentNodeId, setCurrentNodeId] = useState<number>(0);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(
    'white'
  );
  const [copiedPgn, setCopiedPgn] = useState(false);
  const [copiedFen, setCopiedFen] = useState(false);
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
          setState({
            status: 'ready',
            pgn: data.pgn,
            headers: data.headers,
            tree,
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

  useEffect(() => {
    rootRef.current?.focus();
  }, [tree]);

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
      <div className="flex h-screen items-center justify-center text-neutral-700 dark:text-neutral-300">
        <p>Loading game...</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex h-screen flex-col p-4 sm:p-6">
        <Banner
          errorMessage={state.message}
          {...(state.description ? { description: state.description } : {})}
        />
        <div className="mt-4 flex min-h-0 flex-1 items-start justify-center">
          <div
            style={{
              width: '100%',
              maxWidth: 'min(80vh, 600px)',
              aspectRatio: '1 / 1',
            }}
          >
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
    );
  }

  if (!currentNode) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-700 dark:text-neutral-300">
        <p>Loading game...</p>
      </div>
    );
  }

  const currentPly = currentNode.id === 0 ? 0 : (currentNode as TreeNode).ply;

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
      className="flex h-screen flex-col p-4 outline-none sm:p-6"
    >
      <Banner {...(state.description ? { description: state.description } : {})} />
      <div className="mt-4 flex min-h-0 flex-1 flex-col sm:flex-row sm:items-start sm:justify-center sm:gap-6 first:mt-0">
        <div className="flex flex-col gap-4">
          <div
            className="flex-shrink-0"
            style={{
              width: '100%',
              maxWidth: 'min(80vh, 600px)',
              aspectRatio: '1 / 1',
            }}
          >
            <Chessboard
              options={{
                position: currentFen,
                boardOrientation,
                allowDragging: false,
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(state.pgn, 'pgn')}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none dark:ring-1 dark:ring-white/10 dark:hover:bg-neutral-800"
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
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none dark:ring-1 dark:ring-white/10 dark:hover:bg-neutral-800"
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

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 sm:mt-0 sm:max-h-[calc(100vh-3rem)] sm:w-80 sm:flex-initial">
        <div className="rounded-lg bg-white p-4 shadow dark:bg-neutral-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
          <h2 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {state.headers.white ?? 'White'} vs {state.headers.black ?? 'Black'}
          </h2>
          {state.headers.event && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{state.headers.event}</p>
          )}
          {state.headers.date && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{state.headers.date}</p>
          )}
          {state.headers.result && (
            <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Result: {state.headers.result}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-1 rounded-lg bg-white p-2 shadow dark:bg-neutral-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
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

        <div
          ref={movesPanelRef}
          className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-white p-4 shadow dark:bg-neutral-900 dark:shadow-none dark:ring-1 dark:ring-white/10"
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
      </div>
      </div>
    </div>
  );
}

type BannerProps = {
  description?: string;
  errorMessage?: string;
};

function Banner({ description, errorMessage }: BannerProps) {
  if (!description && !errorMessage) return null;
  return (
    <div className="flex flex-col gap-2">
      {errorMessage && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="break-words">{errorMessage}</p>
        </div>
      )}
      {description && (
        <div className="rounded-lg bg-white px-4 py-3 text-sm text-neutral-700 shadow dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none dark:ring-1 dark:ring-white/10">
          <p className="whitespace-pre-wrap break-words">{description}</p>
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

  const parentHadInterruption = forceNumber || Boolean(parent.id === 0 ? (parent as TreeRoot).initialComment : false);
  const showNumber = isWhite || parentHadInterruption || Boolean(mainline.commentBefore);
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
        <span className={`text-neutral-500 dark:text-neutral-400 ${isWhite ? 'ml-1' : ''}`}>
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
