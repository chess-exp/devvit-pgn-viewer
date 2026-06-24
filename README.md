# PGN Viewer for Reddit

An interactive chess game viewer for Reddit, built with Devvit. Moderators can create custom posts from PGN notation, and users can replay games move-by-move with an interactive chessboard.

## Features

- **Interactive Chessboard**: Navigate through chess games with forward/backward controls
- **Move List**: Click any move to jump to that position
- **Position Cues**: Last-move highlighting and check/checkmate indicators
- **Puzzle Mode**: Start from the initial position and reveal the solution on demand
- **Flip Board**: View from either White or Black's perspective
- **Game Metadata**: Display player names, event, date, and result
- **PGN Validation**: Server-side validation ensures only valid PGN is accepted
- **Redis Storage**: Game data stored securely with integrity verification

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Login to Devvit:
   ```bash
   npm run login
   ```

3. Build the app:
   ```bash
   npm run build
   ```

4. Deploy to your subreddit:
   ```bash
   npm run deploy
   ```

## Development

```bash
# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Local development with hot reload
npm run dev
```

## Usage

### Creating a PGN Viewer Post

1. Navigate to your subreddit (as a moderator)
2. Open the three-dot menu (⋯) in the sidebar
3. Select "Create PGN Viewer"
4. Enter a post title, paste your PGN notation or FEN, and optionally enable puzzle mode
5. Click "Create"

### Supported PGN Format

The viewer supports standard PGN format including:
- Standard algebraic notation (SAN)
- Headers (Event, Site, Date, White, Black, Result)
- Comments `{like this}`
- Board drawings in comments: `[%csl Ge4,Yd5]` and `[%cal Gg1f3,Rd1d8]`
- Numeric annotation glyphs (NAGs): `!`, `?`, `!!`, `??`, `!?`, `?!`
- Castling: `O-O`, `O-O-O`
- Pawn promotion: `e8=Q`
- Check and checkmate: `+`, `#`

**Limits:**
- Title: 300 characters max
- PGN: 36,000 characters max

## Architecture

```
src/
├── client/              # React frontend
│   ├── components/
│   │   └── Viewer.tsx   # Main chess viewer component
│   ├── viewer.html      # HTML entry point
│   └── viewer.tsx       # React root
├── server/              # Hono backend
│   ├── routes/
│   │   ├── api.ts       # GET /api/pgn
│   │   ├── forms.ts     # POST /internal/form/create-pgn-viewer
│   │   └── menu.ts      # POST /internal/menu/create-pgn-viewer
│   ├── pgn.ts           # PGN validation helpers
│   ├── storage.ts       # Redis CRUD operations
│   └── index.ts         # Server entry point
└── shared/
    └── pgn.ts           # Shared types
```

## Data Flow

1. **Post Creation**:
   - Moderator submits PGN via form
   - Server validates PGN with chess.js
   - Valid PGN stored in Redis with UUID key
   - Custom post created with postData containing Redis key + metadata
   - SHA256 hash ensures integrity between Redis and postData

2. **Viewing**:
   - Client fetches `/api/pgn`
   - Server reads postData from context, fetches from Redis
   - Integrity verification via SHA256
   - Client renders interactive board with chess.js

## Testing

32 comprehensive tests covering:
- PGN normalization
- Validation (title, length, format, content)
- Edge cases (comments, NAGs, castling, promotion, checkmate)
- Board drawing annotations
- Header extraction
- Text fallback generation

Run with:
```bash
npm test
```

## Dependencies

**Runtime:**
- `@devvit/start`, `@devvit/web`, `@devvit/server`, `@devvit/redis` - Devvit framework
- `hono` - Web server
- `chess.js` - Chess logic and PGN parsing
- `react`, `react-dom` - UI framework
- `react-chessboard` - Interactive chessboard component
- `lucide-react` - Icons

**Dev:**
- `vite` - Build tool
- `vitest` - Test runner
- `typescript` - Type checking
- `eslint` - Linting
- `tailwindcss` - Styling

## License

BSD-3-Clause
