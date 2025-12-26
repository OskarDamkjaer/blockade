import { transpile } from "../src/editor/ts-editor";
import type { Color, PossibleTurn } from "./game";

export const playerConstants: Record<
  Color,
  { iframeId: string; editorId: string }
> = {
  RED: { iframeId: "red-iframe", editorId: "red-editor" },
  GREEN: { iframeId: "green-iframe", editorId: "green-editor" },
  YELLOW: { iframeId: "yellow-iframe", editorId: "yellow-editor" },
  BLUE: { iframeId: "blue-iframe", editorId: "blue-editor" },
};

function loadPlayerCode(player: Color, code: string) {
  const doc = document.getElementById(playerConstants[player].iframeId);
  if (doc instanceof HTMLIFrameElement) {
    const iframe = doc.contentDocument;
    if (iframe) {
      iframe.open();
      iframe.write(`<!DOCTYPE html><script>${code}</script>`);
      iframe.close();
    }
  } else {
    throw new Error(`No iframe found for ${player}`);
  }
}

export const loadCode = (
  player: Color,
  code: string,
  disableConsole = false
) => {
  loadPlayerCode(
    player,
    `
function doTurn12345(data){
${disableConsole ? "console.log = function() {};" : ""}
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

export function requestTurn(
  player: Color,
  turn: PossibleTurn,
  gameNbr: number
) {
  const doc = document.getElementById(playerConstants[player].iframeId);
  if (doc instanceof HTMLIFrameElement) {
    //console.log(JSON.stringify(turn));
    doc.contentWindow?.postMessage(JSON.stringify({ turn, gameNbr }), "*");
  } else {
    console.log("no iframe");
    throw new Error(`No iframe found for ${player}`);
  }
}
