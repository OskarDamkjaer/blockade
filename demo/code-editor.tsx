import prettierTs from "prettier/parser-typescript";
import prettier from "prettier/standalone";
import React, { useEffect, useReducer, useState } from "react";
import { transpile } from "typescript";
import { SpreadsheetEntry } from ".";
import { Editor } from "../src/lib";
import { pickableBots, playerStarter, randomBot } from "./builtinBots";
import type { Color } from "./game";
import { loadPlayerCode, playerConstants } from "./helpers";
type Bot = { name: string; author: string; code: string };
type Props = {
  player: Color;
  startingBot?: Bot;
  defaultExpand?: boolean;
  main?: boolean;
  userBots: Record<string, SpreadsheetEntry>;
};

export const CodeEditor = ({
  player,
  defaultExpand = false,
  startingBot = randomBot,
  main = false,
  userBots,
}: Props) => {
  const format = () => {
    setCode((code) =>
      prettier.format(code, {
        parser: "typescript",
        plugins: [prettierTs],
      })
    );
  };
  const [code, setCode] = useState(
    main ? playerStarter.code : startingBot.code
  );
  const [expanded, toggleExpanded] = useReducer((e) => !e, defaultExpand);
  const [openSubmit, toggleSubmit] = useReducer((e) => !e, false);
  const [selected, setSel] = useState(startingBot.name);

  const botNames = pickableBots
    .map((b) => b.name)
    .concat(Object.keys(userBots));

  const loadCode = () => {
    loadPlayerCode(
      player,
      `
function doTurn12345(data){
  ${transpile(code)}
  return doTurn(data);
}
window.onmessage = (({data}) => {
  function thread(fn, ...args) {
    if (!window.Worker)
      throw Promise.reject(new ReferenceError("WebWorkers aren't available."));

    const fnWorker =
      "self.onmessage = function(message) { self.postMessage( (" +
      fn.toString() +
      ").apply(null, message.data)); }";

    return new Promise((resolve, reject) => {
      try {
        const blob = new Blob([fnWorker], { type: "text/javascript" });
        const blobUrl = window.URL.createObjectURL(blob);
        const worker = new Worker(blobUrl);
        window.URL.revokeObjectURL(blobUrl);

        worker.onmessage = result => {
          resolve(result.data);
          worker.terminate();
        };

        worker.onerror = error => {
          reject(error);
          worker.terminate();
        };

        setTimeout(() => {
          reject("TIMEOUT")
          worker.terminate();
        }, 900)

        worker.postMessage(args);
      } catch (error) {
        reject(error);
      }
    });
  }

  const {gameNbr, turn} = JSON.parse(data)
  thread(doTurn12345, turn)
    .then(move => {
      window.top.postMessage(JSON.stringify({gameNbr, move}))
    })
    .catch((e) => {
      if(e === "TIMEOUT"){
         console.log("bot timed out")
      } else {
        console.log("bot crashed picking random move")
      }
      window.top.postMessage(JSON.stringify({gameNbr, move: null}))
    })
})`
    );
  };

  useEffect(loadCode, [code]);

  const handleSubmit: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const chosen = e.target.value;
    setSel(chosen);
    const isUserBot = chosen.includes("-");

    setCode(
      isUserBot
        ? userBots[chosen].Code
        : pickableBots.find((b) => b.name === chosen).code
    );
  };

  return (
    <div className="mb-2">
      {main && openSubmit && (
        <iframe
          src={`https://docs.google.com/forms/d/e/1FAIpQLSd-vaTSkYAZxw9vsDLcrDZzzy6Ji7Ys9BTsVCz9vHE2QBorJw/viewform?usp=pp_url&entry.1402855361=${encodeURIComponent(
            selected
          )}&entry.665471973=${encodeURIComponent(code)}&embedded=true`}
          width="640"
          height="366"
          frameBorder="0"
        >
          Loading…
        </iframe>
      )}
      <iframe
        title="codeframe"
        id={playerConstants[player].iframeId}
        src="about:blank"
        sandbox="allow-same-origin allow-scripts"
        style={{ display: "none" }}
      />
      <span className="flex mb-1 gap-1">
        <div>
          {player[0] + player.slice(1).toLowerCase()} {main && "(you)"}
        </div>
        {main ? (
          <input
            value={selected}
            onChange={(s) => setSel(s.target.value)}
            className="w-48 bg-gray-200"
          />
        ) : (
          <select value={selected} onChange={handleSubmit}>
            {botNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        {main && (
          <button
            onClick={toggleSubmit}
            className="bg-blue-500 hover:bg-blue-800 text-white px-1 rounded"
          >
            {openSubmit ? "hide form" : "upload bot"}
          </button>
        )}
        <button onClick={format}>format</button>
        <button onClick={toggleExpanded}>
          {expanded ? "hide code " : "show code "}
        </button>
      </span>
      {expanded && (
        <div className="min-h-[600px] h-[600px]">
          <span id={playerConstants[player].editorId} />
          <Editor lang="ts" value={code} onChange={setCode} format={format} />
        </div>
      )}
    </div>
  );
};
