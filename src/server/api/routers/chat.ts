import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { chatMessages, games } from "@/server/db/schema";
import { eq, and as _and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const chatRouter = createTRPCRouter({
  // Send a message
  sendMessage: protectedProcedure
    .input(z.object({
      gameId: z.string(),
      encryptedMessage: z.string(),
      iv: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user is part of the game
      const game = await ctx.db
        .select()
        .from(games)
        .where(eq(games.id, input.gameId))
        .limit(1);

      if (!game[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
      }

      const isPlayer = game[0].player1Id === ctx.session.user.id || 
                      game[0].player2Id === ctx.session.user.id;

      if (!isPlayer) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a player in this game" });
      }

      // Insert the encrypted message
      const [newMessage] = await ctx.db
        .insert(chatMessages)
        .values({
          gameId: input.gameId,
          senderId: ctx.session.user.id,
          encryptedMessage: input.encryptedMessage,
          iv: input.iv,
        })
        .returning();

      return newMessage;
    }),

  // Get messages for a game
  getMessages: protectedProcedure
    .input(z.object({
      gameId: z.string(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user is part of the game
      const game = await ctx.db
        .select()
        .from(games)
        .where(eq(games.id, input.gameId))
        .limit(1);

      if (!game[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
      }

      const isPlayer = game[0].player1Id === ctx.session.user.id || 
                      game[0].player2Id === ctx.session.user.id;

      if (!isPlayer) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a player in this game" });
      }

      // Get messages with sender info
      const messages = await ctx.db
        .select({
          id: chatMessages.id,
          encryptedMessage: chatMessages.encryptedMessage,
          iv: chatMessages.iv,
          createdAt: chatMessages.createdAt,
          senderId: chatMessages.senderId,
        })
        .from(chatMessages)
        .where(eq(chatMessages.gameId, input.gameId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(input.limit);

      return messages.reverse(); // Return in chronological order
    }),

  // Delete a message (only sender can delete)
  deleteMessage: protectedProcedure
    .input(z.object({
      messageId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Find the message and verify ownership
      const message = await ctx.db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.id, input.messageId))
        .limit(1);

      if (!message[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }

      if (message[0].senderId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own messages" });
      }

      await ctx.db
        .delete(chatMessages)
        .where(eq(chatMessages.id, input.messageId));

      return { success: true };
    }),
});