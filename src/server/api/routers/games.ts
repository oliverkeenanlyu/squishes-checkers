import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { games, gameMoves, users } from "@/server/db/schema";
import { eq, and, or, desc, asc, ne } from "drizzle-orm";
import { 
  createInitialGameState, 
  deserializeGameState, 
  serializeGameState, 
  applyMove, 
  isValidMove,
  type Move
} from "@/lib/checkers-logic";
import { TRPCError } from "@trpc/server";

// Create aliases for user table joins to avoid conflicts
const usersPlayer1 = alias(users, 'users_player1');
const usersPlayer2 = alias(users, 'users_player2');

export const gamesRouter = createTRPCRouter({
  // Create a new multiplayer game
  create: protectedProcedure
    .input(z.object({
      isPrivate: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const initialGameState = createInitialGameState();
      
      // Generate invite code for private games
      const inviteCode = input.isPrivate ? 
        Math.random().toString(36).substring(2, 8).toUpperCase() : null;
      
      const [newGame] = await ctx.db
        .insert(games)
        .values({
          player1Id: ctx.session.user.id,
          player2Id: null,
          gameMode: "multiplayer",
          isPrivate: input.isPrivate,
          inviteCode: inviteCode,
          status: "waiting_for_player",
          currentTurn: null,
          boardState: serializeGameState(initialGameState),
        })
        .returning();

      return newGame;
    }),

  // Create a new single-player game against AI
  createSinglePlayer: protectedProcedure
    .input(z.object({
      difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
      playerColor: z.enum(['red', 'black']).default('red'),
    }))
    .mutation(async ({ ctx, input }) => {
      const initialGameState = createInitialGameState();
      const aiPlayer = input.playerColor === 'red' ? 'black' : 'red';
      
      // Set the current turn to the human player if they chose red, or null if AI goes first
      const currentTurn = input.playerColor === 'red' ? ctx.session.user.id : null;
      
      const [newGame] = await ctx.db
        .insert(games)
        .values({
          player1Id: ctx.session.user.id,
          player2Id: null,  // No human player 2 for AI games
          gameMode: "single_player_ai",
          aiDifficulty: input.difficulty,
          aiPlayer,
          status: "in_progress",  // Start immediately
          currentTurn,
          boardState: serializeGameState(initialGameState),
        })
        .returning();

      return newGame;
    }),

  // Join an existing game
  join: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db
        .select()
        .from(games)
        .where(eq(games.id, input.gameId))
        .limit(1);

      if (!game[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
      }

      if (game[0].status !== "waiting_for_player") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game is not accepting players" });
      }

      if (game[0].player1Id === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot join your own game" });
      }

      if (game[0].player2Id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game is full" });
      }

      // Update game with player 2 and start the game
      const [updatedGame] = await ctx.db
        .update(games)
        .set({
          player2Id: ctx.session.user.id,
          status: "in_progress",
          currentTurn: game[0].player1Id, // Player 1 (red) always starts
        })
        .where(eq(games.id, input.gameId))
        .returning();

      return updatedGame;
    }),

  // Join a game by invite code
  joinByInvite: protectedProcedure
    .input(z.object({ inviteCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db
        .select()
        .from(games)
        .where(
          and(
            eq(games.inviteCode, input.inviteCode.toUpperCase()),
            eq(games.status, "waiting_for_player"),
            eq(games.gameMode, "multiplayer")
          )
        )
        .limit(1);

      if (!game[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Game not found with that invite code" });
      }

      if (game[0].player1Id === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot join your own game" });
      }

      if (game[0].player2Id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game is already full" });
      }

      // Update game with player 2 and start the game
      const [updatedGame] = await ctx.db
        .update(games)
        .set({
          player2Id: ctx.session.user.id,
          status: "in_progress",
          currentTurn: game[0].player1Id, // Player 1 (red) always starts
        })
        .where(eq(games.id, game[0].id))
        .returning();

      return updatedGame;
    }),

  // Make a move
  makeMove: protectedProcedure
    .input(z.object({
      gameId: z.string(),
      move: z.object({
        from: z.object({ row: z.number(), col: z.number() }),
        to: z.object({ row: z.number(), col: z.number() }),
        capturedPieces: z.array(z.object({ row: z.number(), col: z.number() })),
        type: z.enum(['normal', 'capture', 'king_promotion']),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db
        .select()
        .from(games)
        .where(eq(games.id, input.gameId))
        .limit(1);

      if (!game[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
      }

      if (game[0].status !== "in_progress") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game is not in progress" });
      }

      if (game[0].currentTurn !== ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not your turn" });
      }

      // Validate the player is part of this game
      if (game[0].player1Id !== ctx.session.user.id && game[0].player2Id !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a player in this game" });
      }

      // Deserialize current game state
      const currentGameState = deserializeGameState(game[0].boardState);

      // Validate the move
      if (!isValidMove(currentGameState, input.move as Move)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid move" });
      }

      // Apply the move
      const newGameState = applyMove(currentGameState, input.move as Move);

      // Get the next move number
      const moveCount = await ctx.db
        .select({ count: gameMoves.moveNumber })
        .from(gameMoves)
        .where(eq(gameMoves.gameId, input.gameId))
        .orderBy(desc(gameMoves.moveNumber))
        .limit(1);

      const nextMoveNumber = (moveCount[0]?.count ?? 0) + 1;

      // Save the move
      await ctx.db.insert(gameMoves).values({
        gameId: input.gameId,
        playerId: ctx.session.user.id,
        moveNumber: nextMoveNumber,
        fromRow: input.move.from.row,
        fromCol: input.move.from.col,
        toRow: input.move.to.row,
        toCol: input.move.to.col,
        capturedPieces: JSON.stringify(input.move.capturedPieces),
        moveType: input.move.type,
      });

      // Update the game state
      const [updatedGame] = await ctx.db
        .update(games)
        .set({
          boardState: serializeGameState(newGameState),
          currentTurn: newGameState.mustContinueCapture 
            ? ctx.session.user.id  // Same player continues if they must capture
            : newGameState.currentPlayer === 'red' 
              ? game[0].player1Id 
              : game[0].player2Id,
          status: newGameState.status === 'finished' ? 'finished' : 'in_progress',
          winnerId: newGameState.winner === 'red' ? game[0].player1Id : 
                   newGameState.winner === 'black' ? game[0].player2Id : null,
          lastMoveAt: new Date(),
        })
        .where(eq(games.id, input.gameId))
        .returning();

      return {
        game: updatedGame,
        gameState: newGameState,
      };
    }),

  // Make AI move (for single player games)
  makeAIMove: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      console.log("🤖 makeAIMove called for gameId:", input.gameId);
      
      // Use a transaction to prevent race conditions
      return await ctx.db.transaction(async (tx) => {
        console.log("🤖 Starting transaction for AI move");
        
        const game = await tx
          .select()
          .from(games)
          .where(eq(games.id, input.gameId))
          .limit(1)
          .for('update'); // Lock the row to prevent concurrent modifications

        if (!game[0]) {
          console.error("🤖 Game not found:", input.gameId);
          throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
        }

        console.log("🤖 Game found:", {
          gameId: game[0].id,
          gameMode: game[0].gameMode,
          status: game[0].status,
          aiPlayer: game[0].aiPlayer,
          currentTurn: game[0].currentTurn,
          player1Id: game[0].player1Id
        });

        if (game[0].gameMode !== "single_player_ai") {
          console.error("🤖 Not a single player game");
          throw new TRPCError({ code: "BAD_REQUEST", message: "Not a single player game" });
        }

        if (game[0].status !== "in_progress") {
          console.error("🤖 Game not in progress, status:", game[0].status);
          throw new TRPCError({ code: "BAD_REQUEST", message: "Game is not in progress" });
        }

        if (game[0].player1Id !== ctx.session.user.id) {
          console.error("🤖 Not user's game:", {
            gamePlayer1: game[0].player1Id,
            sessionUser: ctx.session.user.id
          });
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your game" });
        }

        // Check if it's AI's turn
        const gameState = deserializeGameState(game[0].boardState);
        const aiPlayer = game[0].aiPlayer as 'red' | 'black';
        
        console.log("🤖 Game state analysis:", {
          currentPlayer: gameState.currentPlayer,
          aiPlayer,
          status: gameState.status,
          isAITurn: gameState.currentPlayer === aiPlayer,
          mustContinueCapture: gameState.mustContinueCapture
        });
        
        if (gameState.currentPlayer !== aiPlayer) {
          console.error("🤖 Not AI's turn:", {
            currentPlayer: gameState.currentPlayer,
            aiPlayer
          });
          throw new TRPCError({ code: "BAD_REQUEST", message: "Not AI's turn" });
        }

        // Validate game state integrity
        if (gameState.status !== 'active') {
          console.error("🤖 Game not active, status:", gameState.status);
          throw new TRPCError({ code: "BAD_REQUEST", message: "Game is not active" });
        }

        // Import AI module dynamically to avoid server-side issues
        console.log("🤖 Getting AI move...");
        console.log("🤖 Current board state:", {
          pieces: gameState.board.flatMap((row, r) => 
            row.map((piece, c) => piece ? `${piece.player}-${piece.type}@${r},${c}` : null)
          ).filter(Boolean),
          aiPlayerPieces: gameState.board.flatMap((row, r) => 
            row.map((piece, c) => (piece?.player === aiPlayer) ? `${piece.type}@${r},${c}` : null)
          ).filter(Boolean),
          totalAIPieces: gameState.board.flatMap(row => row).filter(piece => piece?.player === aiPlayer).length
        });
        
        const { getAIMove } = await import("@/lib/checkers-ai");
        const { getAllLegalMoves } = await import("@/lib/checkers-logic");
        
        // Check legal moves available for AI
        const allLegalMoves = getAllLegalMoves(gameState);
        const aiLegalMoves = allLegalMoves.filter(move => {
          const piece = gameState.board[move.from.row]?.[move.from.col];
          return piece?.player === aiPlayer;
        });
        
        console.log("🤖 Legal moves analysis:", {
          totalLegalMoves: allLegalMoves.length,
          aiLegalMoves: aiLegalMoves.length,
          aiMovesSample: aiLegalMoves.slice(0, 3).map(move => ({
            from: `${move.from.row},${move.from.col}`,
            to: `${move.to.row},${move.to.col}`,
            piece: gameState.board[move.from.row]?.[move.from.col]
          }))
        });
        
        if (aiLegalMoves.length === 0) {
          console.error("🤖 No legal moves available for AI player:", aiPlayer);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI has no legal moves available" });
        }
        
        const aiMove = getAIMove(gameState, game[0].aiDifficulty as 'easy' | 'medium' | 'hard');

        if (!aiMove) {
          console.error('🤖 AI could not find a move. Game state:', {
            currentPlayer: gameState.currentPlayer,
            aiPlayer,
            status: gameState.status,
            boardHasPieces: gameState.board.some(row => row.some(cell => cell?.player === aiPlayer))
          });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI could not find a move" });
        }

        console.log("🤖 AI found move:", aiMove);

        // Double-check that the piece still exists at the source position
        const piece = gameState.board[aiMove.from.row]?.[aiMove.from.col];
        if (!piece?.player || piece.player !== aiPlayer) {
          console.error('🤖 Invalid AI move - no piece at source:', {
            move: aiMove,
            piece,
            currentPlayer: gameState.currentPlayer,
            aiPlayer
          });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI generated move for non-existent piece" });
        }

        // Validate the AI move before applying it
        if (!isValidMove(gameState, aiMove)) {
          console.error('🤖 Invalid AI move generated:', {
            move: aiMove,
            gameState: {
              currentPlayer: gameState.currentPlayer,
              mustContinueCapture: gameState.mustContinueCapture
            }
          });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI generated invalid move" });
        }

        // Apply the AI move
        console.log("🤖 Applying AI move...");
        console.log("🤖 Board before move:", {
          pieces: gameState.board.flatMap((row, r) => 
            row.map((piece, c) => piece ? `${piece.player}-${piece.type}@${r},${c}` : null)
          ).filter(Boolean)
        });
        console.log("🤖 AI move details:", {
          from: aiMove.from,
          to: aiMove.to,
          capturedPieces: aiMove.capturedPieces,
          type: aiMove.type
        });
        
        const newGameState = applyMove(gameState, aiMove);
        
        console.log("🤖 Board after move:", {
          pieces: newGameState.board.flatMap((row, r) => 
            row.map((piece, c) => piece ? `${piece.player}-${piece.type}@${r},${c}` : null)
          ).filter(Boolean)
        });
        console.log("🤖 AI move applied, new state:", {
          currentPlayer: newGameState.currentPlayer,
          status: newGameState.status,
          winner: newGameState.winner
        });

        // Get the next move number
        const moveCount = await tx
          .select({ count: gameMoves.moveNumber })
          .from(gameMoves)
          .where(eq(gameMoves.gameId, input.gameId))
          .orderBy(desc(gameMoves.moveNumber))
          .limit(1);

        const nextMoveNumber = (moveCount[0]?.count ?? 0) + 1;

        // Save the AI move
        await tx.insert(gameMoves).values({
          gameId: input.gameId,
          playerId: game[0].player1Id, // Use player1Id but mark it as AI move somehow
          moveNumber: nextMoveNumber,
          fromRow: aiMove.from.row,
          fromCol: aiMove.from.col,
          toRow: aiMove.to.row,
          toCol: aiMove.to.col,
          capturedPieces: JSON.stringify(aiMove.capturedPieces),
          moveType: aiMove.type,
        });

        // Update the game state with proper currentTurn logic for single-player
        const humanIsRed = aiPlayer === 'black';  // Human plays red if AI plays black
        const nextPlayerIsHuman = newGameState.currentPlayer === (humanIsRed ? 'red' : 'black');
        
        const [updatedGame] = await tx
          .update(games)
          .set({
            boardState: serializeGameState(newGameState),
            currentTurn: nextPlayerIsHuman ? game[0].player1Id : null, // Human player ID or null for AI
            status: newGameState.status === 'finished' ? 'finished' : 'in_progress',
            winnerId: newGameState.winner === 'red' ? game[0].player1Id : 
                     newGameState.winner === 'black' ? (aiPlayer === 'black' ? null : game[0].player1Id) : null,
            lastMoveAt: new Date(),
          })
          .where(eq(games.id, input.gameId))
          .returning();
          
        console.log("🤖 Game updated:", {
          currentPlayer: newGameState.currentPlayer,
          currentTurn: nextPlayerIsHuman ? game[0].player1Id : null,
          nextPlayerIsHuman
        });

        return {
          game: updatedGame,
          gameState: newGameState,
          aiMove,
        };
      });
    }),

  // Get game by ID with player details
  getById: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          game: games,
          player1: {
            id: usersPlayer1.id,
            name: usersPlayer1.name,
            email: usersPlayer1.email,
          },
        })
        .from(games)
        .leftJoin(usersPlayer1, eq(games.player1Id, usersPlayer1.id))
        .where(eq(games.id, input.gameId))
        .limit(1);

      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
      }

      const game = result[0].game;
      let player2 = null;

      if (game.player2Id) {
        const player2Result = await ctx.db
          .select({
            id: usersPlayer2.id,
            name: usersPlayer2.name,
            email: usersPlayer2.email,
          })
          .from(usersPlayer2)
          .where(eq(usersPlayer2.id, game.player2Id))
          .limit(1);
        
        player2 = player2Result[0] ?? null;
      }

      return {
        ...game,
        player1: result[0].player1,
        player2,
        gameState: deserializeGameState(game.boardState),
        currentUserId: ctx.session.user.id, // Include current user ID
      };
    }),

  // List games for lobby (waiting for players) - only show public games
  getAvailable: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db
        .select({
          game: games,
          player1: {
            id: usersPlayer1.id,
            name: usersPlayer1.name,
            email: usersPlayer1.email,
          },
        })
        .from(games)
        .leftJoin(usersPlayer1, eq(games.player1Id, usersPlayer1.id))
        .where(
          and(
            eq(games.status, "waiting_for_player"),
            eq(games.gameMode, "multiplayer"),
            eq(games.isPrivate, false), // Only show public games
            ne(games.player1Id, ctx.session.user.id), // Don't show own games
          )
        )
        .orderBy(desc(games.createdAt))
        .limit(20);
    }),

  // List user's games
  getMyGames: protectedProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db
        .select({
          game: games,
          player1: {
            id: usersPlayer1.id,
            name: usersPlayer1.name,
            email: usersPlayer1.email,
          },
          player2: {
            id: usersPlayer2.id,
            name: usersPlayer2.name, 
            email: usersPlayer2.email,
          },
        })
        .from(games)
        .leftJoin(usersPlayer1, eq(games.player1Id, usersPlayer1.id))
        .leftJoin(usersPlayer2, eq(games.player2Id, usersPlayer2.id))
        .where(
          or(
            eq(games.player1Id, ctx.session.user.id),
            eq(games.player2Id, ctx.session.user.id)
          )
        )
        .orderBy(desc(games.updatedAt))
        .limit(50); // Increased from 10 to show more games
        
      return {
        currentUserId: ctx.session.user.id,
        games: result,
      };
    }),

  // Get game moves history
  getMoves: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          move: gameMoves,
          player: {
            id: usersPlayer1.id,
            name: usersPlayer1.name,
          },
        })
        .from(gameMoves)
        .leftJoin(usersPlayer1, eq(gameMoves.playerId, usersPlayer1.id))
        .where(eq(gameMoves.gameId, input.gameId))
        .orderBy(asc(gameMoves.moveNumber));
    }),

  // Delete/abandon a game (only if you're a player)
  abandon: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db
        .select()
        .from(games)
        .where(eq(games.id, input.gameId))
        .limit(1);

      if (!game[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
      }

      if (game[0].player1Id !== ctx.session.user.id && game[0].player2Id !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a player in this game" });
      }

      if (game[0].status === "finished") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game is already finished" });
      }

      // Determine the winner (the other player)
      let winnerId = null;
      if (game[0].status === "in_progress") {
        winnerId = game[0].player1Id === ctx.session.user.id 
          ? game[0].player2Id 
          : game[0].player1Id;
      }

      await ctx.db
        .update(games)
        .set({
          status: "abandoned",
          winnerId,
        })
        .where(eq(games.id, input.gameId));

      return { success: true };
    }),

  // Debug/Admin procedure to manually set game status (helpful for testing)
  updateGameStatus: protectedProcedure
    .input(z.object({ 
      gameId: z.string(),
      status: z.enum(['waiting_for_player', 'in_progress', 'finished', 'abandoned']),
      winnerId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db
        .select()
        .from(games)
        .where(eq(games.id, input.gameId))
        .limit(1);

      if (!game[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
      }

      if (game[0].player1Id !== ctx.session.user.id && game[0].player2Id !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a player in this game" });
      }

      const [updatedGame] = await ctx.db
        .update(games)
        .set({
          status: input.status,
          winnerId: input.winnerId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(games.id, input.gameId))
        .returning();

      return updatedGame;
    }),
});