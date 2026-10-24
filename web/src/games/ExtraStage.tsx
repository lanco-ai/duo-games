import { lazy, Suspense } from "preact/compat";
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
};
export default function ExtraStage(p: GameProps) {
  const Component = components[p.view.kind];
  return (
    <Suspense fallback={<p class="stage-loading">两个人的游戏，马上就好…</p>}>
      <Component key={p.view.run} {...p} />
    </Suspense>
  );
}
