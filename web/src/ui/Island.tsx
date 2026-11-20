// 半途岛：大厅里的入口卡片 + 全屏的岛。
// 规则和数据都在服务器（shared/island/rules.ts）；这里只负责画面、操作和反馈。
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import { api } from "../api";
import type { Transport } from "../net/transport";
import { errors, type Profile, type Seat } from "../../../shared/protocol";
import {
  BOAT_COST,
  CROPS,
  ITEM_NAMES,
  MAX_LEVEL,
  NOTE_MAX,
  RECIPES,
  SHORE_NAMES,
  upgradeNeeds,
  type Boat,
  type Crop,
  type Island as IslandState,
  type IslandAction,
  type Item,
  type Plot,
} from "../../../shared/island/rules";
import {
  BagArt,
  BoatArt,
  CropArt,
  DockArt,
  DropArt,
  IslandMini,
  ItemArt,
  ShellBadge,
  WorkshopArt,
} from "../art/island";
import "./island.css";

type Bag = Partial<Record<Item, number>>;
const total = (bag: Bag) =>
  Object.values(bag).reduce((a, b) => a + (b ?? 0), 0);
/** 剩余时间：1 时 05 分 / 25 分 */
const left = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m >= 60
    ? `${Math.floor(m / 60)} 时 ${String(m % 60).padStart(2, "0")} 分`
    : `${m} 分`;
};
const stageOf = (p: Plot, now: number): 0 | 1 | 2 => {
  if (p.readyAt <= now) return 2;
  const t = (now - p.plantedAt) / Math.max(1, p.readyAt - p.plantedAt);
  return t < 0.3 ? 0 : 1;
};
const KINDS: [string, (i: Item) => boolean][] = [
  ["作物", (i) => i in CROPS],
  ["材料", (i) => !(i in CROPS) && !i.startsWith("card-")],
  ["牌", (i) => i.startsWith("card-")],
];
// 服务器只回“操作无效”；按动作说清楚是哪里不行
const WHY: Partial<Record<IslandAction["cmd"], string>> = {
  plant: "这块地已经种上了",
  harvest: "还没熟",
  water: "这块地现在不能浇",
  craft: "材料不够",
  send: "背包里的东西不够",
  open: "纸船还没靠岸",
  contribute: "已经放够了",
};

type Panel =
  | { kind: "bag" | "craft" | "boat" | "build" }
  | { kind: "letter"; boat: Boat };
type Flyer = { id: number; item: Item; x: number; y: number; n: number };

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
    [panel, setPanel] = useState<Panel | null>(null),
    [seed, setSeed] = useState<{
      plot: number;
      x: number;
      y: number;
      below: boolean;
    } | null>(null),
    [pending, setPending] = useState<string | null>(null),
    [shake, setShake] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [flyers, setFlyers] = useState<Flyer[]>([]),
    [bump, setBump] = useState(0),
    [cargo, setCargo] = useState<Bag>({}),
    [note, setNote] = useState(""),
    [leveled, setLeveled] = useState(0);
  const bagRef = useRef<HTMLButtonElement>(null),
    flyId = useRef(0);
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
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (seed) setSeed(null);
      else if (panel) setPanel(null);
      else show(false);
    };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [open, seed, panel]);

  /** 发一个操作；key 标记界面上哪个东西在处理中 */
  async function act(a: IslandAction, key: string) {
    if (pending === key) return null;
    setPending(key);
    try {
      const r = await api("rooms/" + p.code + "/island", "POST", a, p.token);
      const before = s;
      setS(r.island);
      if (before && r.island.level > before.level) setLeveled(r.island.level);
      return r.island as IslandState;
    } catch (e) {
      // 断网时 fetch 抛 TypeError；服务器拒绝时是 errors.INVALID，按动作换成具体原因
      const msg = (e as Error).message;
      setToast(
        e instanceof TypeError || msg.includes("连接")
          ? "连不上服务器，等一下再试"
          : msg === errors.INVALID
            ? (WHY[a.cmd] ?? msg)
            : msg,
      );
      setShake(key);
      setTimeout(() => setShake(null), 500);
      void load();
      return null;
    } finally {
      setPending(null);
    }
  }
  /** 东西从屏幕上某处飞进背包 */
  function fly(from: Element | null, items: Bag) {
    const bag = bagRef.current?.getBoundingClientRect();
    const r = from?.getBoundingClientRect();
    if (!bag || !r) return;
    const list = Object.entries(items).map(([item, n], i) => ({
      id: ++flyId.current,
      item: item as Item,
      n: n as number,
      x: r.left + r.width / 2 - 24 + i * 14,
      y: r.top + r.height / 3,
    }));
    setFlyers((f) => [...f, ...list]);
    setTimeout(() => {
      setFlyers((f) => f.filter((x) => !list.includes(x)));
      setBump((b) => b + 1);
    }, 720);
  }
  function show(on: boolean) {
    setOpen(on);
    setPanel(null);
    setSeed(null);
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
  const needs = upgradeNeeds(s.level);
  const boxHave = Object.keys(needs).reduce(
    (a, k) => a + Math.min(s.box[k as Item] ?? 0, needs[k as Item]!),
    0,
  );
  const boxAll = Object.values(needs).reduce((a, b) => a + (b ?? 0), 0);

  const plot = (x: Plot, i: number, mine: boolean) => {
    const key = (mine ? "m" : "t") + i;
    const ready = !!x.crop && x.readyAt <= now;
    const canWater = !mine && !!x.crop && !ready && x.wateredAt === null;
    const action = mine
      ? !x.crop
        ? "plant"
        : ready
          ? "harvest"
          : null
      : canWater
        ? "water"
        : null;
    const label = x.crop
      ? `${ITEM_NAMES[x.crop]}，${ready ? "熟了" : "还要 " + left(x.readyAt - now)}${x.wateredAt !== null ? "，浇过水" : ""}`
      : "空地";
    const onClick = async (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
      const el = e.currentTarget;
      if (action === "plant") {
        const r = el.getBoundingClientRect();
        const below = r.top < 260;
        setSeed({
          plot: i,
          x: r.left + r.width / 2,
          y: below ? r.bottom : r.top,
          below,
        });
      } else if (action === "harvest") {
        const crop = x.crop!;
        if (await act({ cmd: "harvest", plot: i }, key))
          fly(el, { [crop]: CROPS[crop].yield });
      } else if (action === "water") {
        if (await act({ cmd: "water", plot: i }, key))
          setToast(`帮 ${partner} 浇好了，${ITEM_NAMES[x.crop!]}快了一半`);
      }
    };
    return (
      <button
        key={key}
        class={[
          "plot",
          x.crop ? "planted" : "empty",
          ready && "ripe",
          x.wateredAt !== null && "wet",
          action && "actionable",
          pending === key && "busy",
          shake === key && "shake",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={
          (mine ? "" : partner + "的") +
          label +
          (action === "plant"
            ? "，点了种东西"
            : action === "harvest"
              ? "，点了收"
              : action === "water"
                ? "，点了浇水"
                : "")
        }
        aria-disabled={!action}
        onClick={action ? onClick : undefined}
      >
        <span class="soil" aria-hidden="true" />
        {x.crop && (
          <span class="crop" aria-hidden="true">
            <CropArt crop={x.crop} stage={stageOf(x, now)} />
          </span>
        )}
        {mine && x.crop && !ready && (
          <span class="timer">{left(x.readyAt - now)}</span>
        )}
        {canWater && (
          <span class="water-badge" aria-hidden="true">
            <DropArt />
          </span>
        )}
        {!x.crop && mine && <span class="plus" aria-hidden="true" />}
      </button>
    );
  };

  // 海峡里的纸船：按真实时间在航线上的位置
  const sailing = s.boats.filter((b) => b.arrivesAt > now);
  const progress = (b: Boat) =>
    Math.min(1, Math.max(0, (now - b.sentAt) / (b.arrivesAt - b.sentAt)));
  const mineFirst = me === 1; // 横屏时按地理：西岸在左
  const shoreTheirs = (
    <section
      class={"shore theirs " + (other === 1 ? "west" : "east")}
      aria-label={SHORE_NAMES[other] + " · " + partner}
    >
      <h3 class="shore-tag">
        {SHORE_NAMES[other]} · {partner}
      </h3>
      <div class="plots" style={{ "--n": s.plots[other].length }}>
        {s.plots[other].map((x, i) => plot(x, i, false))}
      </div>
      {s.boats
        .filter((b) => b.from === me && b.arrivesAt <= now)
        .map(() => (
          <span class="moored" title={partner + " 还没打开"}>
            <BoatArt letter />
          </span>
        ))}
    </section>
  );
  const shoreMine = (
    <section
      class={"shore mine " + (me === 1 ? "west" : "east")}
      aria-label={SHORE_NAMES[me] + " · 你"}
    >
      <h3 class="shore-tag">{SHORE_NAMES[me]} · 你</h3>
      <div class="plots" style={{ "--n": s.plots[me].length }}>
        {s.plots[me].map((x, i) => plot(x, i, true))}
      </div>
      <div class="buildings">
        <button
          class="building"
          aria-label="工坊"
          onClick={() => setPanel({ kind: "craft" })}
        >
          <WorkshopArt />
          <span>工坊</span>
        </button>
        <div class="dock-wrap">
          <button
            class="building"
            aria-label="码头，寄纸船"
            onClick={() => {
              setCargo({});
              setNote("");
              setPanel({ kind: "boat" });
            }}
          >
            <DockArt />
            <span>码头</span>
          </button>
          {docked.map((b) => (
            <button
              class={"docked-boat" + (pending === "o" + b.id ? " busy" : "")}
              aria-label={"打开 " + partner + " 的纸船"}
              onClick={async (e) => {
                const el = e.currentTarget;
                if (await act({ cmd: "open", boat: b.id }, "o" + b.id)) {
                  setPanel({ kind: "letter", boat: b });
                  fly(el, b.items);
                }
              }}
            >
              <BoatArt letter />
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <>
      <button
        class={"isle-entry" + (ripe || docked.length ? " alert" : "")}
        onClick={() => show(true)}
      >
        <span class="isle-entry-icon">
          <IslandMini />
        </span>
        <span class="isle-entry-text">
          <b>半途岛</b>
          <small>{summary}</small>
        </span>
        <span class="isle-entry-level">Lv {s.level}</span>
      </button>

      {open && (
        <div class="isle" role="dialog" aria-label="半途岛">
          <div class={"world" + (mineFirst ? " mine-west" : "")}>
            {mineFirst ? shoreMine : shoreTheirs}
            <div class="strait" aria-label="海峡">
              {sailing.map((b) => {
                const t = progress(b),
                  toMe = b.from === other;
                return (
                  <span
                    class={"sailing " + (toMe ? "to-me" : "to-them")}
                    style={{ "--t": toMe === mineFirst ? 1 - t : t }}
                    title={
                      (toMe ? partner + " 寄来的纸船" : "寄给 " + partner) +
                      "，还要 " +
                      left(b.arrivesAt - now)
                    }
                  >
                    <BoatArt letter={toMe} />
                    <small>{left(b.arrivesAt - now)}</small>
                  </span>
                );
              })}
            </div>
            {mineFirst ? shoreTheirs : shoreMine}
          </div>

          <header class="hud hud-left">
            <button
              class="hud-round"
              aria-label="收起岛"
              onClick={() => show(false)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15 5l-7 7 7 7"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <button
              class="level-chip"
              aria-label={`岛 ${s.level} 级，建设箱 ${boxHave}/${boxAll}`}
              onClick={() => setPanel({ kind: "build" })}
            >
              <ShellBadge level={s.level} />
              {s.level < MAX_LEVEL ? (
                <span class="level-bar">
                  <i style={{ width: `${(boxHave / boxAll) * 100}%` }} />
                  <em>
                    {boxHave}/{boxAll}
                  </em>
                </span>
              ) : (
                <span class="level-max">满级</span>
              )}
            </button>
          </header>
          <div class="hud hud-right">
            <button
              ref={bagRef}
              key={"bag" + bump}
              class={"hud-bag" + (bump ? " bump" : "")}
              aria-label={`背包，${total(bag)} 件`}
              onClick={() => setPanel({ kind: "bag" })}
            >
              <BagArt />
              <b>{total(bag)}</b>
            </button>
          </div>

          {flyers.map((f) => {
            const bagRect = bagRef.current?.getBoundingClientRect();
            return (
              <span
                key={f.id}
                class="flyer"
                style={{
                  left: f.x + "px",
                  top: f.y + "px",
                  "--dx": (bagRect ? bagRect.left + 8 - f.x : 0) + "px",
                  "--dy": (bagRect ? bagRect.top + 4 - f.y : 0) + "px",
                }}
              >
                <ItemArt item={f.item} />
                <b>+{f.n}</b>
              </span>
            );
          })}

          {seed && (
            <SeedPicker
              seat={me}
              at={seed}
              busy={pending === "m" + seed.plot}
              close={() => setSeed(null)}
              pick={async (crop) => {
                const index = seed.plot;
                setSeed(null);
                await act({ cmd: "plant", plot: index, crop }, "m" + index);
              }}
            />
          )}

          {panel && (
            <div class="sheet-back" onClick={() => setPanel(null)}>
              <section
                class={"sheet sheet-" + panel.kind}
                role="dialog"
                aria-label={
                  {
                    bag: "背包",
                    craft: "工坊",
                    boat: "寄纸船",
                    build: "建设箱",
                    letter: "纸船",
                  }[panel.kind]
                }
                onClick={(e) => e.stopPropagation()}
              >
                <header class="sheet-head">
                  <h3>
                    {panel.kind === "bag"
                      ? "背包"
                      : panel.kind === "craft"
                        ? "工坊"
                        : panel.kind === "boat"
                          ? "寄给 " + partner
                          : panel.kind === "build"
                            ? s.level < MAX_LEVEL
                              ? `建设箱 · 升到 Lv ${s.level + 1}`
                              : "岛已经满级"
                            : partner + " 的纸船"}
                  </h3>
                  <button
                    class="sheet-close"
                    aria-label="关闭"
                    onClick={() => setPanel(null)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                </header>

                {panel.kind === "bag" &&
                  (total(bag) ? (
                    KINDS.map(([name, test]) => {
                      const items = (Object.keys(bag) as Item[]).filter(test);
                      return items.length ? (
                        <div class="bag-group">
                          <h4>{name}</h4>
                          <div class="stickers">
                            {items.map((k) => (
                              <span class="sticker" title={ITEM_NAMES[k]}>
                                <ItemArt item={k} />
                                <small>{ITEM_NAMES[k]}</small>
                                <b>{bag[k]}</b>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })
                  ) : (
                    <div class="stickers">
                      {Array.from({ length: 8 }, () => (
                        <span class="sticker slot" aria-hidden="true" />
                      ))}
                    </div>
                  ))}

                {panel.kind === "craft" && (
                  <div class="recipes">
                    {RECIPES.map((r) => {
                      const short = Object.entries(r.needs).filter(
                        ([k, n]) => (bag[k as Item] ?? 0) < (n as number),
                      );
                      const key = "c" + r.out;
                      return (
                        <div
                          class={
                            "recipe" +
                            (short.length ? " short" : "") +
                            (shake === key ? " shake" : "")
                          }
                        >
                          <span class="recipe-in">
                            {Object.entries(r.needs).map(([k, n]) => (
                              <span
                                class={
                                  "need" +
                                  ((bag[k as Item] ?? 0) < (n as number)
                                    ? " lack"
                                    : "")
                                }
                              >
                                <ItemArt item={k as Item} />
                                <b>
                                  {bag[k as Item] ?? 0}/{n}
                                </b>
                              </span>
                            ))}
                          </span>
                          <span class="recipe-arrow" aria-hidden="true" />
                          <span class="recipe-out">
                            <ItemArt item={r.out} />
                            <small>{ITEM_NAMES[r.out]}</small>
                          </span>
                          <button
                            class={
                              "chip-button" + (pending === key ? " busy" : "")
                            }
                            disabled={short.length > 0}
                            aria-label={
                              short.length
                                ? `做${ITEM_NAMES[r.out]}，还差${short.map(([k, n]) => `${(n as number) - (bag[k as Item] ?? 0)} 个${ITEM_NAMES[k as Item]}`).join("、")}`
                                : "做" + ITEM_NAMES[r.out]
                            }
                            onClick={async (e) => {
                              const el =
                                e.currentTarget.parentElement?.querySelector(
                                  ".recipe-out",
                                ) ?? null;
                              if (await act({ cmd: "craft", out: r.out }, key))
                                fly(el, { [r.out]: 1 });
                            }}
                          >
                            {short.length
                              ? `差 ${(short[0][1] as number) - (bag[short[0][0] as Item] ?? 0)} ${ITEM_NAMES[short[0][0] as Item]}`
                              : "做"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {panel.kind === "boat" && (
                  <>
                    <div class="cargo">
                      {(Object.keys(bag) as Item[])
                        .filter((k) => (bag[k] ?? 0) - (BOAT_COST[k] ?? 0) > 0)
                        .map((k) => {
                          const max = (bag[k] ?? 0) - (BOAT_COST[k] ?? 0),
                            n = cargo[k] ?? 0,
                            full = Object.keys(cargo).length >= 3 && !n;
                          const set = (v: number) => {
                            const next = { ...cargo };
                            if (v > 0) next[k] = v;
                            else delete next[k];
                            setCargo(next);
                          };
                          return (
                            <div class={"cargo-row" + (n ? " on" : "")}>
                              <ItemArt item={k} />
                              <span>{ITEM_NAMES[k]}</span>
                              <span class="stepper">
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
                                  +
                                </button>
                              </span>
                            </div>
                          );
                        })}
                    </div>
                    <label class="note-field">
                      <span>夹一句话</span>
                      <textarea
                        maxLength={NOTE_MAX}
                        rows={2}
                        value={note}
                        onInput={(e) => setNote(e.currentTarget.value)}
                      />
                      <small>
                        {[...note].length}/{NOTE_MAX}
                      </small>
                    </label>
                    <button
                      class={"big-action" + (pending === "send" ? " busy" : "")}
                      disabled={
                        (bag.paper ?? 0) < 1 || (!total(cargo) && !note.trim())
                      }
                      onClick={async () => {
                        if (
                          await act({ cmd: "send", items: cargo, note }, "send")
                        ) {
                          setPanel(null);
                          setToast("纸船出发了，1 小时后靠岸");
                        }
                      }}
                    >
                      {(bag.paper ?? 0) < 1
                        ? "折纸船要 1 张纸"
                        : "放船 · 用掉 1 张纸"}
                    </button>
                  </>
                )}

                {panel.kind === "build" &&
                  (s.level < MAX_LEVEL ? (
                    <div class="build">
                      {(Object.keys(needs) as Item[]).map((k) => {
                        const inBox = s.box[k] ?? 0,
                          want = needs[k]! - inBox,
                          give = Math.min(bag[k] ?? 0, want),
                          key = "b" + k;
                        return (
                          <div
                            class={
                              "build-row" + (shake === key ? " shake" : "")
                            }
                          >
                            <ItemArt item={k} />
                            <span class="build-text">
                              <b>{ITEM_NAMES[k]}</b>
                              <span class="build-bar">
                                <i
                                  style={{
                                    width: `${(inBox / needs[k]!) * 100}%`,
                                  }}
                                />
                              </span>
                              <small>
                                {inBox}/{needs[k]} · 背包 {bag[k] ?? 0}
                              </small>
                            </span>
                            <button
                              class={
                                "chip-button" + (pending === key ? " busy" : "")
                              }
                              disabled={give < 1}
                              onClick={() =>
                                void act(
                                  { cmd: "contribute", item: k, count: give },
                                  key,
                                )
                              }
                            >
                              {want <= 0
                                ? "够了"
                                : give
                                  ? `放入 ${give}`
                                  : "没有"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null)}

                {panel.kind === "letter" && (
                  <div class="letter">
                    {panel.boat.note && (
                      <p class="letter-paper">{panel.boat.note}</p>
                    )}
                    {total(panel.boat.items) > 0 && (
                      <div class="stickers">
                        {(Object.keys(panel.boat.items) as Item[]).map((k) => (
                          <span class="sticker">
                            <ItemArt item={k} />
                            <small>{ITEM_NAMES[k]}</small>
                            <b>{panel.boat.items[k]}</b>
                          </span>
                        ))}
                      </div>
                    )}
                    <button class="big-action" onClick={() => setPanel(null)}>
                      收好了
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          {leveled > 0 && (
            <div
              class="level-up"
              role="status"
              onAnimationEnd={() => setLeveled(0)}
            >
              <ShellBadge level={leveled} />
              <b>岛升到 Lv {leveled}</b>
              <span>两边各多了一块地</span>
            </div>
          )}
          {toast && (
            <p class="isle-toast" role="status">
              {toast}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** 在点中的地块旁边弹出种子 */
function SeedPicker(p: {
  seat: Seat;
  at: { x: number; y: number; below: boolean };
  busy: boolean;
  close: () => void;
  pick: (c: Crop) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(p.at.x);
  // 贴边时往里收，别出屏
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 0;
    setX(Math.min(Math.max(p.at.x, w / 2 + 10), innerWidth - w / 2 - 10));
    ref.current?.querySelector("button")?.focus();
  }, [p.at.x]);
  const crops = (Object.keys(CROPS) as Crop[]).filter(
    (c) => CROPS[c].only === undefined || CROPS[c].only === p.seat,
  );
  return (
    <div class="seed-back" onClick={p.close}>
      <div
        ref={ref}
        class={"seed-pop" + (p.at.below ? " below" : "")}
        role="menu"
        aria-label="种什么"
        style={{
          left: x + "px",
          top: p.at.y + "px",
          "--arrow": p.at.x - x + "px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {crops.map((c) => (
          <button
            role="menuitem"
            class={"seed" + (CROPS[c].only !== undefined ? " special" : "")}
            disabled={p.busy}
            onClick={() => p.pick(c)}
          >
            <CropArt crop={c} stage={2} />
            <b>{ITEM_NAMES[c]}</b>
            <small>{CROPS[c].hours} 小时</small>
          </button>
        ))}
      </div>
    </div>
  );
}
