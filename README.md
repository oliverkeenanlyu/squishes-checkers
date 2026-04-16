# Squishes Checkers

A full-featured multiplayer checkers game built with the T3 Stack (Next.js, TypeScript, Tailwind, tRPC, Drizzle ORM, NextAuth.js) featuring:

- 🏁 Complete checkers game logic with all standard rules
- 🔐 Email-based authentication with whitelist access control  
- 🚀 Real-time multiplayer gameplay
- 🔒 End-to-end encrypted chat system
- 🎨 Clean, responsive UI with Tailwind CSS
- 📱 Mobile-friendly design
- 🎪 Game lobby with matchmaking

## Features

### Authentication & Security
- Email-based authentication via NextAuth.js
- Only approved email addresses can sign in
- Admin panel for managing allowed emails
- Secure session management

### Game Features
- Complete checkers implementation with:
  - Standard piece movement and capture rules
  - King promotion and movement
  - Mandatory capture rules
  - Multi-jump captures
  - Win condition detection
- Real-time multiplayer with automatic updates
- Game lobby for finding opponents
- Spectator mode for finished games

### Chat System
- End-to-end encrypted messages using WebCrypto API
- Real-time chat during games
- Privacy-focused design

### UI/UX
- Responsive design that works on all devices
- Beautiful game board with piece animations
- Intuitive piece selection and move highlighting
- Game state indicators and move history
- Clean, modern interface

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon for production)
- **ORM**: Drizzle ORM
- **Authentication**: NextAuth.js v5
- **API**: tRPC for type-safe APIs
- **Styling**: Tailwind CSS
- **Deployment**: Vercel-ready

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the root directory:

```bash
# Database (Neon PostgreSQL for production)
DATABASE_URL="postgresql://username:password@hostname:port/database"

# NextAuth
AUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Email Provider (for authentication emails)
SMTP_HOST="your-smtp-host"
SMTP_PORT="587"
SMTP_USER="your-smtp-username"
SMTP_PASSWORD="your-smtp-password"
EMAIL_FROM="noreply@yourdomain.com"

# Optional: Discord OAuth (for development/admin)
AUTH_DISCORD_ID="your-discord-client-id"
AUTH_DISCORD_SECRET="your-discord-client-secret"
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Database Setup

```bash
# Generate database migrations
pnpm db:generate

# Push the schema to your database
pnpm db:push

# Optional: Open Drizzle Studio to view your database
pnpm db:studio
```

### 4. Add Your First Allowed Email

You have two options:

**Option A: Use the admin interface (after starting the app)**
1. Temporarily add your email directly to the database
2. Start the app and visit `/admin`
3. Add more emails through the UI

**Option B: Add directly to the database**
```sql
INSERT INTO "squishes-checkers_allowed_email" (email) VALUES ('your-email@example.com');
```

### 5. Start the Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000` to see your app!

## Usage Guide

### For Players

1. **Sign In**: Visit the app and sign in with your approved email address
2. **Practice**: Play a local practice game from the home page
3. **Multiplayer**: Visit the lobby to create or join multiplayer games
4. **Chat**: Use the encrypted chat during games to communicate with opponents

### For Administrators

1. **Manage Access**: Visit `/admin` to add/remove allowed email addresses
2. **Monitor Games**: View active games and player activity
3. **User Management**: Control who can access the application

## Deployment

### Vercel Deployment

1. **Fork/Clone** this repository
2. **Connect to Vercel** and import your repository
3. **Set Environment Variables** in Vercel dashboard
4. **Deploy**!

### Database Setup (Neon)

1. Create a new database on [Neon](https://neon.tech)
2. Copy the connection string to your `DATABASE_URL`
3. Run the database migrations: `pnpm db:push`

### Email Configuration

For production, configure a reliable SMTP service:
- **SendGrid**, **Mailgun**, **AWS SES**, or similar
- Update the SMTP environment variables accordingly

## Game Rules

### Basic Rules
- Pieces move diagonally on dark squares only
- Normal pieces can only move forward
- Capture opponent pieces by jumping over them
- Captured pieces are removed from the board

### Advanced Rules
- **Mandatory Captures**: Must capture if possible
- **Multi-Jumps**: Continue capturing in the same turn if possible
- **King Promotion**: Pieces reaching the opposite end become kings
- **King Movement**: Kings can move backward and forward
- **Win Conditions**: Capture all opponent pieces or block all moves

## Development

### Project Structure
```
src/
├── app/                    # Next.js app router pages
│   ├── auth/              # Authentication pages
│   ├── game/              # Individual game pages
│   ├── lobby/             # Game lobby
│   └── admin/             # Admin panel
├── components/            # React components
│   ├── CheckersBoard.tsx  # Main game board
│   ├── CheckersPiece.tsx  # Individual pieces
│   ├── GameInfo.tsx       # Game information panel
│   └── GameChat.tsx       # Encrypted chat
├── lib/                   # Utility libraries
│   ├── checkers-logic.ts  # Core game logic
│   └── chat-crypto.ts     # Encryption utilities
└── server/                # Backend code
    ├── api/               # tRPC routers
    ├── auth/              # Authentication config
    └── db/                # Database schema
```

### Key Commands
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm type-check` - Run TypeScript checks
- `pnpm lint` - Run ESLint
- `pnpm db:studio` - Open database studio

## Security Notes

### Chat Encryption
- Messages are encrypted client-side using AES-GCM
- Encryption keys are derived from game IDs
- This provides privacy but is not secure against determined attackers
- Suitable for casual game chat, not sensitive communications

### Authentication
- Uses secure email-based authentication
- Session tokens are httpOnly and secure
- CSRF protection enabled
- Whitelist-based access control

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ using the T3 Stack
