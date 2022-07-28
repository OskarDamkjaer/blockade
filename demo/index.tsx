import { parse } from "papaparse";
import React, { useEffect, useReducer, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { rate, Rating } from "ts-trueskill";
import { basicBot, killerBot, playerStarter, randomBot } from "./builtinBots";
import { CodeEditor } from "./code-editor";
import { access, Color, currentPlayer, posContainsPawn } from "./game";
import { createGameState, doTurn, nextTurnOptions } from "./gameAPI";
import { loadCode, playerConstants, requestTurn } from "./helpers";
import "./input.css";
// @ts-ignore
import mal from "./plan.jpg";
import { SpotView } from "./spot";

export type SpreadsheetEntry = {
  "Author name": string;
  "Bot Image link": string | null;
  "Bot name": string;
  Code: string;
  Vetted: boolean | null;
  elo: number | null;
};

export const nameRow = (e: SpreadsheetEntry) =>
  `${e["Author name"]}s - ${e["Bot name"]}`;

let lastStartTime = 0;
let activeGameNbr = 0;

function App() {
  const [bots, setBots] = useState<Record<string, SpreadsheetEntry>>({});
  const [debuggerEnabled, toggle] = useReducer((a) => !a, true);
  const isElo = !!new URL(window.location.href).searchParams.get("elo");
  const ref = useRef<HTMLInputElement>();
  const [state, setState] = useState(createGameState());

  useEffect(() => {
    fetch(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSqUDr_aXWAzwkjCB1N2lH5xanLTGpAhSMt3fYHdkLUP2On1Tkrkb8HFCSqrGCjXZYocNne_qOZwdbU/pub?gid=359820102&single=true&output=csv"
    )
      .then((res) => res.text())
      .then((data) => {
        const parsed = parse(data, { header: true, dynamicTyping: true })
          .data as SpreadsheetEntry[];

        setBots(
          parsed
            // only vet later
            // .filter(b => b.Vetted)
            .reduce((acc, curr) => {
              // Deduplicates by name & author
              return { ...acc, [nameRow(curr)]: curr };
            }, {})
        );
      });
  }, []);

  if (!isElo) {
    // this is re-set on every render, yikes
    window.onmessage = async ({ data }) => {
      //console.log("winmess", data);
      const { gameNbr, move } = JSON.parse(data);

      if (parseInt(ref.current.value) !== 3000 || isElo) {
        await new Promise((res) =>
          setTimeout(res, 3000 - parseInt(ref.current.value))
        );
        // slider to zero is pause
        const pause = async () => {
          if (parseInt(ref.current.value) === 0) {
            await new Promise((res) => setTimeout(res, 1000));
            await pause();
          }
        };
        await pause();
      }

      if (gameNbr !== activeGameNbr) {
        return;
      }
      const newState = doTurn(state, move);
      setState(newState);

      if (newState.winner) {
        console.log(newState.winner + " won");
      } else {
        const nextTurn = nextTurnOptions(newState);
        requestTurn(currentPlayer(newState), nextTurn, gameNbr);
      }
    };
  }

  const startGame = () => {
    const currTime = new Date().valueOf();
    if (currTime - lastStartTime < 500) {
      return;
    } else {
      lastStartTime = currTime;
    }

    activeGameNbr += 1;
    const restartedState = createGameState();
    setState(restartedState);
    requestTurn(
      currentPlayer(restartedState),
      nextTurnOptions(restartedState),
      activeGameNbr
    );
  };

  const colors: Color[] = ["BLUE", "RED", "GREEN", "YELLOW"];
  const startForBots = async (allBots: { name: string; code: string }[]) => {
    const simulate = (bots: { name: string; code: string }[]) => {
      colors.forEach((c, i) => {
        loadCode(c, bots[i].code);
      });
      return new Promise<string[]>((res) => {
        let gameState = createGameState();
        window.onmessage = async ({ data }) => {
          const { move } = JSON.parse(data);

          gameState = doTurn(gameState, move);

          if (gameState.winner) {
            const order = Object.values(gameState.pawns)
              .map((pList) => {
                pList.sort(
                  (p1, p2) =>
                    access(gameState.field, p1.position).goalDistance -
                    access(gameState.field, p2.position).goalDistance
                );
                return pList[0];
              })
              .sort(
                (p1, p2) =>
                  access(gameState.field, p1.position).goalDistance -
                  access(gameState.field, p2.position).goalDistance
              )
              .map((c) => bots[colors.indexOf(c.color)].name);
            res(order);
          } else {
            const nextTurn = nextTurnOptions(gameState);
            requestTurn(currentPlayer(gameState), nextTurn, 0);
          }
        };
        requestTurn(
          currentPlayer(gameState),
          nextTurnOptions(gameState),
          activeGameNbr
        );
      });
    };

    const scoreboard = allBots.reduce((acc, bot) => {
      acc[bot.name] = {
        name: bot.name,
        code: bot.code,
        rating: new Rating(),
        played: 0,
        wins: 0,
      };
      return acc;
    }, {} as Record<string, { rating: Rating; played: number; name: string; code: string; wins: number }>);

    async function rankedGame(chosen: { name: string; code: string }[]) {
      const order = await simulate(chosen);
      scoreboard[order[0]].wins++;

      const ratings = rate(order.map((b) => [scoreboard[b].rating]));
      ratings.forEach(([r], i) => {
        scoreboard[order[i]].rating = r;
        scoreboard[order[i]].played += 1;
      });
    }

    const COUNT = 20;
    while (Object.values(scoreboard).some((v) => v.played < COUNT)) {
      const low = Object.values(scoreboard)
        .filter((s) => s.played < COUNT)
        .sort(() => 0.5 - Math.random());

      const med = Object.values(scoreboard)
        .filter((s) => s.played === COUNT)
        .sort(() => 0.5 - Math.random());

      const high = Object.values(scoreboard)
        .filter((s) => s.played > COUNT)
        .sort(() => 0.5 - Math.random());

      const play = [...low, ...med, ...high].slice(0, 4);
      console.log(play.map((p) => p.name).join(" - "));
      await rankedGame(play);
    }

    console.log(
      Object.entries(scoreboard)
        .sort(([k1, v1], [k2, v2]) => v2.rating.mu - v1.rating.mu)
        .map(
          ([n, e]) =>
            "bot: " +
            n +
            ", elo: " +
            Math.floor(e.rating.mu * 50) +
            " ,played: " +
            e.played +
            " ,wins: " +
            e.wins
        )
        .join("\n")
    );
  };

  const nextTurn = nextTurnOptions(state);

  return isElo ? (
    <div>
      <button
        onClick={() => {
          startForBots(
            Object.entries(bots)
              .map(([k, v]) => ({ name: k, code: v.Code }))
              .concat([basicBot, randomBot])
          );
        }}
      >
        start
      </button>
      <div>
        {Object.keys(bots).map((b) => (
          <div>{b}</div>
        ))}
      </div>
      {colors.map((c) => (
        <iframe
          key={c}
          title="codeframe"
          id={playerConstants[c].iframeId}
          src="about:blank"
          sandbox="allow-same-origin allow-scripts"
          style={{ display: "none" }}
        />
      ))}
    </div>
  ) : (
    <main className="flex gap-1">
      <div className="min-w-[680px]">
        <img src={mal} />
        {state.field
          .slice()
          .reverse()
          .map((row) => (
            <div className="absolute top-0" key={row[0].position.y}>
              {row.map((spot) => (
                <span
                  className="absolute"
                  key={
                    spot.position.x.toString() +
                    ":" +
                    spot.position.y.toString()
                  }
                  style={{
                    left: `${spot.position.x * 38 + 21}px`,
                    top: `${515 - spot.position.y * 38}px`,
                  }}
                >
                  <SpotView
                    spot={spot}
                    pawn={posContainsPawn(state, spot.position)}
                    possibleMoveColor={
                      debuggerEnabled &&
                      nextTurn.moves.find(
                        (m) =>
                          m.newSpot.position.x === spot.position.x &&
                          m.newSpot.position.y === spot.position.y
                      )
                        ? nextTurn.myPawns[0].color
                        : undefined
                    }
                  />
                </span>
              ))}
            </div>
          ))}
        <div className="max-w-[680px] w-[680px] p-2">
          <h1 className="text-xl font-bold"> Rules! </h1>
          <p className="mb-2">
            Malefiz is a race to the goal spot on the top. On each players turn
            they roll a 6 sided die and move any of their 5 five pawns as many
            spaces as show on the die.
          </p>
          <p className="mb-2">
            If you land on another players pawn, it's captured and sent back to
            it's starting postion.{" "}
          </p>
          <p>
            You are allowed to pass pawns, but not the "Barricades" (white spots
            on the map). If you do capture a barricade, you have to move it to
            an unoccupied spot on the map (it can't be put on the bottom row).
          </p>
          <p className="mb-2"></p>
        </div>
      </div>
      <span className="grow">
        <span className="flex gap-1 mt-1">
          <button
            className="bg-lime-600 hover:bg-lime-800 text-white px-1 rounded"
            onClick={startGame}
          >
            {state.winner && "re"}start game
          </button>

          <span className=""> turn: {state.turn}</span>
          {state.winner && (
            <span>
              -
              {state.winner === "BLUE"
                ? " You (blue) win!"
                : ` You lost, ${state.winner} won.`}
            </span>
          )}
        </span>
        <CodeEditor
          player="BLUE"
          defaultExpand
          startingBot={playerStarter}
          userBots={bots}
          main
        />{" "}
        <div>
          speed meter
          <input
            type="range"
            ref={ref}
            max="3000"
            min="0"
            className="m-1"
            defaultValue="2500"
          />
          <label>
            move debugger enabled:
            <input
              type="checkbox"
              className="m-1"
              checked={debuggerEnabled}
              onChange={toggle}
            />
          </label>
        </div>
        <h2 className="text-lg font-bold mt-1"> Enemy Bots </h2>
        <CodeEditor userBots={bots} player="RED" startingBot={basicBot} />
        <CodeEditor userBots={bots} player="YELLOW" startingBot={killerBot} />
        <CodeEditor userBots={bots} player="GREEN" startingBot={randomBot} />
        <h2 className="text-lg font-bold mt-1">
          disclaimer: check source before running player bots (sandbox isn't
          perfect).
        </h2>
        Basic, Killer, FirstIsBest and Random bot are built in
        <a
          target="_blank"
          href="https://github.com/OskarDamkjaer/blockade"
          className="underline text-blue-400 hover:text-blue-600 cursor-pointer my-2 block"
        >
          Github repo Link
        </a>
      </span>
    </main>
  );
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
