// 心动老虎机: symbols, the third reel's strip and the fate cards.
export const symbols = ["💗", "🌹", "💋", "🍰", "🧸", "⭐", "🍋", "💔"];
export const symbolNames: Record<string, string> = {
  "💗": "心动",
  "🌹": "玫瑰",
  "💋": "亲亲",
  "🍰": "蛋糕",
  "🧸": "抱抱熊",
  "⭐": "星星",
  "🍋": "柠檬",
  "💔": "心碎",
};
/** Weights for the two auto reels (💔 is rare, 💗 a little rarer). */
export const weights = [2, 3, 3, 3, 3, 3, 2, 1];
/** The partner-stopped third reel cycles this strip at a fixed speed. */
export const strip = ["💗", "🍋", "🌹", "⭐", "💋", "💔", "🧸", "🍰"];
export const SPEED = 170;
export const STOP1 = 1100;
export const STOP2 = 1800;
export const AUTO_STOP = 9000;
export function stripAt(offset: number, elapsed: number) {
  return strip[
    (offset + Math.floor(Math.max(0, elapsed) / SPEED)) % strip.length
  ];
}
export type Target = "puller" | "partner" | "both";
export interface Card {
  text: string;
  target: Target;
}
const triples: Record<string, Card> = {
  "💗": {
    text: "命中注定！TA 送你一张心愿券，随时兑现一个小心愿",
    target: "partner",
  },
  "🌹": { text: "看着 TA 的眼睛，说三个你喜欢 TA 的理由", target: "puller" },
  "💋": { text: "隔着屏幕（或者真的）亲 TA 一下，要有声音", target: "puller" },
  "🍰": { text: "下次约会的甜品由 TA 请客，现在说好吃什么", target: "partner" },
  "🧸": {
    text: "给 TA 一个十秒的熊抱，异地就用语音说“抱抱”十秒",
    target: "both",
  },
  "⭐": { text: "一起说一个关于你们未来的愿望，越具体越好", target: "both" },
  "🍋": { text: "醋坛子翻了！坦白一次你偷偷吃 TA 醋的经历", target: "puller" },
  "💔": {
    text: "虐恋情深…两人各说一句“对不起，我爱你”，和好仪式完成",
    target: "both",
  },
};
const pairs: Card[] = [
  { text: "说出 TA 最让你心动的一个小动作", target: "puller" },
  { text: "TA 用三个词形容你，你来猜对不对", target: "partner" },
  { text: "模仿 TA 生气时的样子，TA 来打分", target: "puller" },
  { text: "说一件你们之间只有你俩懂的梗", target: "both" },
  { text: "TA 给你起一个新的专属昵称", target: "partner" },
  { text: "回忆你们第一次牵手是在哪里", target: "both" },
  { text: "说一句你最想听 TA 对你说的话，TA 照念一遍", target: "partner" },
  { text: "唱一句你们都会的情歌", target: "puller" },
];
const broken: Card[] = [
  { text: "心碎了…用 30 秒撒娇把 TA 哄开心", target: "puller" },
  { text: "心碎了…说出一件 TA 做过让你特别暖的事来修复", target: "puller" },
  { text: "心碎了…TA 说一个你的小缺点，你要笑着说“改！”", target: "partner" },
];
const plain: Card[] = [
  { text: "小确幸：说一件今天让你开心的小事", target: "puller" },
  { text: "小确幸：TA 猜你现在最想吃什么", target: "partner" },
  { text: "小确幸：给 TA 发一个你觉得最像 TA 的表情", target: "puller" },
  { text: "小确幸：一起数三二一，同时说出彼此的星座", target: "both" },
  { text: "小确幸：说出 TA 最近一次让你笑出声的事", target: "puller" },
];
export interface Outcome {
  name: string;
  mult: number;
  penalty: number;
  card: Card;
  jackpot: boolean;
  wish: boolean;
}
export function judge(reels: string[], pick: number): Outcome {
  const [a, b, c] = reels,
    count = (s: string) => reels.filter((x) => x === s).length;
  if (a === b && b === c) {
    const mult = a === "💗" ? 10 : a === "🍋" ? 3 : a === "💔" ? 0 : 6;
    return {
      name:
        a === "💗"
          ? "命中注定 JACKPOT"
          : a === "💔"
            ? "虐恋情深"
            : a === "🍋"
              ? "醋坛子翻了"
              : "三连 · " + symbolNames[a],
      mult,
      penalty: 0,
      card: triples[a],
      jackpot: a === "💗",
      wish: a === "💗",
    };
  }
  if (count("💔"))
    return {
      name: "心碎了",
      mult: 0,
      penalty: 1,
      card: broken[pick % broken.length],
      jackpot: false,
      wish: false,
    };
  if (a === b || b === c || a === c)
    return {
      name: "成双成对",
      mult: count("💗") === 2 ? 3 : 2,
      penalty: 0,
      card: pairs[pick % pairs.length],
      jackpot: false,
      wish: false,
    };
  return {
    name: count("💗") ? "有点心动" : "擦肩而过",
    mult: count("💗") ? 1 : 0,
    penalty: 0,
    card: plain[pick % plain.length],
    jackpot: false,
    wish: false,
  };
}
export function title(coins: number) {
  if (coins >= 60) return "天作之合";
  if (coins >= 35) return "甜度超标";
  if (coins >= 20) return "细水长流";
  if (coins >= 1) return "欢喜冤家";
  return "爱情破产，但还有彼此";
}
export const reactions = ["😘", "😂", "🥺", "😏", "👏", "💢"];
