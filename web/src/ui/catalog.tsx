import { useState } from "preact/hooks";
import {
  games,
  gameGroups,
  gameGroup,
  type GameMeta,
} from "../../../shared/catalog";
import { Modal } from "./common";
import { GameIcon } from "../art/ui";
export function Catalog({
  pick,
  pair,
  wanted,
}: {
  pick: (g: GameMeta) => void;
  pair?: number;
  wanted?: string;
}) {
  const [filter, setFilter] = useState("全部");
  return (
    <section class="catalog">
      <div class="section-heading">
        <h2 class="wood-sign">挑个游戏，一起玩</h2>
      </div>
      <div class="filters" aria-label="游戏分类">
        {["全部", ...gameGroups].map((f) => (
          <button
            aria-pressed={filter === f}
            class={f === filter ? "chip active" : "chip"}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {gameGroups
        .filter((group) => filter === "全部" || filter === group)
        .map((group) => (
          <section class="catalog-group" aria-label={group + "游戏"}>
            <h3 class="catalog-group-title">{group}</h3>
            <div class="game-grid">
              {games
                .filter((g) => gameGroup(g) === group)
                .map((g) => (
                  <button
                    class="game-card"
                    onClick={() => pick(g)}
                    aria-label={"了解" + g.name}
                  >
                    <GameIcon id={g.id} />
                    {wanted === g.id && <span class="want-badge">TA 想玩</span>}
                    <span class="game-name">{g.name}</span>
                    <span class="game-tagline">{g.tagline}</span>
                    <span class="device-tag">
                      {g.devices === "both" ? "一台设备也能玩" : "两台设备"}
                    </span>
                    <span class="game-meta">
                      {g.tags.join(" · ")} · {g.duration}
                    </span>
                    <span
                      class={
                        "network-tag " +
                        (g.net === "需稳定网络"
                          ? pair !== undefined && pair <= 250
                            ? ""
                            : "amber"
                          : "")
                      }
                    >
                      <i />
                      {pair !== undefined
                        ? g.net === "需稳定网络" && pair > 250
                          ? "可能会卡"
                          : "网络 ✓"
                        : g.net}
                    </span>
                  </button>
                ))}
            </div>
          </section>
        ))}
    </section>
  );
}
export function GameInfo({
  game,
  close,
  start,
}: {
  game: GameMeta;
  close: () => void;
  start: () => void;
}) {
  return (
    <Modal title={game.name} close={close}>
      <div class="intro-art">
        <GameIcon id={game.id} />
        <div>
          <p class="intro-tagline">{game.tagline}</p>
          <p class="intro-meta">
            {game.tags.join(" · ")} · {game.duration}
          </p>
        </div>
      </div>
      <p class="intro-text">{game.intro}</p>
      <h3 class="rules-title">怎么玩</h3>
      <ol class="rules">
        {game.rules.map((rule) => (
          <li>{rule}</li>
        ))}
      </ol>
      <p class="muted center">
        {game.devices === "both" ? "一台设备也能玩" : "两台设备"} · 网络：
        {game.net}
      </p>
      <button class="go big wide" onClick={start}>
        一起玩这个 ❤
      </button>
    </Modal>
  );
}
