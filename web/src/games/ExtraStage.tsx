import { lazy, Suspense } from "preact/compat";
import "./couple.css";
import type { GameProps } from "./common";
const components = {
  "draw-guess": lazy(() => import("./Draw")),
  "mind-meld": lazy(() => import("./Mind")),
  "know-me": lazy(() => import("./Know")),
  gomoku: lazy(() => import("./Gomoku")),
  "red-thread": lazy(() => import("./RedThread")),
  "my-eyes": lazy(() => import("./Eyes")),
  "heart-bounce": lazy(() => import("./Bounce")),
  "puzzle-us": lazy(() => import("./Puzzle")),
  heartbeat: lazy(() => import("./Heartbeat")),
  survival: lazy(() => import("./CoupleGames")),
  "spot-difference": lazy(() => import("./CoupleGames")),
  "coop-kitchen": lazy(() => import("./Kitchen")),
  "couple-ludo": lazy(() => import("./CoupleGames")),
  "hide-seek": lazy(() => import("./CoupleGames")),
  "couple-jump": lazy(() => import("./Jump")),
};
export default function ExtraStage(p: GameProps) {
  const Component = components[p.view.kind];
  const local = p.local;
  return (
    <Suspense fallback={<p class="stage-loading">两个人的游戏，马上就好…</p>}>
      {p.view.kind === "know-me" &&
      p.view.data.mode === "blind" &&
      local?.view ? (
        <div class="dual-blind">
          <Component key={p.view.run + "-0"} {...p} local={undefined} />
          <Component
            key={p.view.run + "-1"}
            {...p}
            seat={local.seat}
            view={local.view}
            send={local.send}
            transport={local.transport}
            token={local.token}
            local={undefined}
          />
        </div>
      ) : (
        <Component key={p.view.run} {...p} />
      )}
    </Suspense>
  );
}
