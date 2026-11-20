// 半途岛：大厅里的入口卡片 + 全屏的岛。
// 状态全在服务器；这里只显示，并把点击变成一个个操作发过去。
import { useEffect, useState } from "preact/hooks";
import { api } from "../api";
import type { Transport } from "../net/transport";
import type { Profile, Seat } from "../../../shared/protocol";
import {
  BOAT_COST,
  CROPS,
  ITEM_NAMES,
  MAX_LEVEL,
  NOTE_MAX,
  RECIPES,
  SHORE_NAMES,
  upgradeNeeds,
  type Crop,
  type Island as IslandState,
  type IslandAction,
  type Item,
  type Plot,
} from "../../../shared/island/rules";
import { PieceIcon } from "../games/Tide";
import "./island.css";

const ICONS: Partial<Record<Item, string>> = {
  berry: "🫐",
  wheat: "🌾",
  kelp: "🌿",
  cotton: "☁️",
  stoneflower: "🪨",
  coralbud: "🪸",
  oil: "🫙",
  paper: "📜",
  rope: "🪢",
  cloth: "🧣",
  stone: "🧱",
  coral: "🐚",
};
const CARD_ICON: Record<string, "lamp" | "boat" | "net" | "stone" | "coral"> = {
  "card-lamp": "lamp",
  "card-boat": "boat",
  "card-net": "net",
  "card-stone": "stone",
  "card-coral": "coral",
};
function ItemIcon({ item }: { item: Item }) {
  if (CARD_ICON[item])
    return (
      <span class="isle-card-icon">
        <PieceIcon kind={CARD_ICON[item]} />
      </span>
    );
  return <span class="isle-emoji">{ICONS[item]}</span>;
}
const left = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} 时 ${m % 60} 分` : `${m} 分`;
};
type Bag = Partial<Record<Item, number>>;
const total = (bag: Bag) =>
  Object.values(bag).reduce((a, b) => a + (b ?? 0), 0);

export function IslandEntry(p: {
  code: string;
  token: string;
  seat: Seat;
  profiles: [Profile | null, Profile | null];
  transport?: Transport;
  now: number;
}) {
  const [s, setS] = useState<IslandState | null>(null),
    [open, setOpen] = useState(location.hash === "#island"),
    [sheet, setSheet] = useState<
      | null
      | { kind: "seed"; plot: number }
      | { kind: "bag" | "craft" | "boat" | "level" }
      | { kind: "letter"; note: string; items: Bag; from: string }
    >(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [cargo, setCargo] = useState<Bag>({}),
    [note, setNote] = useState("");
  const me = p.seat,
    other = (1 - me) as Seat,
    partner = p.profiles[other]?.nickname || "TA",
    now = p.now;

  const load = () =>
    api("rooms/" + p.code + "/island", "GET", undefined, p.token)
      .then((r) => setS(r.island))
      .catch(() => {});
  useEffect(() => {
    void load();
  }, [p.code, p.token]);
  useEffect(
    () =>
      p.transport?.subscribe((m) => {
        if (m.t === "extra" && m.event.kind === "island") void load();
      }),
    [p.transport],
  );
  useEffect(() => {
    const sync = () => setOpen(location.hash === "#island");
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  async function act(a: IslandAction, done?: string) {
    if (busy) return false;
    setBusy(true);
    try {
      const r = await api("rooms/" + p.code + "/island", "POST", a, p.token);
      setS(r.island);
      if (done) setToast(done);
      return true;
    } catch (e) {
      setToast((e as Error).message);
      void load();
      return false;
    } finally {
      setBusy(false);
    }
  }
  function show(on: boolean) {
    setOpen(on);
    setSheet(null);
    if (on) history.pushState(null, "", "#island");
    else if (location.hash === "#island")
      history.replaceState(null, "", location.pathname + location.search);
  }

  if (!s) return null;
  const bag = s.bags[me];
  const ripe = s.plots[me].filter((x) => x.crop && x.readyAt <= now).length;
  const docked = s.boats.filter((b) => b.from === other && b.arrivesAt <= now);
  const growing = s.plots[me].filter((x) => x.crop && x.readyAt > now).length;
  const summary = docked.length
    ? "有纸船靠岸"
    : ripe
      ? `${ripe} 块地可以收`
      : growing
        ? `${growing} 块地在长`
        : "去种点什么";

  const plotTile = (x: Plot, i: number, mine: boolean) => {
    const ready = !!x.crop && x.readyAt <= now;
    const canWater = !mine && !!x.crop && !ready && x.wateredAt === null;
    const progress = x.crop
      ? Math.min(1, (now - x.plantedAt) / Math.max(1, x.readyAt - x.plantedAt))
      : 0;
    const onClick = () => {
      if (mine && !x.crop) setSheet({ kind: "seed", plot: i });
      else if (mine && ready)
        void act(
          { cmd: "harvest", plot: i },
          `收下 ${CROPS[x.crop!].yield} 个${ITEM_NAMES[x.crop!]}`,
        );
      else if (canWater) void act({ cmd: "water", plot: i }, "浇好了");
    };
    return (
      <button
        class={
          "isle-plot" +
          (ready ? " ready" : "") +
          (canWater ? " thirsty" : "") +
          (!x.crop && mine ? " empty" : "")
        }
        disabled={busy || (!(mine && (!x.crop || ready)) && !canWater)}
        aria-label={
          x.crop
            ? `${ITEM_NAMES[x.crop]}${ready ? " 可以收" : " 还要" + left(x.readyAt - now)}`
            : mine
              ? "空地，点了种东西"
              : "空地"
        }
        onClick={onClick}
      >
        {x.crop ? (
          <>
            <span
              class={"isle-crop" + (ready ? " bob" : "")}
              style={{ "--grow": 0.55 + 0.45 * progress }}
            >
              {ICONS[x.crop]}
            </span>
            {!ready && <small>{left(x.readyAt - now)}</small>}
            {x.wateredAt !== null && (
              <i class="isle-drop" aria-hidden="true">
                💧
              </i>
            )}
            {canWater && <i class="isle-water">浇水</i>}
          </>
        ) : (
          mine && <span class="isle-plus">＋</span>
        )}
      </button>
    );
  };

  const needs = upgradeNeeds(s.level);
  const boxDone = Object.entries(needs).reduce(
    (a, [k]) => a + Math.min(s.box[k as Item] ?? 0, needs[k as Item]!),
    0,
  );
  const boxAll = Object.values(needs).reduce((a, b) => a + (b ?? 0), 0);
  const outgoing = s.boats.filter((b) => b.from === me);
  const incoming = s.boats.filter((b) => b.from === other && b.arrivesAt > now);

  return (
    <>
      <button
        class={"isle-entry" + (ripe || docked.length ? " alert" : "")}
        onClick={() => show(true)}
      >
        <span class="isle-entry-icon" aria-hidden="true">
          🏝️
        </span>
        <span class="isle-entry-text">
          <b>半途岛</b>
          <small>{summary}</small>
        </span>
        <span class="isle-entry-level">Lv {s.level}</span>
      </button>

      {open && (
        <div class="isle" role="dialog" aria-label="半途岛">
          <header class="isle-bar">
            <button
              class="round-small"
              aria-label="收起岛"
              onClick={() => show(false)}
            >
              ✕
            </button>
            <button
              class="isle-level"
              onClick={() => setSheet({ kind: "level" })}
            >
              <b>Lv {s.level}</b>
              {s.level < MAX_LEVEL && (
                <span
                  class="isle-meter"
                  aria-label={`建设进度 ${boxDone}/${boxAll}`}
                >
                  <i style={{ width: `${(boxDone / boxAll) * 100}%` }} />
                </span>
              )}
            </button>
          </header>

          <section class="isle-shore theirs">
            <h3>
              {SHORE_NAMES[other]} · {partner}
            </h3>
            <div class="isle-plots">
              {s.plots[other].map((x, i) => plotTile(x, i, false))}
            </div>
          </section>

          <section class="isle-sea" aria-label="海">
            {incoming.map((b) => (
              <span
                class="isle-boat drifting"
                title={"还要 " + left(b.arrivesAt - now)}
              >
                ⛵<small>{left(b.arrivesAt - now)}</small>
              </span>
            ))}
            {outgoing.map((b) => (
              <span class="isle-boat away" title="在路上">
                ⛵
                <small>
                  {b.arrivesAt > now ? left(b.arrivesAt - now) : "已靠岸"}
                </small>
              </span>
            ))}
            {docked.map((b) => (
              <button
                class="isle-boat docked"
                aria-label="打开纸船"
                onClick={async () => {
                  if (await act({ cmd: "open", boat: b.id }))
                    setSheet({
                      kind: "letter",
                      note: b.note,
                      items: b.items,
                      from: partner,
                    });
                }}
              >
                ⛵<small>打开</small>
              </button>
            ))}
          </section>

          <section class="isle-shore mine">
            <div class="isle-plots">
              {s.plots[me].map((x, i) => plotTile(x, i, true))}
            </div>
            <h3>{SHORE_NAMES[me]} · 你</h3>
          </section>

          <nav class="isle-dock">
            <button onClick={() => setSheet({ kind: "bag" })}>
              🎒<span>背包</span>
              {total(bag) > 0 && <b>{total(bag)}</b>}
            </button>
            <button onClick={() => setSheet({ kind: "craft" })}>
              🛠️<span>工坊</span>
            </button>
            <button
              onClick={() => {
                setCargo({});
                setNote("");
                setSheet({ kind: "boat" });
              }}
            >
              ⛵<span>纸船</span>
            </button>
          </nav>

          {toast && (
            <p class="isle-toast" role="status">
              {toast}
            </p>
          )}

          {sheet && (
            <div class="isle-sheet-back" onClick={() => setSheet(null)}>
              <div class="isle-sheet" onClick={(e) => e.stopPropagation()}>
                {sheet.kind === "seed" && (
                  <>
                    <h3>种什么</h3>
                    <div class="isle-list">
                      {(Object.keys(CROPS) as Crop[])
                        .filter(
                          (c) =>
                            CROPS[c].only === undefined || CROPS[c].only === me,
                        )
                        .map((c) => (
                          <button
                            class="isle-row"
                            disabled={busy}
                            onClick={async () => {
                              if (
                                await act({
                                  cmd: "plant",
                                  plot: sheet.plot,
                                  crop: c,
                                })
                              )
                                setSheet(null);
                            }}
                          >
                            <ItemIcon item={c} />
                            <span>{ITEM_NAMES[c]}</span>
                            <small>{CROPS[c].hours} 小时</small>
                          </button>
                        ))}
                    </div>
                  </>
                )}
                {sheet.kind === "bag" && (
                  <>
                    <h3>背包</h3>
                    <div class="isle-grid">
                      {(Object.keys(bag) as Item[]).map((k) => (
                        <span class="isle-cell">
                          <ItemIcon item={k} />
                          <small>{ITEM_NAMES[k]}</small>
                          <b>{bag[k]}</b>
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {sheet.kind === "craft" && (
                  <>
                    <h3>工坊</h3>
                    <div class="isle-list">
                      {RECIPES.map((r) => {
                        const ok = Object.entries(r.needs).every(
                          ([k, n]) => (bag[k as Item] ?? 0) >= (n as number),
                        );
                        return (
                          <button
                            class="isle-row"
                            disabled={busy || !ok}
                            onClick={() =>
                              void act(
                                { cmd: "craft", out: r.out },
                                "做好了 " + ITEM_NAMES[r.out],
                              )
                            }
                          >
                            <ItemIcon item={r.out} />
                            <span>{ITEM_NAMES[r.out]}</span>
                            <small>
                              {Object.entries(r.needs).map(([k, n]) => (
                                <em
                                  class={
                                    (bag[k as Item] ?? 0) >= (n as number)
                                      ? ""
                                      : "short"
                                  }
                                >
                                  {ITEM_NAMES[k as Item]} {bag[k as Item] ?? 0}/
                                  {n}
                                </em>
                              ))}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {sheet.kind === "boat" && (
                  <>
                    <h3>寄给 {partner}</h3>
                    <div class="isle-list">
                      {(Object.keys(bag) as Item[]).map((k) => {
                        const reserve = BOAT_COST[k] ?? 0,
                          max = (bag[k] ?? 0) - reserve,
                          n = cargo[k] ?? 0,
                          full = Object.keys(cargo).length >= 3 && !n;
                        if (max <= 0) return null;
                        const set = (v: number) => {
                          const next = { ...cargo };
                          if (v > 0) next[k] = v;
                          else delete next[k];
                          setCargo(next);
                        };
                        return (
                          <div class="isle-row">
                            <ItemIcon item={k} />
                            <span>{ITEM_NAMES[k]}</span>
                            <span class="isle-stepper">
                              <button
                                aria-label={"少放一个" + ITEM_NAMES[k]}
                                disabled={!n}
                                onClick={() => set(n - 1)}
                              >
                                −
                              </button>
                              <b>{n}</b>
                              <button
                                aria-label={"多放一个" + ITEM_NAMES[k]}
                                disabled={n >= max || full}
                                onClick={() => set(n + 1)}
                              >
                                ＋
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <input
                      class="isle-note"
                      aria-label="夹一句话"
                      placeholder="夹一句话"
                      maxLength={NOTE_MAX}
                      value={note}
                      onInput={(e) => setNote(e.currentTarget.value)}
                    />
                    <button
                      class="primary wide"
                      disabled={
                        busy ||
                        (bag.paper ?? 0) < 1 ||
                        (!total(cargo) && !note.trim())
                      }
                      onClick={async () => {
                        if (
                          await act(
                            { cmd: "send", items: cargo, note },
                            "纸船出发了，1 小时后靠岸",
                          )
                        )
                          setSheet(null);
                      }}
                    >
                      {(bag.paper ?? 0) < 1 ? "要 1 张纸才能折纸船" : "放船"}
                    </button>
                  </>
                )}
                {sheet.kind === "level" && (
                  <>
                    <h3>
                      {s.level < MAX_LEVEL
                        ? `升到 Lv ${s.level + 1}`
                        : "已经是最高级"}
                    </h3>
                    {s.level < MAX_LEVEL && (
                      <div class="isle-list">
                        {(Object.keys(needs) as Item[]).map((k) => {
                          const want = needs[k]! - (s.box[k] ?? 0),
                            mine = Math.min(bag[k] ?? 0, want);
                          return (
                            <div class="isle-row">
                              <ItemIcon item={k} />
                              <span>{ITEM_NAMES[k]}</span>
                              <small>
                                {s.box[k] ?? 0}/{needs[k]}
                              </small>
                              <button
                                class="secondary"
                                disabled={busy || mine < 1}
                                onClick={() =>
                                  void act(
                                    { cmd: "contribute", item: k, count: mine },
                                    "放进去了",
                                  )
                                }
                              >
                                放入{mine > 0 ? ` ${mine}` : ""}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                {sheet.kind === "letter" && (
                  <>
                    <h3>{sheet.from} 的纸船</h3>
                    {sheet.note && <p class="isle-letter">{sheet.note}</p>}
                    <div class="isle-grid">
                      {(Object.keys(sheet.items) as Item[]).map((k) => (
                        <span class="isle-cell">
                          <ItemIcon item={k} />
                          <small>{ITEM_NAMES[k]}</small>
                          <b>{sheet.items[k]}</b>
                        </span>
                      ))}
                    </div>
                    <button class="primary wide" onClick={() => setSheet(null)}>
                      收下
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
