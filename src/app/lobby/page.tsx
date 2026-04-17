"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function LobbyPage() {
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isCreatingSinglePlayer, setIsCreatingSinglePlayer] = useState(false);
  const [showSinglePlayerOptions, setShowSinglePlayerOptions] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [playerColor, setPlayerColor] = useState<'red' | 'black'>('red');
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'past'>('available');
  const [inviteCode, setInviteCode] = useState('');
  const [showInviteInput, setShowInviteInput] = useState(false);
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();

  const { data: availableGames, refetch: refetchAvailable } = api.games.getAvailable.useQuery();
  const { data: myGamesResponse, refetch: refetchMy } = api.games.getMyGames.useQuery();
  const allMyGames = myGamesResponse?.games ?? [];
  const currentUserId = myGamesResponse?.currentUserId;
  
  // Debug: Log all games and their statuses
  console.log('All my games:', allMyGames.map(({ game }) => ({
    id: game.id,
    status: game.status,
    gameMode: game.gameMode,
    winnerId: game.winnerId,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt
  })));
  
  // Filter games into active and past
  const activeGames = allMyGames?.filter(({ game }) => 
    game.status === 'waiting_for_player' || game.status === 'in_progress'
  ) || [];
  
  const pastGames = allMyGames?.filter(({ game }) => 
    game.status === 'finished' || game.status === 'abandoned'
  ) || [];
  
  console.log('Active games:', activeGames.length, activeGames.map(g => g.game.status));
  console.log('Past games:', pastGames.length, pastGames.map(g => g.game.status));
  
  const createGameMutation = api.games.create.useMutation();
  const createSinglePlayerMutation = api.games.createSinglePlayer.useMutation();
  const joinGameMutation = api.games.join.useMutation();
  const joinByInviteMutation = api.games.joinByInvite.useMutation();
  const updateGameStatusMutation = api.games.updateGameStatus.useMutation();

  const handleCreateGame = async () => {
    setIsCreatingGame(true);
    // Close other open options
    setShowInviteInput(false);
    setShowSinglePlayerOptions(false);
    
    try {
      const newGame = await createGameMutation.mutateAsync({ isPrivate: true });
      void refetchMy();
      
      // Show invite code to user (prevent double execution)
      if (newGame?.inviteCode && !createGameMutation.isPending) {
        showToast(`Game created! Share this invite code: ${newGame.inviteCode}`, "success");
        // Copy to clipboard
        void navigator.clipboard?.writeText(newGame.inviteCode);
      }
      
      router.push(`/game/${newGame?.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create game", "error");
    } finally {
      setIsCreatingGame(false);
    }
  };

  const handleCreateSinglePlayer = async () => {
    setIsCreatingSinglePlayer(true);
    try {
      const newGame = await createSinglePlayerMutation.mutateAsync({
        difficulty: aiDifficulty,
        playerColor,
      });
      void refetchMy();
      void router.push(`/game/${newGame?.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create single-player game", "error");
    } finally {
      setIsCreatingSinglePlayer(false);
      setShowSinglePlayerOptions(false);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    try {
      await joinGameMutation.mutateAsync({ gameId });
      void refetchAvailable();
      void refetchMy();
      void router.push(`/game/${gameId}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to join game", "error");
    }
  };

  const handleJoinByInvite = async () => {
    if (!inviteCode.trim()) {
      showToast('Please enter an invite code', 'error');
      return;
    }
    
    try {
      const joinedGame = await joinByInviteMutation.mutateAsync({ 
        inviteCode: inviteCode.trim().toUpperCase() 
      });
      void refetchMy();
      setInviteCode('');
      setShowInviteInput(false);
      void router.push(`/game/${joinedGame?.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to join game with invite code", "error");
    }
  };

  const handleMarkAsFinished = async (gameId: string, winnerId?: string) => {
    try {
      await updateGameStatusMutation.mutateAsync({
        gameId,
        status: 'finished',
        winnerId,
      });
      void refetchMy();
      showToast('Game marked as finished!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update game status", "error");
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getGameStatusBadge = (status: string) => {
    const badges = {
      'waiting_for_player': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-green-100 text-green-800',
      'finished': 'bg-gray-100 text-gray-800',
      'abandoned': 'bg-red-100 text-red-800',
    } as const;
    
    return badges[status as keyof typeof badges] ?? 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <ToastContainer />
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-wrap justify-center sm:justify-between items-center mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="p-3 bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
              title="Home"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Game Lobby</h1>
              <p className="text-gray-600 mt-1">Choose your game mode and start playing!</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center space-x-0">
            <button
              onClick={handleCreateGame}
              disabled={isCreatingGame}
              className="px-6 w-full sm:w-auto py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isCreatingGame ? "Creating..." : "Create Multiplayer Game"}
            </button>
            <button
              onClick={() => {
                setShowInviteInput(!showInviteInput);
                setShowSinglePlayerOptions(false); // Close other option
              }}
              className="px-6 w-full sm:w-auto py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Join by Invite
            </button>
            <button
          
              onClick={() => {
                setShowSinglePlayerOptions(!showSinglePlayerOptions);
                setShowInviteInput(false); // Close other option
              }}
              className="px-6 w-full sm:w-auto py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Play vs Hank 🐦
            </button>
          </div>
        </div>

        {/* Join by Invite */}
        {showInviteInput && (
          <div className="mb-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Join Game by Invite Code</h2>
            <div className="flex space-x-4">
              <input
                type="text"
                placeholder="Enter invite code (e.g. ABC123)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                maxLength={8}
              />
              <button
                onClick={handleJoinByInvite}
                disabled={joinByInviteMutation.isPending}
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {joinByInviteMutation.isPending ? "Joining..." : "Join Game"}
              </button>
            </div>
          </div>
        )}

        {/* Single Player Options */}
        {showSinglePlayerOptions && (
          <div className="mb-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Single Player Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hank&apos;s Difficulty 🐦
                </label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="easy">Easy (Hank pecks randomly)</option>
                  <option value="medium">Medium (Hank thinks strategically)</option>
                  <option value="hard">Hard (Hank is a chess master!)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Color
                </label>
                <select
                  value={playerColor}
                  onChange={(e) => setPlayerColor(e.target.value as 'red' | 'black')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="red">Red (You go first)</option>
                  <option value="black">Black (Hank goes first)</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-4">
              <button
                onClick={() => setShowSinglePlayerOptions(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSinglePlayer}
                disabled={isCreatingSinglePlayer}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isCreatingSinglePlayer ? "Starting..." : "Start Hank Game"}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('available')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'available'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Available Games
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'active'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Active Games ({activeGames.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'past'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Past Games ({pastGames.length})
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Available Games Tab */}
          {activeTab === 'available' && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Available Games</h2>
                <p className="text-sm text-gray-600">Join a game that&apos;s waiting for players</p>
              </div>
              <div className="divide-y divide-gray-200">
                {availableGames && availableGames.length > 0 ? (
                  availableGames.map(({ game, player1 }) => (
                    <div key={game.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-indigo-600">
                                  {player1?.name?.charAt(0) ?? player1?.email?.charAt(0) ?? '?'}
                                </span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {player1?.name ?? player1?.email ?? 'Anonymous Player'}
                              </p>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getGameStatusBadge(
                                    game.status
                                  )}`}
                                >
                                  Waiting for player
                                </span>
                                <span>•</span>
                                <span>{formatTimeAgo(game.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleJoinGame(game.id)}
                          disabled={joinGameMutation.isPending}
                          className="ml-4 inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                          Join Game
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🎲</span>
                    </div>
                    <p className="text-gray-500">No available games</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Create a new game to get started!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Games Tab */}
          {activeTab === 'active' && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">My Active Games</h2>
                <p className="text-sm text-gray-600">Games in progress or waiting for players</p>
              </div>
              <div className="divide-y divide-gray-200">
                {activeGames.length > 0 ? (
                  activeGames.map(({ game, player1, player2 }) => (
                    <div key={game.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className="text-2xl">
                                  {game.gameMode === 'single_player_ai' ? '🐦' : '🏁'}
                                </span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {game.gameMode === 'single_player_ai' 
                                  ? `vs Hank (${game.aiDifficulty})`
                                  : (() => {
                                      // For multiplayer games, show the opponent's name
                                      if (currentUserId === game.player1Id) {
                                        // Current user is player1, show player2's name  
                                        return game.status === 'waiting_for_player' 
                                          ? 'Waiting for opponent'
                                          : `vs ${player2?.name ?? player2?.email ?? 'Unknown Player'}`;
                                      } else {
                                        // Current user is player2, show player1's name
                                        return `vs ${player1?.name ?? player1?.email ?? 'Unknown Player'}`;
                                      }
                                    })()
                                }
                              </p>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getGameStatusBadge(
                                    game.status
                                  )}`}
                                >
                                  {game.status.replace('_', ' ')}
                                </span>
                                <span>•</span>
                                <span>{formatTimeAgo(game.updatedAt ?? game.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex space-x-2">
                          {game.status === 'in_progress' && (
                            <Link
                              href={`/game/${game.id}`}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              Continue
                            </Link>
                          )}
                          {game.status === 'waiting_for_player' && (
                            <Link
                              href={`/game/${game.id}`}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                            >
                              View
                            </Link>
                          )}
                          {/* Debug buttons */}
                          <button
                            onClick={() => handleMarkAsFinished(game.id, currentUserId)}
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200"
                            title="Debug: Mark as won"
                          >
                            🏆
                          </button>
                          <button
                            onClick={() => handleMarkAsFinished(game.id, 
                              game.gameMode === 'single_player_ai' ? undefined : 
                              (currentUserId === game.player1Id ? game.player2Id ?? undefined : game.player1Id)
                            )}
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                            title="Debug: Mark as lost"
                          >
                            😔
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🎮</span>
                    </div>
                    <p className="text-gray-500">No active games</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Create or join a game to get started!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Past Games Tab */}
          {activeTab === 'past' && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Past Games</h2>
                <p className="text-sm text-gray-600">Completed and abandoned games</p>
              </div>
              <div className="divide-y divide-gray-200">
                {pastGames.length > 0 ? (
                  pastGames.map(({ game, player1, player2 }) => (
                    <div key={game.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className="text-2xl">
                                  {game.status === 'finished' ? '🏆' : '⚠️'}
                                </span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {game.gameMode === 'single_player_ai' 
                                  ? `vs Hank (${game.aiDifficulty})`
                                  : (() => {
                                      // For multiplayer games, show the opponent's name
                                      if (currentUserId === game.player1Id) {
                                        // Current user is player1, show player2's name
                                        return `vs ${player2?.name ?? player2?.email ?? 'Unknown Player'}`;
                                      } else {
                                        // Current user is player2, show player1's name
                                        return `vs ${player1?.name ?? player1?.email ?? 'Unknown Player'}`;
                                      }
                                    })()
                                }
                                {/* Show winner info */}
                                {game.status === 'finished' && game.winnerId && (
                                  <span className="ml-2 text-xs">
                                    {game.winnerId === currentUserId ? '🏆 You won!' : '😔 You lost'}
                                  </span>
                                )}
                              </p>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getGameStatusBadge(
                                    game.status
                                  )}`}
                                >
                                  {game.status === 'finished' ? 'Completed' : 'Abandoned'}
                                </span>
                                <span>•</span>
                                <span>{formatTimeAgo(game.updatedAt ?? game.createdAt)}</span>
                                {/* Debug info */}
                                <span>•</span>
                                <span className="text-xs text-red-500">Debug: {game.status}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4">
                          <Link
                            href={`/game/${game.id}`}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">📜</span>
                    </div>
                    <p className="text-gray-500">No past games</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Your completed games will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {availableGames?.length ?? 0}
            </div>
            <div className="text-sm text-gray-600">Games Available</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {activeGames.length}
            </div>
            <div className="text-sm text-gray-600">Active Games</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {pastGames.length}
            </div>
            <div className="text-sm text-gray-600">Past Games</div>
          </div>
        </div>
      </div>
    </div>
  );
}