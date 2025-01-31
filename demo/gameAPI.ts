import {
  access,
  Color,
  flatten,
  GameState,
  getNextTurnOptions,
  legalBarricadeSpots,
  pawnsNotFromPlayer,
  Position,
  PossibleTurn,
  Spot,
  spotsWithBarricade,
} from "./game";
export { createGameState, doTurn } from "./game";

export function nextTurnOptions(state: GameState): PossibleTurn {
  const { player, options } = getNextTurnOptions(state);

  const myPawns = state.pawns[player].map((p) => ({
    ...p,
    spot: access(state.field, p.position),
  }));
  const otherPawns = pawnsNotFromPlayer(state, player).map((p) => ({
    ...p,
    spot: access(state.field, p.position),
  }));

  const hasBarricade = spotsWithBarricade(state);
  const canHavebarricade = legalBarricadeSpots(state)
    .map((p) => access(state.field, p))
    .filter((s): s is Spot => s !== undefined);

  return {
    myPawns,
    otherPawns,
    hasBarricade,
    canHavebarricade,
    moves: options,
    startingPositions: state.field.reduce((acc, curr) => {
      curr.forEach((a) => {
        if (a.startingPointColor) {
          acc[a.startingPointColor] = a;
        }
      });
      return acc;
    }, {}) as Record<Color, Spot>,
    allSpots: state.field.reduce(flatten, []),
  };
}

export function spotAtPos(state: GameState, position: Position) {
  return access(state.field, position);
}
