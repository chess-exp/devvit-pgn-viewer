import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCw,
} from 'lucide-react';
import type { PgnApiResponse, PgnHeaders } from '../../shared/pgn';

type ViewerState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; pgn: string; headers: PgnHeaders; plyCount: number };

export function Viewer() {
  const [state, setState] = useState<ViewerState>({ status: 'loading' });
  const [chess] = useState(() => new Chess());
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(
    'white'
  );

  useEffect(() => {
    fetch('/api/pgn')
      .then((res) => res.json())
      .then((data: PgnApiResponse) => {
        if (data.status === 'error') {
          setState({ status: 'error', message: data.message });
          return;
        }
        chess.loadPgn(data.pgn);
        setState({
          status: 'ready',
          pgn: data.pgn,
          headers: data.headers,
          plyCount: data.plyCount,
        });
      })
      .catch((err) => {
        console.error('Failed to load PGN:', err);
        setState({
          status: 'error',
          message: 'Failed to load game data',
        });
      });
  }, [chess]);

  if (state.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 text-neutral-700">
        <p>Loading game...</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 text-red-600">
        <p>{state.message}</p>
      </div>
    );
  }

  const history = chess.history({ verbose: true });
  const totalMoves = history.length;

  const goToMove = (index: number) => {
    chess.reset();
    for (let i = 0; i <= index; i++) {
      chess.move(history[i]!);
    }
    setCurrentMoveIndex(index);
  };

  const goToStart = () => {
    chess.reset();
    setCurrentMoveIndex(-1);
  };

  const goToPrevious = () => {
    if (currentMoveIndex >= 0) {
      goToMove(currentMoveIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentMoveIndex < totalMoves - 1) {
      goToMove(currentMoveIndex + 1);
    }
  };

  const goToEnd = () => {
    goToMove(totalMoves - 1);
  };

  const toggleOrientation = () => {
    setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
  };

  return (
    <div className="flex h-screen flex-col bg-neutral-50 p-4 md:flex-row md:items-start md:justify-center md:gap-4 md:p-8">
      <div className="flex-shrink-0" style={{ maxWidth: '600px', width: '100%' }}>
        <Chessboard
          options={{
            position: chess.fen(),
            boardOrientation,
            allowDragging: false,
          }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4 md:mt-0 md:w-80">
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-2 text-lg font-semibold text-neutral-900">
            {state.headers.white ?? 'White'} vs {state.headers.black ?? 'Black'}
          </h2>
          {state.headers.event && (
            <p className="text-sm text-neutral-600">{state.headers.event}</p>
          )}
          {state.headers.date && (
            <p className="text-sm text-neutral-500">{state.headers.date}</p>
          )}
          {state.headers.result && (
            <p className="mt-2 text-sm font-medium text-neutral-700">
              Result: {state.headers.result}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 shadow">
          <button
            onClick={goToStart}
            disabled={currentMoveIndex < 0}
            className="rounded p-2 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Go to start"
          >
            <ChevronsLeft size={20} />
          </button>
          <button
            onClick={goToPrevious}
            disabled={currentMoveIndex < 0}
            className="rounded p-2 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Previous move"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm text-neutral-600">
            {currentMoveIndex + 1} / {totalMoves}
          </span>
          <button
            onClick={goToNext}
            disabled={currentMoveIndex >= totalMoves - 1}
            className="rounded p-2 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Next move"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={goToEnd}
            disabled={currentMoveIndex >= totalMoves - 1}
            className="rounded p-2 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Go to end"
          >
            <ChevronsRight size={20} />
          </button>
          <button
            onClick={toggleOrientation}
            className="ml-2 rounded p-2 hover:bg-neutral-100"
            aria-label="Flip board"
          >
            <RotateCw size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">
            Moves
          </h3>
          <div className="space-y-1">
            {Array.from({ length: Math.ceil(totalMoves / 2) }, (_, i) => {
              const whiteIndex = i * 2;
              const blackIndex = whiteIndex + 1;
              const whiteMove = history[whiteIndex];
              const blackMove = history[blackIndex];

              return (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="w-8 text-neutral-500">{i + 1}.</span>
                  <button
                    onClick={() => goToMove(whiteIndex)}
                    className={`flex-1 rounded px-2 py-1 text-left hover:bg-neutral-100 ${
                      currentMoveIndex === whiteIndex
                        ? 'bg-blue-100 font-semibold text-blue-900'
                        : 'text-neutral-900'
                    }`}
                  >
                    {whiteMove?.san}
                  </button>
                  {blackMove && (
                    <button
                      onClick={() => goToMove(blackIndex)}
                      className={`flex-1 rounded px-2 py-1 text-left hover:bg-neutral-100 ${
                        currentMoveIndex === blackIndex
                          ? 'bg-blue-100 font-semibold text-blue-900'
                          : 'text-neutral-900'
                      }`}
                    >
                      {blackMove.san}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
