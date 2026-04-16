"use client";

import React from 'react';
import { type GameState, type Player } from '@/lib/checkers-logic';

// Database player type that matches what we get from the API
type DbPlayer = {
  id: string;
  name: string | null;
  email: string;
};

interface GameInfoProps {
  gameState: GameState;
  player1?: DbPlayer | null;
  player2?: DbPlayer | null;
  currentUserId?: string;
  _currentUserId?: string;
  playerColor?: 'red' | 'black';
  gameStatus?: string;
  isMyTurn?: boolean;
  isAITurn?: boolean;
  isWaitingForAI?: boolean;
  gameMode?: string;
  _gameMode?: string;
  moveHistory?: Array<{
    moveNumber: number;
    player: Player;
    from: string;
    to: string;
    captured?: string[];
  }>;
}

export function GameInfo({
  gameState,
  player1,
  player2,
  _currentUserId,
  playerColor,
  gameStatus,
  isMyTurn,
  isAITurn,
  isWaitingForAI,
  _gameMode,
  moveHistory = [],
}: GameInfoProps) {
  const getPlayerName = (player?: DbPlayer | null, fallbackLabel?: string) => {
    if (!player) return fallbackLabel ?? 'Unknown';
    return player.name ?? player.email ?? fallbackLabel ?? 'Unknown';
  };

  const getPieceCount = (player: Player) => {
    let normal = 0;
    let kings = 0;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row]?.[col];
        if (piece?.player === player) {
          if (piece.type === 'king') kings++;
          else normal++;
        }
      }
    }
    
    return { normal, kings, total: normal + kings };
  };

  const redPieces = getPieceCount('red');
  const blackPieces = getPieceCount('black');

  // const formatPosition = (row: number, col: number): string => {
  //   const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  //   return `${letters[col]}${8 - row}`;
  // };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      {/* Players */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Players</h3>
        
      {/* Turn Notification - Fixed height container */}
      <div className="h-16"> {/* Fixed height to prevent layout shift */}
        {gameStatus === 'in_progress' && (
          <>
            {isMyTurn && !isAITurn && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-green-400 text-lg">🎯</span>
                  </div>
                  <div className="ml-2">
                    <h4 className="text-sm font-medium text-green-800">
                      Your turn!
                    </h4>
                    <p className="text-xs text-green-700 mt-1">
                      Make your move by selecting and moving your pieces.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isAITurn && isWaitingForAI && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-blue-400 text-lg animate-bounce">🐦</span>
                  </div>
                  <div className="ml-2">
                    <h4 className="text-sm font-medium text-blue-800">
                      Hank&apos;s turn
                    </h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Hank is thinking...
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {gameState.mustContinueCapture && (
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-orange-400 text-lg">⚡</span>
                  </div>
                  <div className="ml-2">
                    <h4 className="text-sm font-medium text-orange-800">
                      Multiple Capture!
                    </h4>
                    <p className="text-xs text-orange-700 mt-1">
                      You must continue capturing with the same piece
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
        
        {/* Red Player */}
        <div className={`flex items-center space-x-3 p-3 rounded-md ${
          gameState.currentPlayer === 'red' && gameState.status === 'active' 
            ? 'bg-red-50 border-2 border-red-200' 
            : 'bg-gray-50'
        }`}>
          <div className="w-4 h-4 bg-red-600 rounded-full"></div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">
              {getPlayerName(player1, 'Player 1')}
              {playerColor === 'red' && ' (You)'}
            </div>
            <div className="text-sm text-gray-500">
              {redPieces.total} pieces ({redPieces.kings} kings)
            </div>
          </div>
          {gameState.currentPlayer === 'red' && gameState.status === 'active' && (
            <div className="text-sm font-medium text-red-600">
              Current turn
            </div>
          )}
        </div>

        {/* Black Player */}
        <div className={`flex items-center space-x-3 p-3 rounded-md ${
          gameState.currentPlayer === 'black' && gameState.status === 'active' 
            ? 'bg-gray-100 border-2 border-gray-300' 
            : 'bg-gray-50'
        }`}>
          <div className="w-4 h-4 bg-gray-800 rounded-full"></div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">
              {getPlayerName(player2, 'Player 2')}
              {playerColor === 'black' && ' (You)'}
            </div>
            <div className="text-sm text-gray-500">
              {blackPieces.total} pieces ({blackPieces.kings} kings)
            </div>
          </div>
          {gameState.currentPlayer === 'black' && gameState.status === 'active' && (
            <div className="text-sm font-medium text-gray-800">
              Current turn
            </div>
          )}
        </div>
      </div>

      {/* Game Status */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">Game Status</h3>
        
        <div className="space-y-2">
          {gameState.status === 'finished' && gameState.winner && (
            <div className={`p-3 rounded-md ${
              gameState.winner === 'red' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
            }`}>
              <div className="font-medium">
                🏆 {gameState.winner === 'red' ? 'Red' : 'Black'} wins!
              </div>
            </div>
          )}
          
          {gameState.status === 'active' && (
            <div className="space-y-1">
              {isMyTurn && (
                <div className="p-2 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                  It&apos;s your turn!
                </div>
              )}
              
              {gameState.mustContinueCapture && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <span className="text-orange-400 text-lg">⚡</span>
                    </div>
                    <div className="ml-2">
                      <h4 className="text-sm font-medium text-orange-800">
                        Multiple Capture!
                      </h4>
                      <p className="text-xs text-orange-700 mt-1">
                        You must continue capturing with the same piece
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Move History */}
      {moveHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Move History</h3>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {moveHistory.slice(-15).reverse().map((move, index) => (
              <div
                key={`${move.moveNumber}-${index}`}
                className={`flex items-center space-x-2 text-sm p-2 rounded ${
                  index === 0 ? 'bg-blue-100 border border-blue-200' : 'bg-gray-50'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${
                  move.player === 'red' ? 'bg-red-600' : 'bg-gray-800'
                }`}></div>
                <div className="flex-1">
                  <span className="font-medium">Move {move.moveNumber}:</span>
                  <span className="ml-1">{move.from} → {move.to}</span>
                  {move.captured && move.captured.length > 0 && (
                    <span className="ml-1 text-red-600">
                      (captured {move.captured.join(', ')})
                    </span>
                  )}
                  {index === 0 && (
                    <span className="ml-2 text-xs text-blue-600 font-medium">
                      (Latest)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game Rules Summary */}
      <div className="space-y-2">
        <details className="group">
          <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
            Rules Summary
          </summary>
          <div className="mt-2 text-sm text-gray-600 space-y-2">
            <p>• Pieces move diagonally on dark squares</p>
            <p>• Normal pieces can only move forward</p>
            <p>• Kings can move in any diagonal direction</p>
            <p>• Captures are mandatory when available</p>
            <p>• Multiple captures in one turn are required if possible</p>
            <p>• Pieces reaching the opposite end become kings</p>
            <p>• Win by capturing all opponent pieces or blocking all moves</p>
          </div>
        </details>
      </div>
    </div>
  );
}