// Checkers Game Logic

export type PieceType = 'normal' | 'king';
export type Player = 'red' | 'black';

export interface Piece {
  player: Player;
  type: PieceType;
}

export type Board = (Piece | null)[][];

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  capturedPieces: Position[];
  type: 'normal' | 'capture' | 'king_promotion';
}

export interface GameState {
  board: Board;
  currentPlayer: Player;
  winner: Player | null;
  status: 'active' | 'finished';
  mustContinueCapture?: Position; // For multi-jump captures
}

// Initialize a new checkers board
export function createInitialBoard(): Board {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null) as (Piece | null)[]) as Board;
  
  // Place black pieces (top 3 rows, on dark squares)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) { // Dark squares only
        const boardRow = board[row];
        if (boardRow) {
          boardRow[col] = { player: 'black', type: 'normal' };
        }
      }
    }
  }
  
  // Place red pieces (bottom 3 rows, on dark squares)
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) { // Dark squares only
        const boardRow = board[row];
        if (boardRow) {
          boardRow[col] = { player: 'red', type: 'normal' };
        }
      }
    }
  }
  
  return board;
}

export function createInitialGameState(): GameState {
  return {
    board: createInitialBoard(),
    currentPlayer: 'red', // Red always starts
    winner: null,
    status: 'active',
  };
}

// Check if a position is valid on the board
export function isValidPosition(pos: Position): boolean {
  return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
}

// Check if a position is on a dark square (where pieces can be placed)
export function isDarkSquare(pos: Position): boolean {
  return (pos.row + pos.col) % 2 === 1;
}

// Get all possible moves for a specific piece
export function getPossibleMovesForPiece(
  board: Board,
  position: Position,
  mustContinueCapture?: Position
): Move[] {
  const piece = board[position.row]?.[position.col];
  if (!piece) return [];

  // If we must continue a capture, only that piece can move
  if (mustContinueCapture && 
      (mustContinueCapture.row !== position.row || mustContinueCapture.col !== position.col)) {
    return [];
  }

  const moves: Move[] = [];
  
  // Get both capture and normal moves - player can choose!
  const captures = getCaptureMovesForPiece(board, position);
  const normalMoves = getNormalMovesForPiece(board, position, piece);
  
  // Allow both captures and normal moves for more strategic gameplay
  moves.push(...captures);
  moves.push(...normalMoves);

  return moves;
}

// Get normal (non-capture) moves for a piece
function getNormalMovesForPiece(board: Board, position: Position, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions = getDirectionsForPiece(piece, position);

  for (const direction of directions) {
    const newRow = position.row + direction.row;
    const newCol = position.col + direction.col;
    const newPos = { row: newRow, col: newCol };

    if (isValidPosition(newPos) && 
        isDarkSquare(newPos) && 
        (board[newRow]?.[newCol] ?? null) === null) {
      
      const moveType = shouldPromoteToKing(piece, newPos) ? 'king_promotion' : 'normal';
      
      moves.push({
        from: position,
        to: newPos,
        capturedPieces: [],
        type: moveType,
      });
    }
  }

  return moves;
}

// Get capture moves for a piece
function getCaptureMovesForPiece(board: Board, position: Position): Move[] {
  const piece = board[position.row]?.[position.col];
  if (!piece) return [];

  const captures: Move[] = [];
  const directions = getAllDirectionsForPiece(piece);

  console.log('🔍 Finding captures for piece at', position, 'in', directions.length, 'directions');

  for (const direction of directions) {
    const captureSequence = findCaptureSequence(board, position, position, direction, []);
    console.log('🔍 Direction', direction, 'found', captureSequence.length, 'capture sequences');
    captures.push(...captureSequence);
  }

  console.log('🔍 Total captures found:', captures.length);
  captures.forEach((capture, i) => {
    console.log(`🔍 Capture ${i + 1}: from ${capture.from.row},${capture.from.col} to ${capture.to.row},${capture.to.col}, capturing ${capture.capturedPieces.length} pieces:`, 
      capture.capturedPieces.map(p => `${p.row},${p.col}`).join(', '));
  });

  return captures;
}

// Recursively find all possible capture sequences (for multi-jumps)
function findCaptureSequence(
  board: Board,
  originalPosition: Position, // Track original starting position
  currentPosition: Position,  // Current position in the sequence
  direction: Position,
  capturedSoFar: Position[]
): Move[] {
  const piece = board[currentPosition.row]?.[currentPosition.col];
  if (!piece) return [];

  const jumpOverRow = currentPosition.row + direction.row;
  const jumpOverCol = currentPosition.col + direction.col;
  const landingRow = currentPosition.row + (direction.row * 2);
  const landingCol = currentPosition.col + (direction.col * 2);

  const jumpOverPos = { row: jumpOverRow, col: jumpOverCol };
  const landingPos = { row: landingRow, col: landingCol };

  // Check if this capture is valid
  if (!isValidPosition(jumpOverPos) || !isValidPosition(landingPos)) return [];
  if (!isDarkSquare(landingPos)) return [];
  if ((board[landingRow]?.[landingCol] ?? null) !== null) return []; // Landing square must be empty

  const jumpOverPiece = board[jumpOverRow]?.[jumpOverCol];
  if (!jumpOverPiece || jumpOverPiece.player === piece.player) return [];

  // Check if we've already captured this piece in this sequence
  const alreadyCaptured = capturedSoFar.some(pos => 
    pos.row === jumpOverRow && pos.col === jumpOverCol
  );
  if (alreadyCaptured) return [];

  const newCaptured = [...capturedSoFar, jumpOverPos];
  const moves: Move[] = [];

  // Create a temporary board state with the captures applied
  const tempBoard = board.map(row => [...row]);
  newCaptured.forEach(pos => {
    const boardRow = tempBoard[pos.row];
    if (boardRow) {
      boardRow[pos.col] = null;
    }
  });
  const landingBoardRow = tempBoard[landingRow];
  if (landingBoardRow) {
    landingBoardRow[landingCol] = piece;
  }
  const currentBoardRow = tempBoard[currentPosition.row];
  if (currentBoardRow) {
    currentBoardRow[currentPosition.col] = null;
  }

  // Check for additional captures from the landing position
  const furtherCaptures = getAllDirectionsForPiece(piece)
    .map(dir => findCaptureSequence(tempBoard, originalPosition, landingPos, dir, newCaptured))
    .flat();

  if (furtherCaptures.length > 0) {
    // Return the extended sequences - they already start from originalPosition
    moves.push(...furtherCaptures);
  } else {
    // No further captures, this sequence is complete 
    const moveType = shouldPromoteToKing(piece, landingPos) ? 'king_promotion' : 'capture';
    
    moves.push({
      from: originalPosition, // Always use the original starting position
      to: landingPos,
      capturedPieces: newCaptured,
      type: moveType,
    });
  }

  return moves;
}

// Get valid directions for a piece (normal pieces vs kings)
function getDirectionsForPiece(piece: Piece, _position: Position): Position[] {
  if (piece.type === 'king') {
    return [
      { row: -1, col: -1 },
      { row: -1, col: 1 },
      { row: 1, col: -1 },
      { row: 1, col: 1 },
    ];
  }

  // Normal pieces: red moves up (negative row), black moves down (positive row)
  const forward = piece.player === 'red' ? -1 : 1;
  return [
    { row: forward, col: -1 },
    { row: forward, col: 1 },
  ];
}

// Get all directions a piece can potentially capture in
function getAllDirectionsForPiece(piece: Piece): Position[] {
  if (piece.type === 'king') {
    return [
      { row: -1, col: -1 },
      { row: -1, col: 1 },
      { row: 1, col: -1 },
      { row: 1, col: 1 },
    ];
  }

  // Normal pieces can only capture forward (same direction rules as regular moves)
  const forward = piece.player === 'red' ? -1 : 1;
  return [
    { row: forward, col: -1 },
    { row: forward, col: 1 },
  ];
}

// Check if a piece should be promoted to king
function shouldPromoteToKing(piece: Piece, newPosition: Position): boolean {
  if (piece.type === 'king') return false;
  
  if (piece.player === 'red' && newPosition.row === 0) return true;
  if (piece.player === 'black' && newPosition.row === 7) return true;
  
  return false;
}

// Apply a move to the game state
export function applyMove(gameState: GameState, move: Move): GameState {
  const newBoard = gameState.board.map(row => [...row]);
  const piece = newBoard[move.from.row]?.[move.from.col];
  
  if (!piece) {
    // Enhanced error with more context for debugging
    const boardPieces = gameState.board.flatMap((row, r) => 
      row.map((p, c) => p ? `${p.player}-${p.type}@${r},${c}` : null)
    ).filter(Boolean);
    
    throw new Error(`No piece at source position ${move.from.row},${move.from.col}. Current board pieces: [${boardPieces.join(', ')}]. Move: ${JSON.stringify(move)}`);
  }

  // Remove captured pieces
  move.capturedPieces.forEach(capturedPos => {
    const capturedRow = newBoard[capturedPos.row];
    if (capturedRow) {
      capturedRow[capturedPos.col] = null;
    }
  });

  // Move the piece
  const fromRow = newBoard[move.from.row];
  if (fromRow) {
    fromRow[move.from.col] = null;
  }
  
  // Promote to king if needed
  if (move.type === 'king_promotion') {
    const toRow = newBoard[move.to.row];
    if (toRow) {
      toRow[move.to.col] = { ...piece, type: 'king' };
    }
  } else {
    const toRow = newBoard[move.to.row];
    if (toRow) {
      toRow[move.to.col] = piece;
    }
  }

  // Check if player can continue capturing
  let mustContinueCapture: Position | undefined;
  if (move.capturedPieces.length > 0) {
    console.log('🔍 Checking for further captures after move to:', move.to);
    const furtherCaptures = getCaptureMovesForPiece(newBoard, move.to);
    console.log('🔍 Found', furtherCaptures.length, 'further capture possibilities');
    if (furtherCaptures.length > 0) {
      mustContinueCapture = move.to;
      console.log('✅ Must continue capture at:', mustContinueCapture);
    } else {
      console.log('❌ No further captures available');
    }
  }

  // Switch turns only if no further captures are required
  const nextPlayer = mustContinueCapture ? gameState.currentPlayer : 
    (gameState.currentPlayer === 'red' ? 'black' : 'red');

  const newGameState: GameState = {
    board: newBoard,
    currentPlayer: nextPlayer,
    winner: null,
    status: 'active',
    mustContinueCapture,
  };

  // Check for winner
  const winner = checkForWinner(newGameState);
  if (winner) {
    newGameState.winner = winner;
    newGameState.status = 'finished';
    newGameState.mustContinueCapture = undefined;
  }

  return newGameState;
}

// Check if there's a winner
function checkForWinner(gameState: GameState): Player | null {
  const { board, currentPlayer, mustContinueCapture } = gameState;
  
  // Get all pieces for each player
  const redPieces: Position[] = [];
  const blackPieces: Position[] = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row]?.[col];
      if (piece) {
        const pos = { row, col };
        if (piece.player === 'red') redPieces.push(pos);
        else blackPieces.push(pos);
      }
    }
  }
  
  // Check if current player has no pieces
  const currentPlayerPieces = currentPlayer === 'red' ? redPieces : blackPieces;
  if (currentPlayerPieces.length === 0) {
    return currentPlayer === 'red' ? 'black' : 'red';
  }
  
  // Check if current player has no legal moves
  let hasLegalMoves = false;
  for (const piecePos of currentPlayerPieces) {
    const moves = getPossibleMovesForPiece(board, piecePos, mustContinueCapture);
    if (moves.length > 0) {
      hasLegalMoves = true;
      break;
    }
  }
  
  if (!hasLegalMoves) {
    return currentPlayer === 'red' ? 'black' : 'red';
  }
  
  return null;
}

// Get all legal moves for the current player
export function getAllLegalMoves(gameState: GameState): Move[] {
  const moves: Move[] = [];
  const { board, currentPlayer, mustContinueCapture } = gameState;
  
  console.log('🎯 Getting all legal moves for', currentPlayer, 'mustContinueCapture:', mustContinueCapture);
  
  // If we must continue a capture, only that piece can move
  if (mustContinueCapture) {
    console.log('🔄 Must continue capture with piece at:', mustContinueCapture);
    const pieceMoves = getPossibleMovesForPiece(board, mustContinueCapture, mustContinueCapture);
    console.log('🔄 Found', pieceMoves.length, 'continuation moves');
    return pieceMoves; // Only capture moves for that piece
  }
  
  // Get all possible moves for current player (both captures and normal moves)
  console.log('📝 Getting all moves for', currentPlayer, '- captures and normal moves both allowed');
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row]?.[col];
      if (piece?.player === currentPlayer) {
        const piecePos = { row, col };
        const pieceMoves = getPossibleMovesForPiece(board, piecePos, mustContinueCapture);
        moves.push(...pieceMoves);
      }
    }
  }
  
  console.log('🎮 Returning', moves.length, 'total legal moves');
  return moves;
}

// Validate if a move is legal
export function isValidMove(gameState: GameState, move: Move): boolean {
  const legalMoves = getAllLegalMoves(gameState);
  return legalMoves.some(legalMove => 
    movesEqual(legalMove, move)
  );
}

// Check if two moves are equal
function movesEqual(move1: Move, move2: Move): boolean {
  return (
    move1.from.row === move2.from.row &&
    move1.from.col === move2.from.col &&
    move1.to.row === move2.to.row &&
    move1.to.col === move2.to.col &&
    move1.capturedPieces.length === move2.capturedPieces.length &&
    move1.capturedPieces.every((pos1, index) => {
      const pos2 = move2.capturedPieces[index];
      return pos2?.row === pos1.row && pos2.col === pos1.col;
    })
  );
}

// Get pieces that have mandatory captures
export function getPiecesWithMandatoryCaptures(gameState: GameState): Position[] {
  const { board, currentPlayer, mustContinueCapture } = gameState;
  const piecesWithCaptures: Position[] = [];
  
  if (mustContinueCapture) {
    return [mustContinueCapture];
  }
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row]?.[col];
      if (piece?.player === currentPlayer) {
        const piecePos = { row, col };
        const captures = getCaptureMovesForPiece(board, piecePos);
        if (captures.length > 0) {
          piecesWithCaptures.push(piecePos);
        }
      }
    }
  }
  
  return piecesWithCaptures;
}

// Serialize game state to string for database storage
export function serializeGameState(gameState: GameState): string {
  return JSON.stringify(gameState);
}

// Deserialize game state from string
export function deserializeGameState(serialized: string): GameState {
  return JSON.parse(serialized) as GameState;
}