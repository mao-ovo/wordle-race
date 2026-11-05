# Wordle Race

Multiplayer speed-racing Wordle and 100-level single player campaign.

## Features

- **Multiplayer Race**: Create private rooms with custom time limits (1–30 min) for up to 10 players. Race in real time to solve the most words before the clock expires.
- **Single Player Campaign**: 100 progressive levels with open access to jump to any level anytime.
- **Real-Time Telemetry**: Live standings showing competitors' active row progress and words solved count.
- **Zero-Slop UI**: Clean, neutral design system built with Tailwind CSS, shadcn/ui primitives, and Lucide icons.
- **Sound Effects**: Procedurally synthesized audio feedback using the Web Audio API (no external asset dependencies).

## Local Development

```bash
# Install dependencies
npm install

# Start the game server
npm start
```

Visit `http://localhost:3000` in your browser.

## Run Tests

```bash
npm test
```

## Online Deployment (for playing with friends)

Because this game uses WebSockets (Socket.io) for real-time multiplayer, it requires a Node.js host.

### Deploying to Render (Free)
1. Push this repository to GitHub.
2. Go to [render.com](https://render.com) and create a free account.
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Click **Deploy Web Service**. You will get a free public URL (e.g. `https://wordle-race.onrender.com`) that you and your friends can open from anywhere!
