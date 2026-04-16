// Checkers AI Logic

import {
  type GameState,
  type Move,
  type Player,
  getAllLegalMoves,
  applyMove,
} from './checkers-logic';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

// interface MoveScore {
//   move: Move;
//   score: number;
// }

// Main AI function - returns the best move for the current player
export function getAIMove(gameState: GameState, difficulty: AIDifficulty = 'medium'): Move | null {
  // Validate game state
  if (!gameState?.status || gameState.status !== 'active') {
    console.warn('AI: Invalid game state - not active');
    return null;
  }

  // Additional board validation
  if (!gameState.board?.length || gameState.board.length !== 8) {
    console.warn('AI: Invalid board structure');
    return null;
  }

  // Check if current player has any pieces on the board
  const currentPlayerPieces = gameState.board.flatMap((row, r) => 
    row.map((piece, c) => piece?.player === gameState.currentPlayer ? {piece, pos: `${r},${c}`} : null)
  ).filter(Boolean);
  
  if (currentPlayerPieces.length === 0) {
    console.warn(`AI: No pieces found for current player: ${gameState.currentPlayer}`);
    return null;
  }

  console.log(`AI (${gameState.currentPlayer}): Found ${currentPlayerPieces.length} pieces on board`);

  const legalMoves = getAllLegalMoves(gameState);
  if (legalMoves.length === 0) {
    console.warn('AI: No legal moves available');
    return null;
  }

  // Validate that all legal moves have valid pieces
  const validMoves = legalMoves.filter(move => {
    const piece = gameState.board[move.from.row]?.[move.from.col];
    const isValidPiece = piece?.player === gameState.currentPlayer;
    
    if (!isValidPiece) {
      console.warn('AI: Found invalid move with no piece at source:', {
        move,
        piece,
        currentPlayer: gameState.currentPlayer
      });
    }
    
    return isValidPiece;
  });

  if (validMoves.length === 0) {
    console.warn('AI: No valid moves after filtering');
    return null;
  }

  let selectedMove: Move | null = null;

  switch (difficulty) {
    case 'easy':
      selectedMove = getRandomMove(validMoves);
      break;
    case 'medium':
      selectedMove = getMediumMove(gameState, validMoves);
      break;
    case 'hard':
      selectedMove = getHardMove(gameState, validMoves);
      break;
    default:
      selectedMove = getMediumMove(gameState, validMoves);
  }

  // Final validation before returning the move
  if (selectedMove) {
    const piece = gameState.board[selectedMove.from.row]?.[selectedMove.from.col];
    if (!piece?.player || piece.player !== gameState.currentPlayer) {
      console.error('AI: Generated invalid move - no piece at source position', {
        move: selectedMove,
        piece,
        currentPlayer: gameState.currentPlayer,
        boardAtPosition: gameState.board[selectedMove.from.row]?.[selectedMove.from.col]
      });
      return null;
    }
  }

  return selectedMove;
}

// Easy AI - Random moves
function getRandomMove(legalMoves: Move[]): Move {
  const randomIndex = Math.floor(Math.random() * legalMoves.length);
  return legalMoves[randomIndex]!;
}

// Medium AI - Basic strategy
function getMediumMove(gameState: GameState, legalMoves: Move[]): Move {
  const scoredMoves = legalMoves.map(move => ({
    move,
    score: evaluateMove(gameState, move),
  }));

  // Sort by score (highest first)
  scoredMoves.sort((a, b) => b.score - a.score);

  // Add some randomness - pick from top 3 moves
  const topMoves = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
  const randomIndex = Math.floor(Math.random() * topMoves.length);
  return topMoves[randomIndex]!.move;
}

// Hard AI - Minimax with limited depth
function getHardMove(gameState: GameState, legalMoves: Move[]): Move {
  const depth = 3; // Look ahead 3 moves
  let bestMove = legalMoves[0]!;
  let bestScore = -Infinity;

  for (const move of legalMoves) {
    const newState = applyMove(gameState, move);
    const score = minimax(newState, depth - 1, -Infinity, Infinity, false, gameState.currentPlayer);
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// Minimax algorithm with alpha-beta pruning
function minimax(
  gameState: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiPlayer: Player
): number {
  // Base cases
  if (depth === 0 || gameState.status === 'finished') {
    return evaluatePosition(gameState, aiPlayer);
  }

  const legalMoves = getAllLegalMoves(gameState);
  if (legalMoves.length === 0) {
    // No moves available - game over
    const winner = gameState.currentPlayer === aiPlayer ? 'opponent' : 'ai';
    return winner === 'ai' ? 1000 : -1000;
  }

  if (isMaximizing) {
    let maxScore = -Infinity;
    for (const move of legalMoves) {
      const newState = applyMove(gameState, move);
      const score = minimax(newState, depth - 1, alpha, beta, false, aiPlayer);
      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break; // Alpha-beta pruning
    }
    return maxScore;
  } else {
    let minScore = Infinity;
    for (const move of legalMoves) {
      const newState = applyMove(gameState, move);
      const score = minimax(newState, depth - 1, alpha, beta, true, aiPlayer);
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break; // Alpha-beta pruning
    }
    return minScore;
  }
}

// Evaluate a single move
function evaluateMove(gameState: GameState, move: Move): number {
  let score = 0;

  // Prioritize captures
  score += move.capturedPieces.length * 10;

  // Prioritize king promotion
  if (move.type === 'king_promotion') {
    score += 5;
  }

  // Prefer moving pieces toward the center
  const centerDistance = Math.abs(3.5 - move.to.row) + Math.abs(3.5 - move.to.col);
  score += (7 - centerDistance) * 0.5;

  // Prefer advancing pieces
  const currentPlayer = gameState.currentPlayer;
  if (currentPlayer === 'red') {
    score += (7 - move.to.row) * 0.3; // Red moves up (toward row 0)
  } else {
    score += move.to.row * 0.3; // Black moves down (toward row 7)
  }

  return score;
}

// Evaluate the entire board position
function evaluatePosition(gameState: GameState, aiPlayer: Player): number {
  if (gameState.status === 'finished') {
    if (gameState.winner === aiPlayer) return 1000;
    if (gameState.winner === (aiPlayer === 'red' ? 'black' : 'red')) return -1000;
    return 0; // Draw (shouldn't happen in checkers)
  }

  let score = 0;
  const board = gameState.board;

  // Count pieces and evaluate positions
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row]?.[col];
      if (!piece) continue;

      const isAIPiece = piece.player === aiPlayer;
      const pieceValue = piece.type === 'king' ? 5 : 3;
      const positionValue = getPositionValue(row, col, piece.player);

      if (isAIPiece) {
        score += pieceValue + positionValue;
      } else {
        score -= pieceValue + positionValue;
      }
    }
  }

  // Evaluate mobility (number of legal moves)
  const aiMoves = gameState.currentPlayer === aiPlayer 
    ? getAllLegalMoves(gameState).length 
    : 0;
  const opponentGameState = { ...gameState, currentPlayer: aiPlayer === 'red' ? 'black' : 'red' as Player };
  const opponentMoves = getAllLegalMoves(opponentGameState).length;
  
  score += (aiMoves - opponentMoves) * 0.1;

  return score;
}

// Get positional value for a piece
function getPositionValue(row: number, col: number, player: Player): number {
  let score = 0;

  // Prefer center positions
  const centerDistance = Math.abs(3.5 - row) + Math.abs(3.5 - col);
  score += (7 - centerDistance) * 0.1;

  // Prefer advanced positions
  if (player === 'red') {
    score += (7 - row) * 0.1; // Red advances toward row 0
  } else {
    score += row * 0.1; // Black advances toward row 7
  }

  // Prefer edge positions for defense (slightly)
  if (row === 0 || row === 7 || col === 0 || col === 7) {
    score += 0.2;
  }

  return score;
}

// Check if it's time for AI to move
export function shouldAIMakeMove(gameState: GameState, aiPlayer: Player): boolean {
  return gameState.status === 'active' && 
         gameState.currentPlayer === aiPlayer && 
         !gameState.mustContinueCapture; // Let human complete multi-jumps
}

// Simulate AI thinking time (for UX)
export async function makeAIMoveWithDelay(
  gameState: GameState, 
  difficulty: AIDifficulty = 'medium',
  minDelay = 500,
  maxDelay = 1500
): Promise<Move | null> {
  const delay = minDelay + Math.random() * (maxDelay - minDelay);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getAIMove(gameState, difficulty));
    }, delay);
  });
}