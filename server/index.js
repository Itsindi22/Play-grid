// server/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const PORT = 4000;

// ------------------ OBJECT LIST --------------------
const OBJECTS = [
  {
    name: "apple",
    isAlive: false,
    isFood: true,
    isElectronic: false,
    isBiggerThanHand: false,
    isPortable: true,
    isAnimal: false,
    isVehicle: false,
    isIndoor: true,
    isOutdoor: true,
  },
  {
    name: "cat",
    isAlive: true,
    isFood: false,
    isElectronic: false,
    isBiggerThanHand: false,
    isPortable: "maybe",
    isAnimal: true,
    isVehicle: false,
    isIndoor: true,
    isOutdoor: true,
  },
  {
    name: "phone",
    isAlive: false,
    isFood: false,
    isElectronic: true,
    isBiggerThanHand: false,
    isPortable: true,
    isAnimal: false,
    isVehicle: false,
    isIndoor: true,
    isOutdoor: true,
  },
  {
    name: "car",
    isAlive: false,
    isFood: false,
    isElectronic: true,
    isBiggerThanHand: true,
    isPortable: false,
    isAnimal: false,
    isVehicle: true,
    isIndoor: false,
    isOutdoor: true,
  },
  {
    name: "book",
    isAlive: false,
    isFood: false,
    isElectronic: false,
    isBiggerThanHand: false,
    isPortable: true,
    isAnimal: false,
    isVehicle: false,
    isIndoor: true,
    isOutdoor: true,
  },
  {
    name: "pizza",
    isAlive: false,
    isFood: true,
    isElectronic: false,
    isBiggerThanHand: true,
    isPortable: "maybe",
    isAnimal: false,
    isVehicle: false,
    isIndoor: true,
    isOutdoor: false,
  },
  {
    name: "laptop",
    isAlive: false,
    isFood: false,
    isElectronic: true,
    isBiggerThanHand: false,
    isPortable: true,
    isAnimal: false,
    isVehicle: false,
    isIndoor: true,
    isOutdoor: true,
  },
];

// Convert true/false/"maybe" → "yes" / "no" / "maybe"
function yesNo(v) {
  if (v === true) return "yes";
  if (v === false) return "no";
  return "maybe";
}

// Map questionKey → object property
function answerQuestion(object, key) {
  const map = {
    alive: "isAlive",
    food: "isFood",
    electronic: "isElectronic",
    bigger_than_hand: "isBiggerThanHand",
    portable: "isPortable",
    animal: "isAnimal",
    vehicle: "isVehicle",
    indoor: "isIndoor",
    outdoor: "isOutdoor",
  };

  const prop = map[key];
  return yesNo(object[prop]);
}

// Room data
// rooms[roomCode] = {
//   players: [{ id, name, score }],
//   secretObject,
//   usedItems: [name],
//   isStarted,
//   winner,
//   askedQuestions: [labelLower],
//   forfeited: Set<socketId>
// }
const rooms = {};

app.get("/", (req, res) => {
  res.send("Guess in the Box server running!");
});

// ---------------- SOCKET LOGIC ---------------------
io.on("connection", (socket) => {
  console.log("🟢 Player connected:", socket.id);

  // Join Room
  socket.on("join_room", ({ roomCode, playerName }) => {
    if (!roomCode || !playerName) {
      socket.emit("error_message", "Room code and name required.");
      return;
    }

    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        secretObject: null,
        usedItems: [],
        isStarted: false,
        winner: null,
        askedQuestions: [],
        forfeited: new Set(),
      };
    }

    const room = rooms[roomCode];

    if (room.players.length >= 2) {
      socket.emit("error_message", "Room is full.");
      return;
    }

    socket.join(roomCode);

    // Add player with score if new
    const existing = room.players.find((p) => p.id === socket.id);
    if (!existing) {
      room.players.push({ id: socket.id, name: playerName, score: 0 });
    }

    socket.emit("room_joined", {
      roomCode,
      playerName,
      players: room.players,
    });

    socket.to(roomCode).emit("player_joined", {
      playerName,
      players: room.players,
    });

    if (room.players.length === 2 && !room.isStarted) {
      startGame(roomCode);
    } else {
      socket.emit("waiting_for_player", "Waiting for another player…");
    }
  });

  // Ask Question (supports custom text & no repeat)
  socket.on(
    "ask_question",
    ({ roomCode, questionKey, playerName, questionText }) => {
      const room = rooms[roomCode];
      if (!room || !room.isStarted || !room.secretObject) return;

      const answer = answerQuestion(room.secretObject, questionKey);

      const label =
        questionText && questionText.trim().length
          ? questionText.trim()
          : questionKey;

      const labelLower = label.toLowerCase();
      // No repeat questions in this game
      if (room.askedQuestions.includes(labelLower)) {
        socket.emit("error_message", "That question was already asked.");
        return;
      }
      room.askedQuestions.push(labelLower);

      io.to(roomCode).emit("question_answered", {
        questionKey,
        answer,
        playerName,
        questionLabel: label,
      });
    }
  );

  // Word Guess
  socket.on("make_guess", ({ roomCode, guess, playerName }) => {
    const room = rooms[roomCode];
    if (!room || !room.secretObject || !room.isStarted) return;

    if (!guess || typeof guess !== "string") return;

    const cleaned = guess.trim().toLowerCase();
    const target = room.secretObject.name.toLowerCase();

    if (!cleaned) return;

    if (cleaned === target) {
      room.isStarted = false;
      room.winner = playerName;

      // increment score
      const player = room.players.find((p) => p.name === playerName);
      if (player) {
        player.score = (player.score || 0) + 1;
      }

      io.to(roomCode).emit("game_over", {
        winner: playerName,
        secretObject: room.secretObject.name,
      });

      io.to(roomCode).emit("scores_updated", {
        players: room.players,
      });
    } else {
      socket.emit("guess_result", {
        correct: false,
        message: "Nope! Keep guessing 🔎",
      });
    }
  });

  // Forfeit handling
  socket.on("forfeit", ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (!room.forfeited) {
      room.forfeited = new Set();
    }

    // Mark this player as forfeited
    room.forfeited.add(socket.id);

    // Notify that this player forfeited
    io.to(roomCode).emit("player_forfeited", {
      playerName,
    });

    // If ALL current players have forfeited and game is still going
    if (room.isStarted && room.forfeited.size === room.players.length) {
      room.isStarted = false;
      room.winner = null;

      const secretName = room.secretObject ? room.secretObject.name : null;

      io.to(roomCode).emit("game_over", {
        winner: null,
        secretObject: secretName,
      });

      console.log(
        `🏳️ All players forfeited in room ${roomCode}. Object was: ${secretName}`
      );
    }
  });

  // New Game
  socket.on("new_game", ({ roomCode }) => {
    startGame(roomCode);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("🔴 Player disconnected:", socket.id);

    for (const [roomCode, room] of Object.entries(rooms)) {
      const before = room.players.length;

      room.players = room.players.filter((p) => p.id !== socket.id);

      if (room.players.length !== before) {
        io.to(roomCode).emit("player_left", { players: room.players });

        if (room.players.length === 0) {
          delete rooms[roomCode];
        }
      }
    }
  });
});

// ---------------- GAME START LOGIC ---------------
function startGame(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  if (!Array.isArray(room.usedItems)) room.usedItems = [];

  // reset per-game state
  room.askedQuestions = [];
  room.forfeited = new Set();
  room.winner = null;

  // pick object that hasn't been used yet
  const available = OBJECTS.filter(
    (obj) => !room.usedItems.includes(obj.name)
  );

  let chosen;
  if (available.length === 0) {
    // all objects used, reset
    room.usedItems = [];
    chosen = OBJECTS[Math.floor(Math.random() * OBJECTS.length)];
  } else {
    chosen = available[Math.floor(Math.random() * available.length)];
  }

  room.secretObject = chosen;
  room.usedItems.push(chosen.name);
  room.isStarted = true;

  io.to(roomCode).emit("game_started", {
    message:
      "New game started! Ask yes/no questions or try to guess the object.",
  });

  // send latest scores
  io.to(roomCode).emit("scores_updated", {
    players: room.players,
  });

  console.log(`🎁 Room ${roomCode} → Secret object: ${chosen.name}`);
}

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
