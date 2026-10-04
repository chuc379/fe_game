# Game Theory - Frontend

Next.js UI cho Game Theory: Guess 2/3 of Average

## Features

- 👤 **Player UI**: Join room, submit guess, see live results
- 👨‍💼 **MC Dashboard**: Create room, calculate results
- 🔌 **Real-time Socket.io**: Live updates từ backend
- 📱 **Responsive**: Hoạt động trên desktop & mobile

## Setup

```bash
npm install
npm run dev
```

Server chạy ở `http://localhost:3000`

## Structure

```
FE/
├── app/
│   ├── page.tsx           # Home menu
│   ├── player/            # Player UI
│   └── mc/                # MC Dashboard
├── lib/
│   ├── socket.ts          # Socket.io client
│   └── store.ts           # Zustand store
├── package.json
└── tsconfig.json
```

## Build & Deploy

```bash
npm run build
npm start
```

Deploy lên Vercel, Netlify, hay hosting bất kỳ.

## Env vars

```
NEXT_PUBLIC_SOCKET_URL=https://game-theory-gateway.onrender.com
```

## API

Tất cả communication qua Socket.io - xem `BE/API_SCHEMA.md`

Events:
- `join_room` - Player join
- `submit_guess` - Submit guess
- `calculate_result` - MC tính results
- `round_result_ready` - Broadcast results
