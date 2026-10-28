import { useEffect, useRef, useState } from "preact/hooks";
import { Modal } from "./common";
import { api } from "../api";
import type { Profile, Seat, GameResult } from "../../../shared/protocol";
import type { CustomItem, GalleryItem } from "../../../shared/games/types";
import type { Transport } from "../net/transport";
import { paint, type Stroke } from "../games/drawing";
import { usePicture, downloadCanvas } from "../games/image";
import { games } from "../../../shared/catalog";
function Artwork({
  item,
  code,
  token,
  profiles,
}: {
  item: GalleryItem;
  code: string;
  token: string;
  profiles: [Profile, Profile | null];
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [replay, setReplay] = useState(0),
    [saved, setSaved] = useState(""),
    { image, error } = usePicture(
      item.kind === "puzzle" ? item.data.image : "scene:sunset",
      code,
      token,
    );
  useEffect(() => {
    const c = canvas.current!,
      ctx = c.getContext("2d")!;
    let raf = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, c.width, c.height);
    if (item.kind === "drawing") {
      const strokes = item.data.strokes as Stroke[],
        start = Math.min(...strokes.map((s) => s.at)),
        end = Math.max(start, ...strokes.flatMap((s) => s.times)),
        begin = performance.now();
      const draw = () => {
        const cutoff = replay
          ? start + (performance.now() - begin) * 4
          : Infinity;
        paint(ctx, strokes, cutoff);
        if (cutoff < end) raf = requestAnimationFrame(draw);
      };
      draw();
    }
    if (item.kind === "puzzle" && image) {
      c.height = Math.round((1000 * image.naturalHeight) / image.naturalWidth);
      ctx.drawImage(image, 0, 0, c.width, c.height);
    }
    if (item.kind === "chain") {
      const history = item.data.history as any[];
      c.height = Math.max(420, 190 + history.length * 86);
      ctx.fillStyle = "#FFF8E1";
      ctx.fillRect(0, 0, 1000, c.height);
      ctx.strokeStyle = "#E3A64A";
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, 986, c.height - 14);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.font = '64px "DuoLatin", "DuoDisplay", sans-serif';
      ctx.lineWidth = 12;
      ctx.strokeStyle = "#7A3A0A";
      ctx.strokeText("我们的灵犀链", 500, 92);
      ctx.fillStyle = "#FFD23F";
      ctx.fillText("我们的灵犀链", 500, 92);
      history.forEach((h: any, i: number) => {
        const pair = h.answers || h.pair || h,
          y = 190 + i * 86,
          inset = Math.min(170, i * 26);
        [0, 1].forEach((k) => {
          const x = k ? 690 - inset : 310 + inset;
          ctx.fillStyle =
            profiles[k as 0 | 1]?.color || (k ? "#4D9DFF" : "#FF6B6B");
          ctx.strokeStyle = "#3A2618";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.roundRect(x - 140, y - 32, 280, 64, 32);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "bold 32px sans-serif";
          ctx.fillText(String(pair[k]), x, y + 2);
        });
        ctx.fillStyle = "#FF4D6A";
        ctx.font = "36px sans-serif";
        ctx.fillText("♥", 500, y + 2);
      });
    }
    if (item.kind === "difference") {
      c.height = 780;
      ctx.fillStyle = item.data.background;
      ctx.fillRect(0, 0, 1000, 780);
      ctx.textAlign = "center";
      ctx.fillStyle = "#603d52";
      ctx.font = '42px "DuoDisplay",sans-serif';
      ctx.fillText(item.title, 500, 70, 920);
      (item.data.images as any[][]).forEach((objects, i) => {
        const left = 20 + i * 500;
        ctx.fillStyle = "#603d52";
        ctx.font = "28px sans-serif";
        ctx.fillText(i ? "修改图" : "原图", left + 220, 140);
        objects.forEach((o) => {
          const x = left + o.x * 4.5,
            y = 180 + o.y * 4.5;
          ctx.fillStyle = o.color;
          ctx.fillRect(x - 22, y - 30, 44, 55);
          ctx.font = o.size * 4.5 + "px sans-serif";
          ctx.fillText(o.icon.repeat(o.count), x, y + 10);
          ctx.fillStyle = "#422f46";
          ctx.font = "13px sans-serif";
          ctx.fillText(o.direction < 0 ? "◀" : "▶", x, y + 38);
          if (o.pattern === "striped") {
            ctx.strokeStyle = "#83378b";
            ctx.lineWidth = 4;
            for (let n = 0; n < 3; n++) {
              ctx.beginPath();
              ctx.moveTo(x - 16 + n * 15, y - 25);
              ctx.lineTo(x - 16 + n * 15, y + 20);
              ctx.stroke();
            }
          }
        });
        ctx.strokeStyle = "#e94477";
        ctx.lineWidth = 4;
        for (const f of item.data.found) {
          ctx.beginPath();
          ctx.arc(left + f.x * 4.5, 180 + f.y * 4.5, 30, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      ctx.fillStyle = "#bf4267";
      ctx.font = "32px sans-serif";
      ctx.fillText("把每一个不同，说给你听", 500, 735);
    }
    if (!["drawing", "puzzle", "chain", "difference"].includes(item.kind)) {
      c.height = 1000;
      ctx.fillStyle = "#fff1de";
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.textAlign = "center";
      ctx.fillStyle = "#bf4267";
      ctx.font = 'bold 52px "DuoDisplay", sans-serif';
      ctx.fillText(item.title, 500, 130, 900);
      ctx.font = '34px "DuoDisplay", sans-serif';
      ctx.fillStyle = "#63443d";
      const lines: string[] = item.data?.lines || [
        item.data?.stars ? "★".repeat(item.data.stars) : "一起留下的小回忆",
        item.data?.score !== undefined ? `共同得分 ${item.data.score}` : "",
        ...(item.data?.contributions || []).map(
          (v: any, i: number) =>
            `玩家${i + 1} 切菜${v.cuts} 出菜${v.served} 传菜${v.passed}`,
        ),
      ];
      let y = 250;
      for (const line of lines) {
        let row = "";
        for (const char of String(line)) {
          if (ctx.measureText(row + char).width > 820) {
            ctx.fillText(row, 500, y);
            y += 58;
            row = "";
          }
          row += char;
        }
        if (row) {
          ctx.fillText(row, 500, y);
          y += 70;
        }
      }
      ctx.fillStyle = "#d65e79";
      ctx.fillText(
        profiles.map((v) => v?.nickname || "TA").join(" ♥ "),
        500,
        880,
      );
      ctx.font = "28px sans-serif";
      ctx.fillText("原来最好的默契，是愿意听你说", 500, 940);
    }
    return () => cancelAnimationFrame(raf);
  }, [item, image, replay]);
  return (
    <div class="artwork">
      <h3>{item.title}</h3>
      <canvas ref={canvas} width="1000" height="1000" aria-label={item.title} />
      {error && <p role="alert">{error}</p>}
      <div class="button-row">
        {item.kind === "drawing" && (
          <button class="secondary small" onClick={() => setReplay(replay + 1)}>
            4 倍速回看笔画
          </button>
        )}
        <button
          class="go small-go"
          onClick={() => {
            setSaved(canvas.current!.toDataURL("image/png"));
            downloadCanvas(canvas.current!, item.title);
          }}
        >
          保存图片
        </button>
      </div>
      <p class="muted">
        {saved && (
          <>
            长按下面的图片也可以保存。
            <img class="saved-art" src={saved} alt="长按保存作品" />
          </>
        )}
        {new Date(item.at).toLocaleString("zh-CN")}
      </p>
    </div>
  );
}
export default function Keepsakes({
  panel,
  code,
  token,
  seat,
  profiles,
  transport,
  close,
}: {
  panel: string;
  code: string;
  token: string;
  seat: Seat;
  profiles: [Profile, Profile | null];
  transport: Transport;
  close: () => void;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]),
    [detail, setDetail] = useState<GalleryItem | null>(null),
    [matches, setMatches] = useState<GameResult[]>([]),
    [custom, setCustom] = useState<CustomItem[]>([]),
    [kind, setKind] = useState("word"),
    [text, setText] = useState(""),
    [answers, setAnswers] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false);
  const endpoint = "rooms/" + code + "/";
  async function load() {
    try {
      if (panel === "gallery") {
        const data = await api(endpoint + "gallery", "GET", undefined, token);
        setItems(data.items);
        setMore(data.items.length === 20);
      }
      if (panel === "history")
        setMatches(
          (await api(endpoint + "history", "GET", undefined, token)).matches,
        );
      if (panel === "library")
        setCustom(
          (await api(endpoint + "custom", "GET", undefined, token)).items,
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    return transport.subscribe((m) => {
      if (
        m.t === "extra" &&
        m.event.run === "room" &&
        m.event.kind === "library"
      )
        void load();
    });
  }, [panel]);
  async function add(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const options = answers
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      if (kind === "question" && options.length && options.length !== 4)
        throw new Error("选择题请写 4 个选项，每行一个；留空就是简答题。");
      await api(
        endpoint + "custom",
        "POST",
        kind === "word"
          ? { kind, word: text }
          : {
              kind,
              text,
              ...(options.length && kind === "question" ? { options } : {}),
            },
        token,
      );
      setText("");
      setAnswers("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function promise(item: CustomItem, action: string) {
    try {
      await api(endpoint + "custom/" + item.id, "POST", { action }, token);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const recent = matches.filter((x) => !x.aborted).slice(0, 10),
    wins = matches.filter(
      (x) => x.gameId === "gomoku" && x.stats.winner === seat,
    ).length,
    board = matches.filter(
      (x) => x.gameId === "gomoku" && x.stats.winner >= 0,
    ).length;
  return (
    <Modal
      title={
        panel === "gallery"
          ? "我们的画廊"
          : panel === "history"
            ? "一起玩过的日子"
            : "只有我们知道"
      }
      close={close}
    >
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      {panel === "gallery" &&
        (detail ? (
          <>
            <button class="text-button" onClick={() => setDetail(null)}>
              ← 返回画廊
            </button>
            <Artwork
              item={detail}
              code={code}
              token={token}
              profiles={profiles}
            />
          </>
        ) : (
          <>
            <p class="muted">画过的画、走过的联想、拼好的回忆，都留在这里。</p>
            <div class="gallery-list">
              {items.map((item) => (
                <button
                  onClick={() =>
                    void api(
                      endpoint + "gallery/" + item.id,
                      "GET",
                      undefined,
                      token,
                    )
                      .then(setDetail)
                      .catch((e) => setError(e.message))
                  }
                >
                  <span>
                    {item.kind === "drawing"
                      ? "✎"
                      : item.kind === "chain"
                        ? "♡"
                        : "▧"}
                  </span>
                  <strong>{item.title}</strong>
                  <small>{new Date(item.at).toLocaleDateString("zh-CN")}</small>
                </button>
              ))}
            </div>
            {!items.length && <p class="empty">第一份作品，等你们一起完成。</p>}
            {more && (
              <button
                class="secondary small"
                onClick={() =>
                  void api(
                    endpoint + "gallery?offset=" + items.length,
                    "GET",
                    undefined,
                    token,
                  )
                    .then((data) => {
                      setItems([...items, ...data.items]);
                      setMore(data.items.length === 20);
                    })
                    .catch((e) => setError(e.message))
                }
              >
                再看 20 件
              </button>
            )}
          </>
        ))}
      {panel === "history" && (
        <>
          <div class="history-overview">
            <strong>
              {matches.length}
              {matches.length === 50 ? "+" : ""} 次相伴
            </strong>
            <span>
              五子棋胜率 {board ? Math.round((wins / board) * 100) + "%" : "—"}
            </span>
          </div>
          {recent.length > 1 && (
            <div class="score-trend" aria-label="最近十局成绩">
              {recent
                .slice()
                .reverse()
                .map((m, i) => (
                  <div title={m.primary.label + " " + m.primary.value}>
                    <b>{m.primary.value}</b>
                    <span>{i + 1}</span>
                  </div>
                ))}
            </div>
          )}
          <div class="history-list">
            {matches.map((m) => (
              <article>
                <small>
                  {games.find((x) => x.id === m.gameId)?.name || "深夜聊天卡"} ·{" "}
                  {m.endedAt
                    ? new Date(m.endedAt).toLocaleDateString("zh-CN")
                    : ""}
                </small>
                <h3>
                  {m.primary.label} <em>{m.primary.value}</em>
                </h3>
                <p>{m.highlights[0]}</p>
              </article>
            ))}
            {!matches.length && <p class="empty">玩完第一局，再来看看。</p>}
          </div>
        </>
      )}
      {panel === "library" && (
        <>
          <div class="tabs">
            {[
              ["word", "回忆词"],
              ["question", "我们的题目"],
              ["promise", "小约定"],
            ].map(([id, label]) => (
              <button
                aria-pressed={kind === id}
                onClick={() => {
                  setKind(id);
                  setText("");
                  setAnswers("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p class="muted">
            {kind === "word"
              ? "你的词只有自己能看见，会出现在你当画手的回合。两人各准备至少 3 个，就能只玩回忆词。"
              : kind === "question"
                ? "写一道关于自己的题，会加入「你懂我吗」的题库。"
                : "一个人提议，另一个人答应，一起慢慢完成。"}
          </p>
          <form class="library-form" onSubmit={add}>
            <label>
              {kind === "word"
                ? "回忆词"
                : kind === "question"
                  ? "题目（可用 {name} 代替昵称）"
                  : "我们的小约定"}
              <input
                aria-label="自定义内容"
                maxLength={kind === "word" ? 20 : 60}
                required
                value={text}
                onInput={(e) => setText(e.currentTarget.value)}
              />
            </label>
            {kind === "question" && (
              <label>
                4 个选项，每行一个（留空为简答）
                <textarea
                  rows={4}
                  maxLength={123}
                  value={answers}
                  onInput={(e) => setAnswers(e.currentTarget.value)}
                />
              </label>
            )}
            <button class="primary" disabled={busy || !text.trim()}>
              {busy ? "正在保存…" : "加进我们的收藏"}
            </button>
          </form>
          <ul class="custom-list">
            {custom
              .filter((x) => x.kind === kind)
              .map((item) => (
                <li>
                  <span>{item.data.word || item.data.text}</span>
                  {kind === "promise" ? (
                    <small>
                      {item.data.done ? (
                        "✓ 已完成"
                      ) : item.data.accepted ? (
                        <button
                          class="secondary small"
                          onClick={() => void promise(item, "done")}
                        >
                          标记完成
                        </button>
                      ) : item.author === seat ? (
                        "等 TA 答应"
                      ) : (
                        <button
                          class="go small-go"
                          onClick={() => void promise(item, "accept")}
                        >
                          好呀，一起做
                        </button>
                      )}
                    </small>
                  ) : (
                    <small>{profiles[item.author]?.nickname}</small>
                  )}
                </li>
              ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
