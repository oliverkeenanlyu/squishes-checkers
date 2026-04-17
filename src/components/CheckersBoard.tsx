"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { CheckersPiece } from './CheckersPiece';
import {
  type GameState,
  type Position,
  type Move,
  createInitialGameState,
  getAllLegalMoves,
  applyMove,
  isValidMove,
  getPiecesWithMandatoryCaptures,
  isDarkSquare as isPositionDarkSquare,
} from '@/lib/checkers-logic';

interface CheckersBoardProps {
  gameState?: GameState;
  onMove?: (move: Move) => void;
  onGameStateChange?: (gameState: GameState) => void;
  isPlayerTurn?: boolean;
  playerColor?: 'red' | 'black';
  disabled?: boolean;
  lastMove?: (Move & { isOpponentMove?: boolean }) | null;
}

export function CheckersBoard({
  gameState: externalGameState,
  onMove,
  onGameStateChange,
  isPlayerTurn = true,
  playerColor,
  disabled = false,
  lastMove: externalLastMove,
}: CheckersBoardProps) {
  const [internalGameState, setInternalGameState] = useState<GameState>(createInitialGameState());
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Move[]>([]);
  // const [highlightedPositions, setHighlightedPositions] = useState<Position[]>([]);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [animatingPositions, setAnimatingPositions] = useState<Position[]>([]);

  // Use external game state if provided, otherwise use internal state
  const gameState: GameState = externalGameState ?? internalGameState;
  const isLocalGame = !externalGameState;

  // Update possible moves when selection or game state changes
  useEffect(() => {
    if (selectedPosition) {
      const moves = getAllLegalMoves(gameState).filter(move =>
        move.from.row === selectedPosition.row && move.from.col === selectedPosition.col
      );
      console.log('🎯 Selected piece at', selectedPosition, 'has', moves.length, 'possible moves');
      
      // Log details of each move, especially multi-captures
      moves.forEach((move, i) => {
        const captureCount = move.capturedPieces.length;
        console.log(`🎯 Move ${i + 1}: ${move.from.row},${move.from.col} → ${move.to.row},${move.to.col}`, 
          captureCount > 0 ? `(captures ${captureCount} pieces: ${move.capturedPieces.map(p => `${p.row},${p.col}`).join(', ')})` : '(normal move)');
      });
      
      console.log('🎯 Game state mustContinueCapture:', gameState.mustContinueCapture);
      setPossibleMoves(moves);
      
      // Don't highlight possible destinations - let player figure it out
    } else {
      setPossibleMoves([]);
    }
  }, [selectedPosition, gameState, gameState.mustContinueCapture]);

  // Log game state changes for debugging
  useEffect(() => {
    console.log('🎮 Game state changed:', {
      currentPlayer: gameState.currentPlayer,
      mustContinueCapture: gameState.mustContinueCapture,
      status: gameState.status
    });
  }, [gameState.currentPlayer, gameState.mustContinueCapture, gameState.status]);

  // Highlight last move when it changes - show both player and opponent moves
  useEffect(() => {
    if (externalLastMove?.from && externalLastMove.to) {
      console.log('🎯 Highlighting last move:', externalLastMove);
      setLastMove(externalLastMove);
      
      // Longer, smoother animation for moves
      setAnimatingPositions([externalLastMove.from, externalLastMove.to]);
      const timer = setTimeout(() => {
        setAnimatingPositions([]);
      }, 2000); // Extended animation time for better visibility
      
      return () => clearTimeout(timer);
    } else {
      // Clear highlighting when no last move
      setLastMove(null);
      setAnimatingPositions([]);
    }
  }, [externalLastMove?.from?.row, externalLastMove?.from?.col, externalLastMove?.to?.row, externalLastMove?.to?.col]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (disabled) return;
    if (!isPlayerTurn) return;
    if (playerColor && gameState.currentPlayer !== playerColor) return;

    const position: Position = { row, col };
    const piece = gameState.board[row]?.[col] ?? null;

    console.log('🎯 Square clicked:', { row, col, piece: piece?.player, mustContinueCapture: gameState.mustContinueCapture });

    // If no piece is selected
    if (!selectedPosition) {
      // Can only select pieces of the current player
      if (piece?.player === gameState.currentPlayer) {
        // Check if this piece can actually move
        const moves = getAllLegalMoves(gameState).filter(move =>
          move.from.row === row && move.from.col === col
        );
        
        if (moves.length > 0) {
          console.log('✅ Selecting piece with', moves.length, 'legal moves');
          setSelectedPosition(position);
        } else {
          console.log('❌ Piece has no legal moves');
          // Provide visual feedback that this piece cannot move
        }
      }
      return;
    }

    // If the same piece is clicked, deselect
    if (selectedPosition.row === row && selectedPosition.col === col) {
      setSelectedPosition(null);
      return;
    }

    // If another piece of the same player is clicked, change selection
    if (piece?.player === gameState.currentPlayer) {
      // Check if this piece can actually move
      const moves = getAllLegalMoves(gameState).filter(move =>
        move.from.row === row && move.from.col === col
      );
      
      if (moves.length > 0) {
        console.log('✅ Changing selection to piece with', moves.length, 'legal moves');
        setSelectedPosition(position);
      } else {
        console.log('❌ Cannot select piece - no legal moves');
        // Keep current selection if the clicked piece can't move
      }
      return;
    }

    // Try to make a move
    const attemptedMove: Move = {
      from: selectedPosition,
      to: position,
      capturedPieces: [], // Will be filled by validation
      type: 'normal', // Will be determined by validation
    };

    // Find the actual legal move that matches this attempt
    const legalMove = possibleMoves.find(move =>
      move.from.row === selectedPosition.row &&
      move.from.col === selectedPosition.col &&
      move.to.row === row &&
      move.to.col === col
    );

    if (legalMove && isValidMove(gameState, legalMove)) {
      console.log('🚀 Making move:', legalMove);
      console.log('🚀 This move will capture', legalMove.capturedPieces.length, 'pieces:', 
        legalMove.capturedPieces.map(p => `${p.row},${p.col}`).join(', '));
      console.log('🚀 Current game state before move:', {
        currentPlayer: gameState.currentPlayer,
        mustContinueCapture: gameState.mustContinueCapture
      });
      
      // Execute the move
      const newGameState = applyMove(gameState, legalMove);
      
      console.log('🚀 New game state after move:', {
        currentPlayer: newGameState.currentPlayer,
        mustContinueCapture: newGameState.mustContinueCapture,
        status: newGameState.status
      });
      
      if (isLocalGame) {
        setInternalGameState(newGameState);
      }
      
      onMove?.(legalMove);
      onGameStateChange?.(newGameState);
      
      setSelectedPosition(null);
    } else {
      console.log('❌ Invalid move attempted');
      console.log('❌ Legal moves for this piece:', possibleMoves);
      console.log('❌ Attempted move:', attemptedMove);
      // Invalid move, keep selection but give visual feedback
      setSelectedPosition(null);
    }
  }, [
    disabled,
    isPlayerTurn,
    playerColor,
    gameState.currentPlayer,
    gameState.board,
    selectedPosition,
    possibleMoves,
    isLocalGame,
    onMove,
    onGameStateChange,
  ]); // Reduced dependencies for fewer re-renders

  // Check if a position should show as a possible move
  const isPossibleMovePosition = useCallback((_row: number, _col: number): boolean => {
    return false; // Disabled - no hints for player moves
  }, []);

  // Check if a position is part of the last move
  const isLastMovePosition = useCallback((row: number, col: number): boolean => {
    if (!lastMove?.from || !lastMove?.to) return false;
    return (lastMove.from.row === row && lastMove.from.col === col) ||
           (lastMove.to.row === row && lastMove.to.col === col);
  }, [lastMove]);

  // Check if a position is being animated
  const isAnimatingPosition = useCallback((row: number, col: number): boolean => {
    return animatingPositions.some(pos => pos?.row === row && pos?.col === col);
  }, [animatingPositions]);

  // Check if a position should be highlighted for mandatory captures
  const isMandatoryCapturePosition = useCallback((_row: number, _col: number): boolean => {
    return false; // Disabled - no hints for mandatory captures
  }, []);

  // Render the board
  const renderBoard = () => {
    const squares = [];
    
    // Flip board for black player
    const shouldFlipBoard = playerColor === 'black';
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        // If flipping board, reverse the row and column positions
        const actualRow = shouldFlipBoard ? 7 - row : row;
        const actualCol = shouldFlipBoard ? 7 - col : col;
        
        const piece = gameState.board[actualRow]?.[actualCol] ?? null;
        const position = { row: actualRow, col: actualCol };
        const isDark = isPositionDarkSquare(position);
        const isSelected = selectedPosition?.row === actualRow && selectedPosition?.col === actualCol;
        const isLastMove = isLastMovePosition(actualRow, actualCol);
        const isAnimating = isAnimatingPosition(actualRow, actualCol);
        const isPossibleMove = isPossibleMovePosition(actualRow, actualCol);
        const isMandatoryCapture = isMandatoryCapturePosition(actualRow, actualCol);
        
        squares.push(
          <div
            key={`${actualRow}-${actualCol}`}
            className="aspect-square"
            style={{ gridArea: `${row + 1} / ${col + 1}` }}
          >
            <CheckersPiece
              piece={piece}
              isSelected={isSelected}
              isLastMove={isLastMove}
              isAnimating={isAnimating}
              isPossibleMove={isPossibleMove}
              isMandatoryCapture={isMandatoryCapture}
              _isPossibleMove={isPossibleMove}
              _isMandatoryCapture={isMandatoryCapture}
              isDarkSquare={isDark}
              onClick={() => handleSquareClick(actualRow, actualCol)}
            />
          </div>
        );
      }
    }
    
    return squares;
  };

  // Get mandatory capture pieces for highlighting
  const mandatoryCapturePieces = getPiecesWithMandatoryCaptures(gameState);
  const hasMandatoryCaptures = mandatoryCapturePieces.length > 0;

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Game info */}
      <div className="text-center">
        <div className={`text-lg font-semibold ${gameState.currentPlayer === 'red' ? 'text-red-600' : 'text-gray-800'}`}>
          {gameState.status === 'finished' ? (
            <span>Game Over - {gameState.winner} wins!</span>
          ) : (
            <span>{gameState.currentPlayer === 'red' ? 'Red' : 'Black'}&apos;s turn</span>
          )}
        </div>
        
        {hasMandatoryCaptures && gameState.status === 'active' && (
          <div className="text-sm text-amber-600 mt-1">
            Capture required!
          </div>
        )}
        
        {gameState.mustContinueCapture && (
          <div className="text-sm text-blue-600 mt-1">
            Continue capturing with the same piece
          </div>
        )}
      </div>

      {/* Board */}
      <div className="relative">
        <div 
          className="w-auto h-auto xs:w-[300px] xs:h-[300px] sm:w-[512px] sm:h-[512px] grid grid-cols-8 grid-rows-8 gap-0 border-4 border-amber-800 rounded-lg overflow-hidden shadow-2xl bg-amber-200 "
          // style={{ width: '512px', height: '512px' }}
        >
          {renderBoard()}
        </div>
        
        {/* Coordinate labels */}
        <div className="absolute -bottom-8 left-0 right-0 flex justify-around text-sm text-gray-600">
          {(playerColor === 'black' ? ['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'] : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']).map(letter => (
            <span key={letter}>{letter}</span>
          ))}
        </div>
        <div className="absolute top-0 bottom-0 -left-8 flex flex-col justify-around text-sm text-gray-600">
          {(playerColor === 'black' ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1]).map(number => (
            <span key={number}>{number}</span>
          ))}
        </div>
      </div>

      {/* Local game controls */}
      {isLocalGame && (
        <button
          onClick={() => {
            const newGame = createInitialGameState();
            setInternalGameState(newGame);
            setSelectedPosition(null);
            onGameStateChange?.(newGame);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          New Game
        </button>
      )}
    </div>
  );
}