import React from "react";
import type { Color, Pawn, Spot } from "./game";

export let spot: Spot;
export let pawn: Pawn | null;

export const colors = {
  RED: "rgb(221,55,62)",
  GREEN: "rgb(77,168,90)",
  YELLOW: "rgb(248,213,73)",
  BLUE: "rgb(49,113,183)",
};

export const SpotView = ({
  spot,
  pawn,
  possibleMoveColor,
}: {
  spot: Spot;
  pawn: Pawn | null;
  possibleMoveColor?: Color;
}) => (
  <div
    style={{
      borderRadius: "9999px",
      height: "33px",
      width: "33px",
      textAlign: "center",
      lineHeight: "33px",
      backgroundColor: pawn
        ? colors[pawn.color]
        : spot.contains === "BARRICADE"
        ? "white"
        : spot.contains === "NORMAL"
        ? "BLACK"
        : "inherit",
      color: possibleMoveColor ? colors[possibleMoveColor] : "inherit",
    }}
    title={spot.position.x + ":" + spot.position.y}
  >
    {possibleMoveColor ? "X" : pawn && pawn.number}
  </div>
);
