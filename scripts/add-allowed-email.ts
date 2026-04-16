#!/usr/bin/env node

/**
 * Script to add an allowed email to the database
 * Usage: node scripts/add-allowed-email.js your-email@example.com
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { allowedEmails } from '../src/server/db/schema.js';
import { eq } from 'drizzle-orm';

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Get email from command line arguments
const email: string = process.argv[2] ?? "";

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node scripts/add-allowed-email.js your-email@example.com');
  process.exit(1);
}

// Simple email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error('❌ Invalid email format');
  process.exit(1);
}

async function addAllowedEmail(email: string) {
  const client = postgres(databaseUrl!);
  const db = drizzle(client);

  try {
    console.log(`🔍 Checking if ${email} already exists...`);
    
    // Check if email already exists
    const existing = await db
      .select()
      .from(allowedEmails)
      .where(eq(allowedEmails.email, email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`✅ ${email} is already in the allowed list`);
      return;
    }

    // Add the email
    console.log(`➕ Adding ${email} to allowed emails...`);
    const result = await db
      .insert(allowedEmails)
      .values({ email })
      .returning();

    console.log(`✅ Successfully added ${email} to the allowed emails list!`);
    if (result[0]) {
      console.log(`📅 Added at: ${result[0].createdAt}`);
    }
    
    console.log('\n🎉 You can now sign in with this email address!');
    console.log('💡 Start the app with: pnpm dev');
    console.log('🌐 Then visit: http://localhost:3000');

  } catch (error) {
    console.error('❌ Error adding allowed email:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the script
addAllowedEmail(email);