import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { allowedEmails } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const allowedEmailsRouter = createTRPCRouter({
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      // Check if user is admin
      const userEmail = ctx.session.user.email;
      if (!userEmail) throw new Error("No email found in session");
      
      const userRecord = await ctx.db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, userEmail))
        .limit(1);
      
      if (!userRecord[0]?.isAdmin) {
        throw new Error("Unauthorized: Admin access required");
      }
      
      return ctx.db.select().from(allowedEmails).orderBy(allowedEmails.email);
    }),

  add: protectedProcedure
    .input(z.object({ 
      email: z.string().email(),
      isAdmin: z.boolean().optional().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      const userEmail = ctx.session.user.email;
      if (!userEmail) throw new Error("No email found in session");
      
      const userRecord = await ctx.db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, userEmail))
        .limit(1);
      
      if (!userRecord[0]?.isAdmin) {
        throw new Error("Unauthorized: Admin access required");
      }
      
      // Check if email already exists
      const existing = await ctx.db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, input.email))
        .limit(1);

      if (existing.length > 0) {
        throw new Error("Email is already in the allowed list");
      }

      return ctx.db.insert(allowedEmails).values({
        email: input.email,
        isAdmin: input.isAdmin,
      }).returning();
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      const userEmail = ctx.session.user.email;
      if (!userEmail) throw new Error("No email found in session");
      
      const userRecord = await ctx.db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, userEmail))
        .limit(1);
      
      if (!userRecord[0]?.isAdmin) {
        throw new Error("Unauthorized: Admin access required");
      }
      
      return ctx.db
        .delete(allowedEmails)
        .where(eq(allowedEmails.id, input.id))
        .returning();
    }),

  check: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, input.email))
        .limit(1);
      
      return result.length > 0;
    }),

  isAdmin: protectedProcedure
    .query(async ({ ctx }) => {
      const userEmail = ctx.session.user.email;
      if (!userEmail) return false;
      
      const userRecord = await ctx.db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, userEmail))
        .limit(1);
      
      return userRecord[0]?.isAdmin ?? false;
    }),
});