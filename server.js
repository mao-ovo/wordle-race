const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const words = require('./words');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3000;

// Serve static assets from public
app.use(express.static(path.join(__dirname, 'public')));

// Global state
const players = {}; // socket.id -> player state
const rooms = {};   // roomCode -> room state

// Helper: generate 6-character uppercase room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]);
  return code;
}

// Wordle evaluation algorithm (standard rules)
function evaluateGuess(guess, answer) {
  const result = Array(5).fill('absent');
  const answerArr = answer.toUpperCase().split('');
  const guessArr = guess.toUpperCase().split('');

  // First pass: exact matches (green)
  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === answerArr[i]) {
      result[i] = 'correct';
      answerArr[i] = null;
    }
  }

  // Second pass: present letters (yellow)
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const idx = answerArr.indexOf(guessArr[i]);
    if (idx !== -1) {
      result[i] = 'present';
      answerArr[idx] = null;
    }
  }

  return result;
}

// Helper: compile player list for a room
function getRoomPlayerList(room) {
  return Array.from(room.playerIds).map(id => {
    const p = players[id];
    return {
      playerId: id,
      name: p ? p.name : 'Player',
      avatar: p ? p.avatar : 'terminal',
      isReady: p ? !!p.isReady : false,
      isHost: (id === room.hostId)
    };
  });
}

// End multiplayer game
function endGame(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    room.countdownTimer = null;
  }

  room.status = 'lobby';

  // Collect all players who participated (including any who disconnected late)
  const playerMap = new Map();

  // Populate active players in room
  room.playerIds.forEach(id => {
    const p = players[id];
    playerMap.set(id, {
      playerId: id,
      name: (p && p.name) ? p.name : 'Player',
      avatar: (p && p.avatar) ? p.avatar : 'terminal',
      wordsCompleted: p ? (p.mpWordsCompleted || 0) : 0,
      currentRow: p ? (p.mpRow || 0) : 0,
      bestLettersRight: p ? (p.mpBestLettersRight || 0) : 0,
      totalLettersRight: p ? (p.mpTotalLettersRight || 0) : 0,
      bestPresentLetters: p ? (p.mpBestPresentLetters || 0) : 0
    });
  });

  // Preserve any recorded participants who might have disconnected
  if (room.matchStats) {
    Object.values(room.matchStats).forEach(stat => {
      if (!playerMap.has(stat.playerId)) {
        playerMap.set(stat.playerId, { ...stat });
      } else {
        const existing = playerMap.get(stat.playerId);
        if (stat.wordsCompleted > existing.wordsCompleted) existing.wordsCompleted = stat.wordsCompleted;
        if (stat.bestLettersRight > existing.bestLettersRight) existing.bestLettersRight = stat.bestLettersRight;
        if (stat.totalLettersRight > existing.totalLettersRight) existing.totalLettersRight = stat.totalLettersRight;
        if (stat.currentRow > existing.currentRow) existing.currentRow = stat.currentRow;
      }
    });
  }

  const allPlayers = Array.from(playerMap.values());
  if (allPlayers.length === 0 && room.hostId && players[room.hostId]) {
    allPlayers.push({
      playerId: room.hostId,
      name: players[room.hostId].name || 'Player',
      avatar: players[room.hostId].avatar || 'terminal',
      wordsCompleted: 0,
      currentRow: 0,
      bestLettersRight: 0,
      totalLettersRight: 0,
      bestPresentLetters: 0
    });
  }
  const hasWinner = allPlayers.some(p => p.wordsCompleted > 0);

  allPlayers.sort((a, b) => {
    if (hasWinner) {
      // Primary: Words completed descending
      if (b.wordsCompleted !== a.wordsCompleted) {
        return b.wordsCompleted - a.wordsCompleted;
      }
      // Tie-breaker 1: Best letters right in current word
      if (b.bestLettersRight !== a.bestLettersRight) {
        return b.bestLettersRight - a.bestLettersRight;
      }
      // Tie-breaker 2: Total letters right across race
      if (b.totalLettersRight !== a.totalLettersRight) {
        return b.totalLettersRight - a.totalLettersRight;
      }
      // Tie-breaker 3: Rows reached
      return b.currentRow - a.currentRow;
    } else {
      // NOBODY SOLVED A WORD: Winner is who guessed most letters right
      // Primary: Best letters right in a single guess
      if (b.bestLettersRight !== a.bestLettersRight) {
        return b.bestLettersRight - a.bestLettersRight;
      }
      // Secondary: Total letters right across guesses
      if (b.totalLettersRight !== a.totalLettersRight) {
        return b.totalLettersRight - a.totalLettersRight;
      }
      // Tertiary: Yellow (present) letters
      if (b.bestPresentLetters !== a.bestPresentLetters) {
        return b.bestPresentLetters - a.bestPresentLetters;
      }
      // Fourth: Rows attempted
      return b.currentRow - a.currentRow;
    }
  });

  const leaderboard = allPlayers.map((p, idx) => ({
    ...p,
    rank: idx + 1
  }));

  io.to(roomCode).emit('game-over', {
    leaderboard,
    hasWinner
  });

  // Reset ready state for next game
  room.playerIds.forEach(id => {
    if (players[id]) {
      players[id].isReady = false;
    }
  });
}

// Remove player from room and cleanup
function leaveRoom(socketId) {
  const player = players[socketId];
  if (!player || !player.roomCode) return;

  const roomCode = player.roomCode;
  const room = rooms[roomCode];
  player.roomCode = null;
  player.isReady = false;

  if (!room) return;

  room.playerIds.delete(socketId);
  const sock = io.sockets.sockets.get(socketId);
  if (sock) {
    sock.leave(roomCode);
  }

  // If room is now empty, delete it
  if (room.playerIds.size === 0) {
    if (room.timer) clearInterval(room.timer);
    if (room.countdownTimer) clearTimeout(room.countdownTimer);
    delete rooms[roomCode];
    return;
  }

  // If host left, assign new host
  let newHostId = null;
  if (room.hostId === socketId) {
    const remainingIds = Array.from(room.playerIds);
    newHostId = remainingIds[0];
    room.hostId = newHostId;
  }

  const updatedPlayerList = getRoomPlayerList(room);

  io.to(roomCode).emit('player-left', {
    playerId: socketId,
    players: updatedPlayerList,
    newHostId: room.hostId
  });

  if (player.name) {
    const leaveMsg = {
      id: 'sys_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      isSystem: true,
      message: `${player.name} left the room`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };
    if (room.chatHistory) room.chatHistory.push(leaveMsg);
    io.to(roomCode).emit('room-chat-message', leaveMsg);
  }

  // If game was playing and no one or only 1 player remains, check if we need to end
  if (room.status === 'playing' && room.playerIds.size === 0) {
    endGame(roomCode);
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  // Initialize default player state
  players[socket.id] = {
    id: socket.id,
    name: 'Player',
    avatar: 'terminal',
    roomCode: null,
    isReady: false,
    // Single player state
    spLevel: 1,
    spWord: '',
    spRow: 0,
    spGuesses: [],
    spExcludedWords: {},
    // Multiplayer race state
    mpWordIndex: 0,
    mpRow: 0,
    mpWordsCompleted: 0,
    mpGuesses: []
  };

  // Set profile (name & avatar)
  socket.on('set-profile', (data) => {
    const player = players[socket.id];
    if (!player) return;

    if (data.name && typeof data.name === 'string') {
      player.name = data.name.trim().slice(0, 15) || 'Player';
    }
    if (data.avatar && typeof data.avatar === 'string') {
      player.avatar = data.avatar;
    }

    if (player.roomCode && rooms[player.roomCode]) {
      const room = rooms[player.roomCode];
      io.to(player.roomCode).emit('players-update', {
        players: getRoomPlayerList(room),
        hostId: room.hostId
      });
    }
  });

  // ===== MULTIPLAYER ROOM EVENTS =====

  // Create Room
  socket.on('create-room', (data) => {
    leaveRoom(socket.id);

    const player = players[socket.id];
    const minLimit = (process.env.PORT === '3099' || process.env.NODE_ENV === 'test') ? 1 : 30;
    const timeLimit = Math.max(minLimit, Math.min(1800, parseInt(data.timeLimit) || 180));
    const roomCode = generateRoomCode();

    const room = {
      code: roomCode,
      hostId: socket.id,
      timeLimit: timeLimit,
      playerIds: new Set([socket.id]),
      status: 'lobby', // 'lobby' | 'countdown' | 'playing'
      wordSequence: [],
      timer: null,
      countdownTimer: null,
      remainingTime: timeLimit,
      chatHistory: []
    };

    rooms[roomCode] = room;
    player.roomCode = roomCode;
    player.isReady = false;

    socket.join(roomCode);

    socket.emit('room-created', {
      roomCode: roomCode,
      chatHistory: room.chatHistory,
      player: {
        playerId: socket.id,
        name: player.name,
        avatar: player.avatar,
        isReady: false,
        isHost: true
      }
    });
  });

  // Join Room
  socket.on('join-room', (data) => {
    if (!data || !data.roomCode) {
      return socket.emit('error', { message: 'Room code is required' });
    }

    const code = String(data.roomCode).trim().toUpperCase();
    const room = rooms[code];

    if (!room) {
      return socket.emit('error', { message: 'Room not found. Check code!' });
    }

    if (room.status !== 'lobby') {
      return socket.emit('error', { message: 'Race already in progress in this room!' });
    }

    if (room.playerIds.size >= 10) {
      return socket.emit('error', { message: 'Room is full! Maximum 10 players.' });
    }

    leaveRoom(socket.id);

    const player = players[socket.id];
    player.roomCode = code;
    player.isReady = false;
    room.playerIds.add(socket.id);

    socket.join(code);

    const playerList = getRoomPlayerList(room);

    socket.emit('room-joined', {
      roomCode: code,
      players: playerList,
      timeLimit: room.timeLimit,
      hostId: room.hostId,
      chatHistory: room.chatHistory || []
    });

    socket.to(code).emit('player-joined', {
      player: {
        playerId: socket.id,
        name: player.name,
        avatar: player.avatar,
        isReady: false,
        isHost: false
      }
    });

    const joinMsg = {
      id: 'sys_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      isSystem: true,
      message: `${player.name} joined the room`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };
    if (!room.chatHistory) room.chatHistory = [];
    room.chatHistory.push(joinMsg);
    io.to(code).emit('room-chat-message', joinMsg);
  });

  // Send Room Chat Message
  socket.on('send-room-chat', (data) => {
    const player = players[socket.id];
    if (!player || !player.roomCode) return;

    const room = rooms[player.roomCode];
    if (!room) return;

    if (!data || typeof data.message !== 'string') return;
    const text = data.message.trim();
    if (!text || text.length > 200) return;

    const chatMsg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      senderId: socket.id,
      senderName: player.name || 'Player',
      senderAvatar: player.avatar || 'terminal',
      message: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    if (!room.chatHistory) room.chatHistory = [];
    room.chatHistory.push(chatMsg);
    if (room.chatHistory.length > 50) {
      room.chatHistory.shift();
    }

    io.to(player.roomCode).emit('room-chat-message', chatMsg);
  });

  // Rejoin room after reconnection
  socket.on('rejoin-room', (data) => {
    if (!data || !data.roomCode) return;
    const code = String(data.roomCode).trim().toUpperCase();
    const room = rooms[code];
    if (!room) return;

    const player = players[socket.id];
    if (!player) return;

    player.roomCode = code;
    room.playerIds.add(socket.id);
    socket.join(code);

    socket.emit('room-rejoined', {
      roomCode: code,
      players: getRoomPlayerList(room),
      timeLimit: room.timeLimit,
      hostId: room.hostId,
      status: room.status,
      chatHistory: room.chatHistory || []
    });
  });

  // Toggle ready status
  socket.on('toggle-ready', () => {
    const player = players[socket.id];
    if (!player || !player.roomCode) return;

    const room = rooms[player.roomCode];
    if (!room || room.status !== 'lobby') return;

    player.isReady = !player.isReady;

    io.to(player.roomCode).emit('ready-update', {
      playerId: socket.id,
      isReady: player.isReady
    });
  });

  // Start game (Host only)
  socket.on('start-game', () => {
    const player = players[socket.id];
    if (!player || !player.roomCode) return;

    const room = rooms[player.roomCode];
    if (!room) return;

    if (room.hostId !== socket.id) {
      return socket.emit('error', { message: 'Only the host can start the race!' });
    }

    if (room.status !== 'lobby') return;

    // Check if everyone is ready
    const notReady = Array.from(room.playerIds).some(id => {
      const p = players[id];
      // All players must be marked ready (or if host clicks start, ensure all others are ready)
      return p && !p.isReady && id !== room.hostId;
    });

    if (notReady) {
      return socket.emit('error', { message: 'All players must press Ready to start!' });
    }

    room.status = 'countdown';

    // Prepare 100 multiplayer race words
    room.wordSequence = words.getMultiplayerWords(100);

    // Reset player race stats and initialize match record
    room.matchStats = {};
    room.playerIds.forEach(id => {
      const p = players[id];
      if (p) {
        p.mpWordIndex = 0;
        p.mpRow = 0;
        p.mpWordsCompleted = 0;
        p.mpGuesses = [];
        p.mpBestLettersRight = 0;
        p.mpTotalLettersRight = 0;
        p.mpBestPresentLetters = 0;

        room.matchStats[id] = {
          playerId: id,
          name: p.name || 'Player',
          avatar: p.avatar || 'terminal',
          wordsCompleted: 0,
          currentRow: 0,
          bestLettersRight: 0,
          totalLettersRight: 0,
          bestPresentLetters: 0
        };
      }
    });

    // 3 - 2 - 1 - GO Countdown sequence
    io.to(room.code).emit('game-countdown', { count: 3 });

    setTimeout(() => {
      if (!rooms[room.code] || rooms[room.code].status !== 'countdown') return;
      io.to(room.code).emit('game-countdown', { count: 2 });

      setTimeout(() => {
        if (!rooms[room.code] || rooms[room.code].status !== 'countdown') return;
        io.to(room.code).emit('game-countdown', { count: 1 });

        setTimeout(() => {
          if (!rooms[room.code] || rooms[room.code].status !== 'countdown') return;
          // count 0 triggers "GO!" in client
          io.to(room.code).emit('game-countdown', { count: 0 });

          // Start actual race
          room.status = 'playing';
          room.remainingTime = room.timeLimit;

          io.to(room.code).emit('game-started', { timeLimit: room.timeLimit });

          // Start timer interval (1s)
          if (room.timer) clearInterval(room.timer);
          room.timer = setInterval(() => {
            room.remainingTime--;
            io.to(room.code).emit('timer-update', { remaining: room.remainingTime });

            if (room.remainingTime <= 0) {
              clearInterval(room.timer);
              room.timer = null;
              endGame(room.code);
            }
          }, 1000);

        }, 1000);
      }, 1000);
    }, 1000);
  });

  // Submit multiplayer guess
  socket.on('submit-guess', (data) => {
    const player = players[socket.id];
    if (!player || !player.roomCode) return;

    const room = rooms[player.roomCode];
    if (!room || room.status !== 'playing') return;

    if (!data || typeof data.guess !== 'string') return;
    const guess = data.guess.trim().toUpperCase();

    if (guess.length !== 5) {
      return socket.emit('error', { message: 'Guess must be 5 letters' });
    }

    if (!words.isValidGuess(guess)) {
      return socket.emit('error', { message: 'Not in word list' });
    }

    const currentAnswer = room.wordSequence[player.mpWordIndex];
    if (!currentAnswer) {
      return socket.emit('error', { message: 'No more words in race' });
    }

    const results = evaluateGuess(guess, currentAnswer);
    const isCorrect = (guess === currentAnswer);

    // Track letter performance
    const correctCount = results.filter(r => r === 'correct').length;
    const presentCount = results.filter(r => r === 'present').length;

    player.mpTotalLettersRight = (player.mpTotalLettersRight || 0) + correctCount;
    if (correctCount > (player.mpBestLettersRight || 0)) {
      player.mpBestLettersRight = correctCount;
    }
    if (presentCount > (player.mpBestPresentLetters || 0)) {
      player.mpBestPresentLetters = presentCount;
    }

    // Send guess result to guesser
    socket.emit('guess-result', {
      guess,
      results,
      isCorrect,
      row: player.mpRow
    });

    if (isCorrect) {
      player.mpWordsCompleted++;
      const finishedIndex = player.mpWordIndex;
      player.mpWordIndex++;
      player.mpRow = 0;
      player.mpGuesses = [];
      player.mpBestLettersRight = 0;
      player.mpBestPresentLetters = 0;

      if (room.matchStats && room.matchStats[socket.id]) {
        room.matchStats[socket.id].wordsCompleted = player.mpWordsCompleted;
        room.matchStats[socket.id].currentRow = 0;
        room.matchStats[socket.id].bestLettersRight = 0;
        room.matchStats[socket.id].totalLettersRight = player.mpTotalLettersRight;
        room.matchStats[socket.id].bestPresentLetters = 0;
      }

      socket.emit('word-complete', {
        wordNumber: finishedIndex + 1,
        wordsCompleted: player.mpWordsCompleted,
        answer: currentAnswer,
        wasCorrect: true
      });

      // Broadcast progress update to all players
      io.to(room.code).emit('opponent-update', {
        playerId: socket.id,
        name: player.name,
        avatar: player.avatar,
        wordsCompleted: player.mpWordsCompleted,
        currentRow: 0
      });

      // Next word prompt for this player
      socket.emit('next-word', {
        wordNumber: player.mpWordIndex + 1
      });

    } else {
      player.mpRow++;

      if (player.mpRow >= 6) {
        // Failed this word after 6 attempts, move forward
        const finishedIndex = player.mpWordIndex;
        player.mpWordIndex++;
        player.mpRow = 0;
        player.mpGuesses = [];
        player.mpBestLettersRight = 0;
        player.mpBestPresentLetters = 0;

        if (room.matchStats && room.matchStats[socket.id]) {
          room.matchStats[socket.id].wordsCompleted = player.mpWordsCompleted;
          room.matchStats[socket.id].currentRow = 0;
          room.matchStats[socket.id].bestLettersRight = 0;
          room.matchStats[socket.id].totalLettersRight = player.mpTotalLettersRight;
          room.matchStats[socket.id].bestPresentLetters = 0;
        }

        socket.emit('word-complete', {
          wordNumber: finishedIndex + 1,
          wordsCompleted: player.mpWordsCompleted,
          answer: currentAnswer,
          wasCorrect: false
        });

        io.to(room.code).emit('opponent-update', {
          playerId: socket.id,
          name: player.name,
          avatar: player.avatar,
          wordsCompleted: player.mpWordsCompleted,
          currentRow: 0
        });

        socket.emit('next-word', {
          wordNumber: player.mpWordIndex + 1
        });
      } else {
        if (room.matchStats && room.matchStats[socket.id]) {
          room.matchStats[socket.id].wordsCompleted = player.mpWordsCompleted;
          room.matchStats[socket.id].currentRow = player.mpRow;
          room.matchStats[socket.id].bestLettersRight = player.mpBestLettersRight;
          room.matchStats[socket.id].totalLettersRight = player.mpTotalLettersRight;
          room.matchStats[socket.id].bestPresentLetters = player.mpBestPresentLetters;
        }

        // Update opponent view of current row attempt
        io.to(room.code).emit('opponent-update', {
          playerId: socket.id,
          name: player.name,
          avatar: player.avatar,
          wordsCompleted: player.mpWordsCompleted,
          currentRow: player.mpRow
        });
      }
    }
  });

  // Leave room
  socket.on('leave-room', () => {
    leaveRoom(socket.id);
  });

  // ===== SINGLE PLAYER EVENTS =====

  // Start a single player level (1 to 100)
  socket.on('sp-start', (data) => {
    const player = players[socket.id];
    if (!player) return;

    const level = Math.max(1, Math.min(100, parseInt(data.level) || 1));
    if (!player.spExcludedWords) player.spExcludedWords = {};
    const excluded = player.spExcludedWords[level] || [];
    const word = words.getWordForLevel(level, excluded);

    if (!word) {
      return socket.emit('error', { message: 'Level word not found' });
    }

    player.spLevel = level;
    player.spWord = word;
    player.spRow = 0;
    player.spGuesses = [];

    socket.emit('sp-ready', { level });
  });

  // Submit single player guess
  socket.on('sp-guess', (data) => {
    const player = players[socket.id];
    if (!player || !player.spWord) return;

    if (!data || typeof data.guess !== 'string') return;
    const guess = data.guess.trim().toUpperCase();

    if (guess.length !== 5) {
      return socket.emit('error', { message: 'Guess must be 5 letters' });
    }

    if (!words.isValidGuess(guess)) {
      return socket.emit('error', { message: 'Not in word list' });
    }

    const answer = player.spWord;
    const results = evaluateGuess(guess, answer);
    const isCorrect = (guess === answer);

    socket.emit('sp-guess-result', {
      guess,
      results,
      isCorrect,
      row: player.spRow
    });

    if (isCorrect) {
      if (player.spExcludedWords && player.spExcludedWords[player.spLevel]) {
        delete player.spExcludedWords[player.spLevel];
      }
      socket.emit('sp-level-complete', {
        level: player.spLevel
      });
    } else {
      player.spRow++;
      if (player.spRow >= 6) {
        if (!player.spExcludedWords) player.spExcludedWords = {};
        if (!player.spExcludedWords[player.spLevel]) player.spExcludedWords[player.spLevel] = [];
        player.spExcludedWords[player.spLevel].push(answer);

        socket.emit('sp-level-failed', {
          level: player.spLevel,
          answer: answer
        });
      }
    }
  });

  // Disconnect cleanup
  socket.on('disconnect', () => {
    leaveRoom(socket.id);
    delete players[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`🎮 Wordle Race running on http://localhost:${PORT}`);
});
