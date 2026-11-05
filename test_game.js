const io = require('socket.io-client');
const words = require('./words');

// Start server child process or require it
process.env.PORT = '3099';
require('./server.js');

const SERVER_URL = 'http://localhost:3099';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🚀 Starting end-to-end tests for Wordle Race...');

  // 1. Test Player 1 (Host)
  const p1 = io(SERVER_URL);
  await new Promise(res => p1.on('connect', res));
  console.log('✓ Player 1 connected');

  p1.emit('set-profile', { name: 'Alice', avatar: '🦊' });

  // Create room
  let roomCode = null;
  const roomCreatedPromise = new Promise(resolve => {
    p1.on('room-created', data => {
      roomCode = data.roomCode;
      resolve(data);
    });
  });

  p1.emit('create-room', { timeLimit: 120 });
  const roomData = await roomCreatedPromise;
  console.log('✓ Room created with code:', roomCode, 'Time limit:', roomData.player.isHost);
  if (!roomCode || roomCode.length !== 6) throw new Error('Invalid room code: ' + roomCode);

  // 2. Test Player 2 (Bob) joins
  const p2 = io(SERVER_URL);
  await new Promise(res => p2.on('connect', res));
  console.log('✓ Player 2 connected');

  p2.emit('set-profile', { name: 'Bob', avatar: '🤖' });

  const p2JoinedPromise = new Promise(resolve => {
    p2.on('room-joined', resolve);
  });
  const p1SawP2JoinPromise = new Promise(resolve => {
    p1.on('player-joined', resolve);
  });

  p2.emit('join-room', { roomCode });
  const p2Room = await p2JoinedPromise;
  const p1Notif = await p1SawP2JoinPromise;
  console.log('✓ Player 2 successfully joined room. Total players:', p2Room.players.length);
  if (p2Room.players.length !== 2) throw new Error('Expected 2 players in room');

  // 3. Test Ready toggle
  const readyPromise = new Promise(resolve => {
    p1.on('ready-update', resolve);
  });
  p2.emit('toggle-ready', {});
  const readyUpdate = await readyPromise;
  console.log('✓ Player 2 ready status received:', readyUpdate.isReady);
  if (!readyUpdate.isReady) throw new Error('Player 2 should be ready');

  // 4. Test Game Start and Countdown
  let countdowns = [];
  p1.on('game-countdown', data => {
    countdowns.push(data.count);
  });

  const p1GameStartedPromise = new Promise(resolve => p1.on('game-started', resolve));
  const p2GameStartedPromise = new Promise(resolve => p2.on('game-started', resolve));

  p1.emit('start-game', {});

  const [p1Start, p2Start] = await Promise.all([p1GameStartedPromise, p2GameStartedPromise]);
  console.log('✓ Game started for both players! Countdowns received:', countdowns);
  if (p1Start.timeLimit !== 120) throw new Error('Expected timeLimit 120');

  // 5. Test multiplayer guess
  const guessPromise = new Promise(resolve => {
    p1.on('guess-result', resolve);
  });
  const p2SawOpponentUpdate = new Promise(resolve => {
    p2.on('opponent-update', resolve);
  });

  p1.emit('submit-guess', { guess: 'PIZZA' });
  const guessResult = await guessPromise;
  console.log('✓ Player 1 guess PIZZA evaluated:', guessResult.results);
  if (!Array.isArray(guessResult.results) || guessResult.results.length !== 5) {
    throw new Error('Invalid guess results');
  }

  const oppUpdate = await p2SawOpponentUpdate;
  console.log('✓ Player 2 received opponent update:', oppUpdate.name, 'row:', oppUpdate.currentRow);

  // 6. Test Single Player
  console.log('Testing Single Player mode...');
  const p3 = io(SERVER_URL);
  await new Promise(res => p3.on('connect', res));
  
  const spReadyPromise = new Promise(resolve => p3.on('sp-ready', resolve));
  p3.emit('sp-start', { level: 1 });
  const spReady = await spReadyPromise;
  console.log('✓ Single player level 1 ready:', spReady.level);

  // Guess level 1 word (which is 'HOUSE')
  const spCompletePromise = new Promise(resolve => p3.on('sp-level-complete', resolve));
  p3.emit('sp-guess', { guess: 'HOUSE' });
  const spComplete = await spCompletePromise;
  console.log('✓ Single player level complete for level:', spComplete.level);

  // Cleanup
  p1.disconnect();
  p2.disconnect();
  p3.disconnect();

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! The multiplayer Wordle Race is fully working!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
