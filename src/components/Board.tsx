import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { getPieceSymbol, getPieceColor } from '../lib/chess';

interface BoardProps {
  fen: string;
  sideToMove: 'w' | 'b';
  onMove: (from: string, to: string, promotion?: string) => void;
  theme: string;
  boardTheme: string;
  showLegalMoves: boolean;
  legalMoves: string[];
  lastMove?: { from: string; to: string } | null;
  orientation?: 'white' | 'black';
}

const fileLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const rankLabels = ['8', '7', '6', '5', '4', '3', '2', '1'];

const Board = ({ fen, sideToMove, onMove, theme, boardTheme, showLegalMoves, legalMoves, lastMove, orientation = 'white' }: BoardProps) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [showCheckAlert, setShowCheckAlert] = useState(false);

  const board = useMemo(() => {
    const rows = fen.split(' ')[0].split('/');
    const boardArray: Array<Array<string | null>> = [];
    rows.forEach((row) => {
      const cells: Array<string | null> = [];
      for (const char of row) {
        if (/\d/.test(char)) {
          for (let i = 0; i < Number(char); i += 1) cells.push(null);
        } else {
          cells.push(char);
        }
      }
      boardArray.push(cells);
    });
    return boardArray;
  }, [fen]);

  const orderedSquares = useMemo(() => {
    const squares = [] as string[];
    const rows = orientation === 'white' ? rankLabels : [...rankLabels].reverse();
    const cols = orientation === 'white' ? fileLabels : [...fileLabels].reverse();
    for (const rank of rows) {
      for (const file of cols) {
        squares.push(`${file}${rank}`);
      }
    }
    return squares;
  }, [orientation]);

  const isCheckPosition = useMemo(() => {
    const chess = new Chess(fen);
    return chess.isCheck();
  }, [fen]);

  useEffect(() => {
    setShowCheckAlert(isCheckPosition);
  }, [isCheckPosition]);

  const isLightSquare = (square: string) => {
    const fileIndex = fileLabels.indexOf(square[0]);
    const rankIndex = Number(square[1]) - 1;
    return (fileIndex + rankIndex) % 2 === 0;
  };

  const handleSquareClick = (square: string) => {
    setShowCheckAlert(false);
    const piece = getPieceAt(square);
    const isPieceOwnedByPlayer = (p: string | null): boolean => {
      if (!p) return false;
      const isWhitePiece = p === p.toUpperCase();
      return (isWhitePiece && sideToMove === 'w') || (!isWhitePiece && sideToMove === 'b');
    };

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }
      const from = selectedSquare;
      const to = square;
      const matchingMoves = legalMoves.filter((legalMove) => legalMove.startsWith(`${from}${to}`));
      if (matchingMoves.length) {
        const promotionMove = matchingMoves.find((legalMove) => legalMove.length === 5 && legalMove.endsWith('q'))
          ?? matchingMoves.find((legalMove) => legalMove.length === 5);
        const promotion = promotionMove?.length === 5 ? promotionMove[4] : undefined;
        onMove(from, to, promotion);
      } else if (isPieceOwnedByPlayer(piece)) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
      return;
    }
    if (isPieceOwnedByPlayer(piece)) {
      setSelectedSquare(square);
    }
  };

  const getPieceAt = (square: string) => {
    const rowIndex = Number(square[1]) - 1;
    const fileIndex = fileLabels.indexOf(square[0]);
    return board[7 - rowIndex]?.[fileIndex] ?? null;
  };

  return (
    <div className={`board-surface ${theme}`}>
      <div className={`board-grid ${boardTheme}`}>
        {orderedSquares.map((square) => {
          const piece = getPieceAt(square);
          const selectedPiece = selectedSquare ? getPieceAt(selectedSquare) : null;
          const isSelected = square === selectedSquare;
          const isLastMove = lastMove?.from === square || lastMove?.to === square;
          const isLegalTarget = Boolean(selectedSquare && showLegalMoves && legalMoves.some((move) => move.startsWith(selectedSquare) && move.slice(2, 4) === square));
          const isCapture = Boolean(isLegalTarget && piece && selectedPiece && getPieceColor(piece) !== getPieceColor(selectedPiece));
          return (
            <button
              key={square}
              type="button"
              className={`square ${isLightSquare(square) ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isLastMove ? 'last-move' : ''}`}
              onClick={() => handleSquareClick(square)}
            >
              {piece ? <span className={`piece piece-${getPieceColor(piece)}`}>{getPieceSymbol(piece)}</span> : null}
              {isLegalTarget && !piece ? <span className="move-dot" /> : null}
              {isCapture ? <span className="move-dot capture" /> : null}
            </button>
          );
        })}
      </div>
      {showCheckAlert ? (
        <div className="check-overlay" role="status" aria-live="polite">
          <span>CHECK</span>
        </div>
      ) : null}
    </div>
  );
};


export default Board;
