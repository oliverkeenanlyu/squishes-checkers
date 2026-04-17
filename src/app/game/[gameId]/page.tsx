"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { CheckersBoard } from "@/components/CheckersBoard";
import { GameInfo } from "@/components/GameInfo";
import { GameChat } from "@/components/GameChat";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { type Move, type Player, type GameState } from "@/lib/checkers-logic";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params?.gameId as string;
  const { showToast, ToastContainer } = useToast();
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerColor, setPlayerColor] = useState<'red' | 'black' | undefined>(undefined);
  const [gameStarted, setGameStarted] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isAITurn, setIsAITurn] = useState(false);
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const aiMoveInProgress = useRef(false);
  const aiFailureCount = useRef(0);
  const maxAIFailures = 3; // Circuit breaker: stop trying after 3 failures

  // State for join by invite on this page
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  // Game data
  const { data, refetch, isLoading } = api.games.getById.useQuery(
    { gameId },
    { 
      enabled: !!gameId,
      refetchInterval: (_query) => {
        // Smart polling based on game type and state
        const gameData = _query.state.data;
        if (!gameData) return false;
        
        // No polling for Hank games (to prevent race conditions)
        if (gameData.gameMode === 'single_player_ai') return false;
        
        // Fast polling for multiplayer games in progress
        if (gameData.gameMode === 'multiplayer' && gameData.status === 'in_progress') {
          return 2000; // 2 seconds for active multiplayer games
        }
        
        // Slower polling for waiting games
        if (gameData.status === 'waiting_for_player') {
          return 5000; // 5 seconds for waiting games
        }
        
        // No polling for finished games
        return false;
      },
    }
  );
  
  // Game moves
  const { data: moves } = api.games.getMoves.useQuery(
    { gameId },
    { 
      enabled: !!gameId, 
      refetchInterval: (_query) => {
        // Use same logic as game data for consistency
        if (!data) return false;
        
        // No polling for Hank games
        if (data.gameMode === 'single_player_ai') return false;
        
        // Fast polling for active multiplayer games
        if (data.gameMode === 'multiplayer' && data.status === 'in_progress') {
          return 2000; // 2 seconds
        }
        
        return false;
      },
    }
  );

  // Mutations
  const makeMoveMutation = api.games.makeMove.useMutation({
    onSuccess: () => {
      console.log("Human move succeeded, refetching...");
      // Delay refetch slightly for smoother experience
      setTimeout(() => void refetch(), 300);
    },
  });

  const makeAIMoveMutation = api.games.makeAIMove.useMutation({
    onSuccess: () => {
      console.log("✅ Hank move succeeded, resetting state");
      aiMoveInProgress.current = false;
      aiFailureCount.current = 0; // Reset failure count on success
      setIsWaitingForAI(false);
      // Delay refetch to prevent race conditions
      setTimeout(() => {
        console.log("🔄 Refetching game state after Hank move...");
        void refetch();
      }, 300);
    },
    onError: (error) => {
      console.error("❌ Hank move failed:", error);
      aiMoveInProgress.current = false;
      setIsWaitingForAI(false);
      
      // Increment failure count
      aiFailureCount.current += 1;
      console.warn(`🚨 Hank failure count: ${aiFailureCount.current}/${maxAIFailures}`);
      
      if (aiFailureCount.current >= maxAIFailures) {
        console.error(`🛑 Hank failed ${maxAIFailures} times, stopping attempts`);
        showToast(`Hank encountered an error and can't move. Try refreshing the page.`, "error");
        return;
      }
      
      // Try to refetch anyway in case the state is inconsistent
      setTimeout(() => {
        console.log("🔄 Refetching game state after Hank failure...");
        void refetch();
      }, 1000);
    },
  });
  
  const abandonGameMutation = api.games.abandon.useMutation({
    onSuccess: () => {
      console.log("✅ Game abandoned successfully");
      showToast("Game abandoned successfully", "success");
      
      // Refresh the game state to show abandoned status
      void refetch();
      
      // Navigate to lobby after a short delay to show the feedback
      setTimeout(() => {
        void router.push('/lobby');
      }, 1500);
    },
    onError: (error) => {
      console.error("❌ Failed to abandon game:", error);
      showToast(error.message ?? "Failed to abandon game", "error");
    },
  });

  const joinByInviteMutation = api.games.joinByInvite.useMutation({
    onSuccess: () => {
      console.log("✅ Joined game successfully");
      showToast("Joined game successfully!", "success");
      setInviteCode('');
      setShowJoinInput(false);
      
      // Refresh the game data to show joined status
      void refetch();
    },
    onError: (error) => {
      console.error("❌ Failed to join game:", error);
      showToast(error.message ?? "Failed to join game", "error");
    },
  });

  // Update local game state when data changes
  useEffect(() => {
    if (data) {
      console.log("📊 Game data updated:", {
        gameMode: data.gameMode,
        aiPlayer: data.aiPlayer,
        currentPlayer: data.gameState.currentPlayer,
        status: data.status,
        gameId: data.id,
        currentTurn: data.currentTurn,
        moves: moves?.length ?? 0,
        lastMoveAt: data.lastMoveAt
      });
      
      // Debug board state changes - REMOVED to prevent performance issues
      
      setGameState(data.gameState);
      
      // For single-player games, determine if current turn belongs to Hank
      if (data.gameMode === 'single_player_ai') {
        const aiPlayer = data.aiPlayer as 'red' | 'black';
        const humanPlayer = aiPlayer === 'red' ? 'black' : 'red';
        const currentPlayer = data.gameState.currentPlayer;
        const gameActive = data.status === 'in_progress';
        
        const newIsAITurn = gameActive && currentPlayer === aiPlayer;
        const oldIsAITurn = isAITurn;
        
        setIsAITurn(newIsAITurn);
        setPlayerColor(humanPlayer); // Human player gets opposite color of Hank
        
        // Reset Hank waiting state if it's no longer Hank's turn
        if (!newIsAITurn && (isWaitingForAI || aiMoveInProgress.current)) {
          console.log("🔄 No longer Hank's turn, resetting waiting state");
          aiMoveInProgress.current = false;
          setIsWaitingForAI(false);
        }
        
        // If Hank turn state changed to true, ensure we're not stuck waiting
        if (newIsAITurn && !oldIsAITurn && (isWaitingForAI || aiMoveInProgress.current)) {
          console.log("🔄 Hank turn started but we're already waiting - resetting wait state");
          aiMoveInProgress.current = false;
          setIsWaitingForAI(false);
        }
      } else {
        // Determine player color for multiplayer
        if (data.currentUserId === data.player1?.id) {
          setPlayerColor('red');
        } else if (data.currentUserId === data.player2?.id) {
          setPlayerColor('black'); 
        }
        setIsAITurn(false);
      }
      
      // Check if game has started (show board for in-progress, finished, and abandoned games)
      setGameStarted(data.status === 'in_progress' || data.status === 'finished' || data.status === 'abandoned');
    }
  }, [data, moves]);

  // Handle Hank moves - with better safeguards against race conditions
  useEffect(() => {
    // Only use simple values in dependencies to avoid constant re-renders
    const currentPlayer = gameState?.currentPlayer;
    const aiPlayer = data?.aiPlayer;
    const gameMode = data?.gameMode;
    const gameStatus = data?.status;
    
    if (gameMode === 'single_player_ai') {
      const gameActive = gameStatus === 'in_progress';
      const shouldBeAITurn = gameActive && currentPlayer === aiPlayer;
      
      console.log("🤖 Hank Turn Check:", {
        aiPlayer,
        currentPlayer,
        gameActive,
        shouldBeAITurn,
        currentIsAITurn: isAITurn,
        aiMoveInProgress: aiMoveInProgress.current,
        isPending: makeAIMoveMutation.isPending
      });
      
      // Check if we should make an Hank move
      const shouldMakeAIMove = shouldBeAITurn && 
                             !aiMoveInProgress.current && 
                             !makeAIMoveMutation.isPending && 
                             gameStarted && 
                             gameId &&
                             aiFailureCount.current < maxAIFailures; // Circuit breaker
      
      if (shouldMakeAIMove) {
        console.log("✅ Starting Hank move...");
        
        // Set the ref to prevent concurrent moves
        aiMoveInProgress.current = true;
        setIsWaitingForAI(true);
        
        const makeAIMove = async () => {
          try {
            // Short delay for natural Hank thinking
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Final check before making the move
            if (!aiMoveInProgress.current) {
              console.log("❌ Aborting Hank move - no longer in progress");
              return;
            }
            
            console.log("🚀 Calling makeAIMoveMutation...");
            await makeAIMoveMutation.mutateAsync({ gameId });
            console.log("✅ Hank move completed successfully");
          } catch (error) {
            console.error("❌ Failed to make Hank move:", error);
            // Error handling is now in the mutation's onError
          }
        };

        void makeAIMove();
      } else if (shouldBeAITurn && aiFailureCount.current >= maxAIFailures) {
        console.warn("🛑 Hank disabled due to too many failures");
      }
      
      // Reset Hank state if it's no longer Hank's turn
      if (!shouldBeAITurn && (aiMoveInProgress.current || isWaitingForAI)) {
        console.log("🔄 No longer Hank's turn, resetting all Hank state");
        aiMoveInProgress.current = false;
        setIsWaitingForAI(false);
        // Reset failure count when it's no longer Hank's turn
        aiFailureCount.current = 0;
      }
    }
  }, [isAITurn, gameStarted, gameId, makeAIMoveMutation.isPending]);

  // Fallback polling for Hank turns only - to detect if Hank moved outside our control
  useEffect(() => {
    if (isAITurn && 
        (isWaitingForAI || aiMoveInProgress.current) && 
        aiFailureCount.current < maxAIFailures) { // Don't poll if Hank is disabled
      
      console.log("🔄 Starting fallback polling for Hank turn...");
      const pollInterval = setInterval(() => {
        console.log("🔄 Fallback poll: checking if Hank moved...");
        void refetch();
      }, 4000); // Increased interval to reduce spam

      // Clear polling after 20 seconds max (reduced from 30)
      const timeout = setTimeout(() => {
        console.warn("⏰ Hank move timeout - clearing polling and resetting state");
        clearInterval(pollInterval);
        aiMoveInProgress.current = false;
        setIsWaitingForAI(false);
        // Don't increment failure count on timeout, as it might not be Hank's fault
      }, 20000);

      return () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    }
  }, [isAITurn, isWaitingForAI, refetch]);

  const handleMove = async (move: Move) => {
    if (!playerColor || !gameId) return;
    
    try {
      await makeMoveMutation.mutateAsync({
        gameId,
        move,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to make move", "error");
    }
  };

  const handleAbandonGame = async () => {
    if (!confirm("Are you sure you want to abandon this game?")) return;
    
    try {
      await abandonGameMutation.mutateAsync({ gameId });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to abandon game", "error");
    }
  };

  const handleJoinByInvite = async () => {
    if (!inviteCode.trim()) {
      showToast('Please enter an invite code', 'error');
      return;
    }
    
    try {
      await joinByInviteMutation.mutateAsync({ 
        inviteCode: inviteCode.trim().toUpperCase() 
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to join game with invite code", "error");
    }
  };

  const copyGameLink = () => {
    const url = `${window.location.origin}/game/${gameId}`;
    void navigator.clipboard.writeText(url);
    showToast(`Game link copied: ${url}`, "success");
  };

  const copyInviteCode = () => {
    if (data?.inviteCode) {
      void navigator.clipboard.writeText(data.inviteCode);
      showToast(`Invite code copied: ${data.inviteCode}`, "success");
    }
  };

  const formatMoveHistory = () => {
    if (!moves) return [];
    
    return moves.map((moveData, _index) => {
      const move = moveData.move as {
        fromRow: number;
        fromCol: number;
        toRow: number;
        toCol: number;
        capturedPieces?: string;
        moveNumber: number;
      };
      const player = moveData.player;
      const capturedPieces = move.capturedPieces ? JSON.parse(move.capturedPieces) as Array<{row: number, col: number}> : [];
      
      const formatPosition = (row: number, col: number) => {
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        return `${letters[col]}${8 - row}`;
      };

      const fromPos = formatPosition(move.fromRow, move.fromCol);
      const toPos = formatPosition(move.toRow, move.toCol);
      
      return {
        moveNumber: move.moveNumber,
        player: (player?.id === data?.player1?.id ? 'red' : 'black') as Player,
        from: fromPos,
        to: toPos,
        captured: capturedPieces.length > 0 ? 
          capturedPieces.map((cap) => formatPosition(cap.row, cap.col)) : 
          undefined,
      };
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Game Not Found</h1>
          <p className="text-gray-600 mb-4">The game you&apos;re looking for doesn&apos;t exist.</p>
          <Link
            href="/lobby"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Lobby
          </Link>
        </div>
      </div>
    );
  }

  // Check if user is trying to view a private game they're not part of
  const isParticipant = data.currentUserId === data.player1?.id || data.currentUserId === data.player2?.id;
  const canJoin = data.isPrivate && 
                  data.status === 'waiting_for_player' && 
                  data.gameMode === 'multiplayer' &&
                  !isParticipant &&
                  !data.player2Id;

  // Show join interface for private games
  if (canJoin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <ToastContainer />
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🎲</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Private Game</h1>
            <p className="text-gray-600 mb-4">
              This is a private game. Enter the invite code to join.
            </p>
            
            {!showJoinInput ? (
              <div className="space-y-3">
                <button
                  onClick={() => setShowJoinInput(true)}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Join Game
                </button>
                <Link
                  href="/lobby"
                  className="block text-center px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Back to Lobby
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter invite code (e.g. ABC123)"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  maxLength={8}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinByInvite()}
                />
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowJoinInput(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinByInvite}
                    disabled={joinByInviteMutation.isPending}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {joinByInviteMutation.isPending ? "Joining..." : "Join"}
                  </button>
                </div>
                <Link
                  href="/lobby"
                  className="block text-center text-sm text-gray-600 hover:text-gray-800"
                >
                  Back to Lobby
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Determine if it's the user's turn
  const isMyTurn = data.status === 'in_progress' && (
    data.gameMode === 'single_player_ai' 
      ? (data.gameState.currentPlayer === playerColor && !isAITurn)
      : data.currentTurn === data.currentUserId
  );

  // Get the last move for highlighting (show all moves for visual feedback)
  const lastMoveData = moves && moves.length > 0 ? moves[moves.length - 1] : null;
  const shouldShowLastMove = lastMoveData && lastMoveData.move.moveNumber > 0;
  const lastMove = shouldShowLastMove && lastMoveData?.move ? {
    from: { row: lastMoveData.move.fromRow, col: lastMoveData.move.fromCol },
    to: { row: lastMoveData.move.toRow, col: lastMoveData.move.toCol },
    capturedPieces: lastMoveData.move.capturedPieces ? JSON.parse(lastMoveData.move.capturedPieces) as Array<{row: number, col: number}> : [],
    type: lastMoveData.move.moveType as 'normal' | 'capture' | 'king_promotion',
    isOpponentMove: data?.gameMode === 'single_player_ai' ? 
      lastMoveData.player?.id !== data.currentUserId : // Hank move in single player (Hank has different user ID)
      lastMoveData.player?.id !== data?.currentUserId   // Opponent move in multiplayer
  } : null;
  
  const canAbandon = data.status !== 'finished' && data.status !== 'abandoned' && 
    (data.player1?.id === data.currentUserId || data.player2?.id === data.currentUserId);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <ToastContainer />
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-wrap justify-center gap-4 sm:justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Checkers Game
            </h1>
            <p className="text-gray-600 mt-1">Game ID: {gameId}</p>
          </div>
          <div className="flex flex-wrap gap-2 space-x-0">
            {data.status === 'waiting_for_player' && data.isPrivate && data.inviteCode && (
              <>
                <button
                  onClick={copyInviteCode}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Copy Invite Code
                </button>
                <button
                  onClick={copyGameLink}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                >
                  Copy Game Link
                </button>
              </>
            )}
            {data.status === 'waiting_for_player' && !data.isPrivate && (
              <button
                onClick={copyGameLink}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Share Game Link
              </button>
            )}
            {/* Debug buttons for Hank games */}
            {data.gameMode === 'single_player_ai' && process.env.NODE_ENV === 'development' && (
              <>
                {/* <button
                  onClick={() => {
                    console.log("🔧 Force Hank Move clicked");
                    console.log("🔧 Current state:", {
                      isAITurn,
                      isWaitingForAI,
                      aiMoveInProgress: aiMoveInProgress.current,
                      isPending: makeAIMoveMutation.isPending,
                      currentPlayer: data.gameState.currentPlayer,
                      aiPlayer: data.aiPlayer,
                      gameStatus: data.status
                    });
                    
                    if (!aiMoveInProgress.current && !makeAIMoveMutation.isPending) {
                      console.log("🔧 Forcing Hank move...");
                      aiMoveInProgress.current = true;
                      setIsWaitingForAI(true);
                      makeAIMoveMutation.mutate({ gameId });
                    } else {
                      console.log("🔧 Cannot force Hank move - already in progress");
                    }
                  }}
                  disabled={makeAIMoveMutation.isPending || aiMoveInProgress.current}
                  className="px-3 py-1 bg-orange-600 text-white rounded text-xs"
                >
                  Force Hank Move
                </button>
                <button
                  onClick={() => {
                    console.log("🔧 Reset Hank state clicked");
                    console.log("🔧 Previous state:", {
                      isAITurn,
                      isWaitingForAI,
                      aiMoveInProgress: aiMoveInProgress.current,
                      aiFailureCount: aiFailureCount.current,
                      isPending: makeAIMoveMutation.isPending
                    });
                    aiMoveInProgress.current = false;
                    aiFailureCount.current = 0; // Reset failure count
                    setIsWaitingForAI(false);
                    // Also trigger a refetch to refresh game state
                    refetch();
                    console.log("🔧 Hank state reset and refetch triggered");
                  }}
                  className="px-3 py-1 bg-yellow-600 text-white rounded text-xs"
                >
                  Reset Hank State
                </button> */}
                {/* <button
                  onClick={() => {
                    console.log("🔧 Manual Refetch clicked");
                    refetch();
                    console.log("🔧 Manual refetch triggered");
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                >
                  Refetch
                </button> */}
                {aiFailureCount.current > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                    Hank Fails: {aiFailureCount.current}/{maxAIFailures}
                  </span>
                )}
              </>
            )}
            {canAbandon && (
              <button
                onClick={handleAbandonGame}
                disabled={abandonGameMutation.isPending}
                className={`px-4 py-2 text-white rounded-md text-sm transition-colors duration-200 ${
                  abandonGameMutation.isPending 
                    ? 'bg-red-400 cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {abandonGameMutation.isPending ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Abandoning...
                  </span>
                ) : (
                  'Abandon Game'
                )}
              </button>
            )}
            <Link
              href="/lobby"
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              Back to Lobby
            </Link>
          </div>
        </div>

        {/* Status Messages */}
        {data.status === 'abandoned' && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-gray-400 text-xl">🏳️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-800">
                  Game Abandoned
                </h3>
                <p className="text-sm text-gray-700 mt-1">
                  This game has been abandoned.
                  {data.winnerId && (
                    <span className="ml-1">
                      {data.winnerId === data.currentUserId ? 'You win!' : 'You lose.'}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {data.status === 'finished' && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-blue-400 text-xl">🏆</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Game Finished
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  {data.winnerId === data.currentUserId ? 'Congratulations! You won!' :
                   data.winnerId ? 'Game over. Better luck next time!' :
                   'Game ended in a draw.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {data.status === 'waiting_for_player' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-yellow-400 text-xl">⏳</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Waiting for opponent
                </h3>
                {data.isPrivate && data.inviteCode ? (
                  <div className="text-sm text-yellow-700 mt-1 space-y-1">
                    <p>Share the <strong>invite code</strong> with someone to join: <code className="bg-yellow-100 px-1 rounded">{data.inviteCode}</code></p>
                    <p>Or share the game link and they&apos;ll be asked to enter the invite code.</p>
                  </div>
                ) : (
                  <p className="text-sm text-yellow-700 mt-1">
                    Share the game link with someone to start playing!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}



        {isAITurn && !isWaitingForAI && aiFailureCount.current >= maxAIFailures && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400 text-xl">🚫</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Hank encountered an error
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  Hank can&apos;t make a move due to a technical issue. Try using the &quot;Reset Hank State&quot; button or refresh the page.
                </p>
              </div>
            </div>
          </div>
        )}



        {data.status === 'finished' && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-blue-400 text-xl">🏁</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Game Finished
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  {data.gameMode === 'single_player_ai' ? (
                    data.gameState.winner === playerColor ? 
                      "You win! Congratulations!" : 
                      "Hank wins! Better luck next time!"
                  ) : (
                    <>
                      {data.winnerId === data.player1?.id ? 
                        (data.player1?.name ?? data.player1?.email ?? "Player 1") : 
                        (data.player2?.name ?? data.player2?.email ?? "Player 2")
                      } wins!
                      {data.winnerId === data.currentUserId && " Congratulations!"}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Game Board */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-10 sm:p-20">
              {gameState && gameStarted ? (
                <div className="flex justify-center p-0">
                  <CheckersBoard
                    key={`${gameId}-${data.lastMoveAt?.getTime() || 0}`} // Force re-render on moves
                    gameState={gameState}
                    onMove={handleMove}
                    isPlayerTurn={isMyTurn}
                    playerColor={playerColor}
                    disabled={makeMoveMutation.isPending || data.status !== 'in_progress' || isWaitingForAI}
                    lastMove={lastMove}
                  />
                </div>
              ) : (
                <div className="flex justify-center items-center h-96">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">⏳</span>
                    </div>
                    <p className="text-gray-500">Waiting for game to start...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-1">
            {gameState && (
              <GameInfo
                gameState={gameState}
                player1={data.player1 ?? undefined}
                player2={data.gameMode === 'single_player_ai' 
                  ? { 
                      id: 'hank', 
                      name: `Hank (${data.aiDifficulty})`, 
                      email: '' 
                    } 
                  : (data.player2 ?? undefined)
                }
                currentUserId={data.currentUserId}
                playerColor={playerColor}
                gameStatus={data.status}
                isMyTurn={isMyTurn}
                isAITurn={isAITurn}
                isWaitingForAI={isWaitingForAI}
                gameMode={data.gameMode}
                moveHistory={formatMoveHistory()}
              />
            )}
          </div>

          <div className="xl:col-span-1">
            {gameStarted && data.player2 && data.gameMode === 'multiplayer' && (
              <GameChat
                gameId={gameId}
                currentUserId={data.currentUserId}
                player1={data.player1 ?? undefined}
                player2={data.player2 ?? undefined}
                isOpen={isChatOpen}
                onToggle={() => setIsChatOpen(!isChatOpen)}
              />
            )}

            {gameStarted && data.gameMode === 'single_player_ai' && (
              <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🐦</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Playing vs Hank
                  </h3>
                  <p className="text-sm text-gray-600">
                    Difficulty: <span className="capitalize font-medium">{data.aiDifficulty}</span>
                  </p>
                  {isWaitingForAI && (
                    <p className="text-sm text-blue-600 mt-2">
                      🤔 Hank is thinking...
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {!gameStarted && (
              <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">💬</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Encrypted Chat
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Chat will be available once both players join the game.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}