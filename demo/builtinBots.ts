const types = `
type Color = "BLUE" | "RED" | "YELLOW" | "GREEN";
type Position = { x: number; y: number }; 

type Pawn = {
  color: Color;
  number: number;
  position: Position | null;
  spot: Spot
};

type Spot = {
  contains: "OUTSIDE" | "NORMAL" | "BARRICADE" | "GOAL";
  startingPointColor?: Color;
  connectedTo: Position[];
  unBarricadeable: boolean;
  goalDistance: number;
  position: Position;
};

type Turn = {
  pawn: Pawn;
  newSpot: Spot;
  oldSpot: Spot;
  newBarricadePosition?: Position;
 };

type GameState = {
  myPawns: Pawn[]; // pawns currently on board
  otherPawns: Pawn[];
  allSpots: Spot[];
  canHavebarricade: Spot[];
  hasBarricade: Spot[];
  moves: Turn[];
  startingPositions: Record<Color, Spot>; // where your pawn will land if you move 1 from base
}
`;
export const firstIsBestBot = {
  name: "FirstIsBestBot",
  author: "built-in",
  code: `function doTurn(data: GameState): Turn {
  return data.moves[0];
}
${types}`,
};

export const randomBot = {
  name: "RandomBot",
  author: "built-in",
  code: `function doTurn(data: GameState): Turn {
  const randomMove = data.moves[Math.floor(Math.random() * data.moves.length)]
  return randomMove;
}
${types}`,
};

export const playerStarter = {
  name: "YourBotNameHere",
  author: "you",
  code: `/* 
Below you'll find a typescript function "doTurn" selecting a random move.  
It's up to you to improve it. ctrl + space for autocomplete.

If your code does not return within ~200ms or selects an 
illegal move one will be chosen at random. 
*/

function doTurn({
  myPawns,
  otherPawns,
  allSpots,
  canHavebarricade,
  hasBarricade,
  moves,
  startingPositions,
}: GameState): Turn {
  console.log(moves[0]); // visible in browser console

  const randomMove = moves[Math.floor(Math.random() * moves.length)];
  return randomMove;

  // tips & util fns:
  // hover over a spot on the board/image to see it's position
  // (cmd/ctrl)+s to format your code
  const pos2spot = ({ x, y }: Position): Spot => allSpots[y * 17 + x];
  const comparePositions = (p1: Position | null, p2: Position | null) =>
    p1?.x === p2?.x && p1?.y === p2?.y;
}
${types}
`,
};

export const killerBot = {
  name: "KillerBot",
  author: "built-in",
  code: `function doTurn(data: GameState): Turn {
  const { moves, otherPawns } = data;

  const takenPositions = new Set(
    otherPawns
      .filter(p => p.position)
      .map(p => p.position!.x + ":" + p.position!.y)
  );

  const killMove = moves.find(m =>
    takenPositions.has(m.newSpot.position!.x + ":" + m.newSpot.position!.y)
  );

  if (killMove) {
    return killMove;
  }

  const randomMove = moves[Math.floor(Math.random() * moves.length)];
  return randomMove;
}
${types}
`,
};

export const basicBot = {
  name: "BasicBot",
  author: "built-in",
  code: `
function doTurn({moves}: GameState): Turn {
  const winningMove = moves.find(move => move.newSpot.contains === "GOAL")
  if(winningMove) {
    return winningMove
  }

  const movesThatGoForward = moves
    .filter(turn => turn.oldSpot.goalDistance > turn.newSpot.goalDistance)
    .sort((t1, t2) => t1.newSpot.goalDistance - t2.newSpot.goalDistance)
    
  return movesThatGoForward[0];
}
${types}
`,
};
export const pickableBots = [randomBot, killerBot, basicBot, firstIsBestBot];
