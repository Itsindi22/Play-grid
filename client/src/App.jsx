import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:4000");

const QUESTIONS = [
  { key: "alive", label: "Is it alive?" },
  { key: "animal", label: "Is it an animal?" },
  { key: "food", label: "Is it food?" },
  { key: "electronic", label: "Is it electronic?" },
  { key: "vehicle", label: "Is it a vehicle?" },
  { key: "portable", label: "Can you carry it easily?" },
  { key: "bigger_than_hand", label: "Bigger than your hand?" },
  { key: "indoor", label: "Usually found indoors?" },
  { key: "outdoor", label: "Usually found outdoors?" },
];

function App() {
  // which screen are we on? "menu" | "game" | "scores" | "how"
  const [screen, setScreen] = useState("menu");

  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Connecting...");
  const [wins, setWins] = useState(0);

  const [gameStarted, setGameStarted] = useState(false);
  const [gameOverInfo, setGameOverInfo] = useState(null);

  const [questionLog, setQuestionLog] = useState([]);
  const [usedQuestionLabels, setUsedQuestionLabels] = useState([]);

  const [guess, setGuess] = useState("");
  const [guessFeedback, setGuessFeedback] = useState("");

  const [customQuestionText, setCustomQuestionText] = useState("");
  const [customQuestionKey, setCustomQuestionKey] = useState("alive");

  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  useEffect(() => {
    socket.on("connect", () => {
      setConnected(true);
      setStatus("Connected ✅");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setStatus("Disconnected ❌");
    });

    socket.on("error_message", (msg) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 2500);
    });

    socket.on("game_started", ({ message, wins }) => {
      setGameStarted(true);
      setGameOverInfo(null);
      setGuessFeedback(message);
      setQuestionLog([]);
      setUsedQuestionLabels([]);
      setInfoMsg("");
      if (typeof wins === "number") setWins(wins);
    });

    socket.on("question_answered", ({ questionLabel, answer }) => {
      setQuestionLog((prev) => [...prev, { questionLabel, answer }]);
      setUsedQuestionLabels((prev) => [
        ...prev,
        questionLabel.toLowerCase(),
      ]);
    });

    socket.on("guess_result", ({ message }) => {
      setGuessFeedback(message);
    });

    socket.on("game_over", ({ result, wins, secretObject }) => {
      setGameStarted(false);
      setGameOverInfo({ result, secretObject });
      setGuessFeedback("");
      if (typeof wins === "number") setWins(wins);
    });

    return () => {
      socket.off();
    };
  }, []);

  // ---------- MENU ACTIONS ----------

  const goToPlay = () => {
    if (!connected) {
      setErrorMsg("Not connected yet, try again in a second.");
      return;
    }
    setScreen("game");
    socket.emit("start_game");
  };

  const goToScores = () => {
    setScreen("scores");
  };

  const goToHow = () => {
    setScreen("how");
  };

  const backToMenu = () => {
    setScreen("menu");
  };

  // ---------- GAME ACTIONS ----------

  const handleNewGame = () => {
    if (!connected) return;
    setScreen("game");
    socket.emit("new_game");
  };

  const handleAskQuickQuestion = (key, label) => {
    if (!gameStarted) return;
    if (usedQuestionLabels.includes(label.toLowerCase())) {
      setErrorMsg("You already asked that question.");
      setTimeout(() => setErrorMsg(""), 2000);
      return;
    }

    socket.emit("ask_question", {
      questionKey: key,
      questionText: null,
    });
  };

  const handleAskCustomQuestion = () => {
    if (!gameStarted) return;
    const text = customQuestionText.trim();
    if (!text) return;

    if (usedQuestionLabels.includes(text.toLowerCase())) {
      setErrorMsg("You already asked that question.");
      setTimeout(() => setErrorMsg(""), 2000);
      return;
    }

    socket.emit("ask_question", {
      questionKey: customQuestionKey,
      questionText: text,
    });

    setCustomQuestionText("");
  };

  const handleGuess = () => {
    if (!gameStarted) return;
    const text = guess.trim();
    if (!text) return;

    socket.emit("make_guess", { guess: text });
    setGuess("");
  };

  const handleForfeit = () => {
    if (!gameStarted) return;
    socket.emit("forfeit");
    setInfoMsg("You forfeited this round.");
  };

  // ---------- UI WRAPPER ----------

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #1e293b, #020617 55%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        color: "white",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {screen === "menu" && (
        <MenuScreen
          status={status}
          connected={connected}
          wins={wins}
          onPlay={goToPlay}
          onScores={goToScores}
          onHow={goToHow}
        />
      )}

      {screen === "scores" && (
        <ScoresScreen wins={wins} onBack={backToMenu} status={status} />
      )}

      {screen === "how" && <HowToPlayScreen onBack={backToMenu} />}

      {screen === "game" && (
        <GameScreen
          status={status}
          connected={connected}
          wins={wins}
          gameStarted={gameStarted}
          gameOverInfo={gameOverInfo}
          questionLog={questionLog}
          usedQuestionLabels={usedQuestionLabels}
          guess={guess}
          setGuess={setGuess}
          guessFeedback={guessFeedback}
          customQuestionText={customQuestionText}
          setCustomQuestionText={setCustomQuestionText}
          customQuestionKey={customQuestionKey}
          setCustomQuestionKey={setCustomQuestionKey}
          errorMsg={errorMsg}
          infoMsg={infoMsg}
          onNewGame={handleNewGame}
          onAskQuickQuestion={handleAskQuickQuestion}
          onAskCustomQuestion={handleAskCustomQuestion}
          onGuess={handleGuess}
          onForfeit={handleForfeit}
          onBack={backToMenu}
        />
      )}
    </div>
  );
}

/* ------------ SCREEN COMPONENTS -------------- */

function MenuScreen({ status, connected, wins, onPlay, onScores, onHow }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "600px",
        background: "rgba(15,23,42,0.95)",
        borderRadius: "1.25rem",
        border: "1px solid #1e293b",
        boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        padding: "1.8rem 1.5rem 2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>
        🎁 What&apos;s In The Box?
      </h1>
      <p style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: "1rem" }}>
        A 20-questions style guessing game.  
        Try to figure out what&apos;s hidden inside the box.
      </p>

      <p
        style={{
          fontSize: "0.8rem",
          color: connected ? "#22c55e" : "#f97316",
          marginBottom: "0.6rem",
        }}
      >
        {status}
      </p>
      <p style={{ fontSize: "0.8rem", color: "#e5e7eb", marginBottom: "1.2rem" }}>
        Total wins: <b>{wins}</b>
      </p>

      {/* Three big boxes like your sketch */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem",
          alignItems: "center",
        }}
      >
        <MenuButton onClick={onPlay}>Play</MenuButton>
        <MenuButton onClick={onScores}>Score</MenuButton>
        <MenuButton onClick={onHow}>How to Play</MenuButton>
      </div>
    </div>
  );
}

function MenuButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "70%",
        padding: "0.75rem 1rem",
        borderRadius: "0.75rem",
        border: "2px solid #e5e7eb",
        background: "#020617",
        color: "white",
        fontSize: "1rem",
        letterSpacing: "0.03em",
        cursor: "pointer",
        transition: "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}

function ScoresScreen({ wins, onBack, status }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "600px",
        background: "rgba(15,23,42,0.95)",
        borderRadius: "1.25rem",
        border: "1px solid #1e293b",
        boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        padding: "1.5rem",
      }}
    >
      <button
        onClick={onBack}
        style={{
          border: "none",
          background: "transparent",
          color: "#9ca3af",
          fontSize: "0.8rem",
          marginBottom: "0.75rem",
          cursor: "pointer",
        }}
      >
        ← Back to menu
      </button>

      <h2 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>Your Score</h2>
      <p style={{ fontSize: "0.9rem", color: "#e5e7eb" }}>
        Total rounds won: <b>{wins}</b>
      </p>
      <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.5rem" }}>
        Connection: {status}
      </p>
    </div>
  );
}

function HowToPlayScreen({ onBack }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "650px",
        background: "rgba(15,23,42,0.95)",
        borderRadius: "1.25rem",
        border: "1px solid #1e293b",
        boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        padding: "1.5rem",
      }}
    >
      <button
        onClick={onBack}
        style={{
          border: "none",
          background: "transparent",
          color: "#9ca3af",
          fontSize: "0.8rem",
          marginBottom: "0.75rem",
          cursor: "pointer",
        }}
      >
        ← Back to menu
      </button>

      <h2 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>
        How to Play
      </h2>
      <ol
        style={{
          fontSize: "0.9rem",
          color: "#e5e7eb",
          paddingLeft: "1.1rem",
          lineHeight: 1.6,
        }}
      >
        <li>Click <b>Play</b> on the main menu to start a round.</li>
        <li>
          The computer secretly picks an object (like <i>apple</i>,{" "}
          <i>phone</i>, <i>cat</i>, etc.).
        </li>
        <li>
          Use the yes/no question buttons (or type your own question) to get
          clues. You can&apos;t ask the same question twice in one game.
        </li>
        <li>
          When you think you know what&apos;s in the box, type your guess and
          hit <b>Guess</b>.
        </li>
        <li>
          If you&apos;re correct, you win the round and your <b>Score</b> goes
          up by 1.
        </li>
        <li>
          If you give up, click <b>Forfeit</b> to reveal what was in the box.
        </li>
        <li>
          Click <b>Start New Game</b> to play again with a new hidden object.
        </li>
      </ol>
    </div>
  );
}

function GameScreen(props) {
  const {
    status,
    connected,
    wins,
    gameStarted,
    gameOverInfo,
    questionLog,
    usedQuestionLabels,
    guess,
    setGuess,
    guessFeedback,
    customQuestionText,
    setCustomQuestionText,
    customQuestionKey,
    setCustomQuestionKey,
    errorMsg,
    infoMsg,
    onNewGame,
    onAskQuickQuestion,
    onAskCustomQuestion,
    onGuess,
    onForfeit,
    onBack,
  } = props;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "900px",
        background: "rgba(15,23,42,0.95)",
        borderRadius: "1.25rem",
        border: "1px solid #1e293b",
        boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        padding: "1.5rem",
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        gap: "1.25rem",
      }}
    >
      {/* LEFT PANEL */}
      <div>
        <button
          onClick={onBack}
          style={{
            border: "none",
            background: "transparent",
            color: "#9ca3af",
            fontSize: "0.8rem",
            marginBottom: "0.4rem",
            cursor: "pointer",
          }}
        >
          ← Back to menu
        </button>

        <h1 style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>
          🎁 What&apos;s In The Box?
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
          Single-player. Ask yes/no questions and guess the hidden object.
        </p>

        <div
          style={{
            marginTop: "0.5rem",
            fontSize: "0.8rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: connected ? "#22c55e" : "#f97316" }}>
            {status}
          </span>
          <span style={{ color: "#e5e7eb" }}>Wins: {wins}</span>
        </div>

        {errorMsg && (
          <p
            style={{
              marginTop: "0.5rem",
              background: "#7f1d1d",
              padding: "0.45rem 0.6rem",
              borderRadius: "0.5rem",
              fontSize: "0.8rem",
            }}
          >
            ⚠️ {errorMsg}
          </p>
        )}

        {infoMsg && (
          <p
            style={{
              marginTop: "0.5rem",
              background: "#111827",
              padding: "0.45rem 0.6rem",
              borderRadius: "0.5rem",
              fontSize: "0.8rem",
            }}
          >
            ℹ️ {infoMsg}
          </p>
        )}

        {/* Game over panel */}
        {gameOverInfo && (
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem",
              borderRadius: "0.75rem",
              background:
                gameOverInfo.result === "win" ? "#14532d" : "#4b5563",
              border:
                gameOverInfo.result === "win"
                  ? "1px solid #16a34a"
                  : "1px solid #6b7280",
              fontSize: "0.9rem",
            }}
          >
            {gameOverInfo.result === "win" ? (
              <>
                🎉 You guessed it!
                <br />
                The object in the box was:{" "}
                <b>{gameOverInfo.secretObject}</b>
              </>
            ) : (
              <>
                🏳️ You forfeited this round.
                <br />
                The object in the box was:{" "}
                <b>{gameOverInfo.secretObject}</b>
              </>
            )}
            <br />
            <button
              onClick={onNewGame}
              style={{
                marginTop: "0.6rem",
                padding: "0.45rem 0.9rem",
                borderRadius: "999px",
                border: "none",
                background: "#22c55e",
                color: "black",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              🔁 Start New Game
            </button>
          </div>
        )}

        {/* Guess + Forfeit */}
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid #1f2933",
          }}
        >
          <p style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>
            Think you know what&apos;s in the box? Type your guess:
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="e.g. apple, phone, laptop..."
              style={inputStyle}
            />
            <button
              onClick={onGuess}
              disabled={!gameStarted}
              style={{
                ...primaryButton,
                opacity: gameStarted ? 1 : 0.6,
                cursor: gameStarted ? "pointer" : "not-allowed",
              }}
            >
              Guess
            </button>
          </div>
          <div
            style={{
              marginTop: "0.4rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "#e5e7eb" }}>
              {guessFeedback}
            </span>
            <button
              onClick={onForfeit}
              disabled={!gameStarted}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "999px",
                border: "none",
                background: gameStarted ? "#f97316" : "#4b5563",
                color: "black",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: gameStarted ? "pointer" : "not-allowed",
              }}
            >
              🏳️ Forfeit
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div
        style={{
          borderLeft: "1px solid #1e293b",
          paddingLeft: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>
            🔍 Ask Questions
          </h2>
          <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
            Use these yes/no questions to narrow it down.  
            You can&apos;t ask the same question twice in one game.
          </p>
        </div>

        {/* Quick questions */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
            marginBottom: "0.4rem",
          }}
        >
          {QUESTIONS.map((q) => {
            const used = usedQuestionLabels.includes(q.label.toLowerCase());
            return (
              <button
                key={q.key}
                onClick={() => onAskQuickQuestion(q.key, q.label)}
                disabled={!gameStarted || used}
                style={{
                  padding: "0.35rem 0.6rem",
                  borderRadius: "999px",
                  border: "1px solid #1f2937",
                  background: used ? "#111827" : "#020617",
                  color: used ? "#6b7280" : "#e5e7eb",
                  fontSize: "0.75rem",
                  cursor:
                    gameStarted && !used ? "pointer" : "not-allowed",
                  opacity: gameStarted ? 1 : 0.5,
                }}
              >
                {q.label}
              </button>
            );
          })}
        </div>

        {/* Custom question */}
        <div
          style={{
            background: "#020617",
            borderRadius: "0.75rem",
            border: "1px solid #1e293b",
            padding: "0.6rem",
          }}
        >
          <p
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
              marginBottom: "0.35rem",
            }}
          >
            Or type your own question:
          </p>
          <select
            value={customQuestionKey}
            onChange={(e) => setCustomQuestionKey(e.target.value)}
            style={{
              ...inputStyle,
              marginBottom: "0.35rem",
              fontSize: "0.8rem",
            }}
          >
            {QUESTIONS.map((q) => (
              <option key={q.key} value={q.key}>
                {q.label}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <input
              value={customQuestionText}
              onChange={(e) => setCustomQuestionText(e.target.value)}
              placeholder="Write your question..."
              style={inputStyle}
            />
            <button
              onClick={onAskCustomQuestion}
              disabled={!gameStarted}
              style={{
                ...primaryButton,
                background: "#6366f1",
                opacity: gameStarted ? 1 : 0.6,
                cursor: gameStarted ? "pointer" : "not-allowed",
              }}
            >
              Ask
            </button>
          </div>
        </div>

        {/* Question log */}
        <div
          style={{
            flex: 1,
            background: "#020617",
            borderRadius: "0.75rem",
            border: "1px solid #1e293b",
            padding: "0.6rem",
            overflowY: "auto",
            maxHeight: "260px",
          }}
        >
          <p
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
              marginBottom: "0.35rem",
            }}
          >
            Question Log:
          </p>
          {questionLog.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              No questions yet. Try &quot;Is it alive?&quot;
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontSize: "0.8rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
              }}
            >
              {questionLog.map((q, i) => (
                <li
                  key={i}
                  style={{
                    padding: "0.35rem 0.4rem",
                    borderRadius: "0.5rem",
                    background: "#020617",
                    border: "1px solid #111827",
                  }}
                >
                  <span>{q.questionLabel}</span>
                  <br />
                  <span style={{ color: "#22c55e" }}>
                    ➜ {q.answer.toUpperCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------ shared styles -------------- */

const inputStyle = {
  flex: 1,
  padding: "0.4rem 0.55rem",
  borderRadius: "0.5rem",
  background: "#020617",
  border: "1px solid #334155",
  color: "white",
  fontSize: "0.85rem",
};

const primaryButton = {
  padding: "0.45rem 0.9rem",
  borderRadius: "999px",
  border: "none",
  background: "#22c55e",
  color: "black",
  fontWeight: 600,
  fontSize: "0.85rem",
};

export default App;
