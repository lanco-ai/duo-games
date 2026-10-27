// Original, self-contained prompts and scene geometry shared by server and client.
export type SurvivalLevel = {
  scene: string;
  prompt: string;
  options: [string, string, string];
  scores: [number, number, number];
  clue: number;
  hint: string;
};
export const survivalLevels: SurvivalLevel[] = [
  {
    scene: "车里",
    prompt: "副驾驶的口红是谁的？",
    options: ["不告诉你", "给你准备的惊喜", "你肯定看错了"],
    scores: [0, 10, -10],
    clue: 0,
    hint: "看看座位上的小盒子",
  },
  {
    scene: "客厅",
    prompt: "纪念日快到了，你准备了什么？",
    options: ["一起决定怎么过", "根本不重要", "忘记就忘记了"],
    scores: [10, 0, -10],
    clue: 1,
    hint: "桌上有一张日历",
  },
  {
    scene: "咖啡馆",
    prompt: "我今天是不是有点累？",
    options: ["你想太多了", "要不要休息，我陪你", "我才累呢"],
    scores: [0, 10, -10],
    clue: 2,
    hint: "留意饮料旁的便签",
  },
  {
    scene: "厨房",
    prompt: "晚餐想吃什么？",
    options: ["随便", "你做什么都不好吃", "一起做你喜欢的"],
    scores: [0, -10, 10],
    clue: 3,
    hint: "找找菜谱",
  },
  {
    scene: "卧室",
    prompt: "我新买的衣服怎么样？",
    options: ["你喜欢就好看，我觉得很适合你", "不知道", "还不如原来的"],
    scores: [10, 0, -10],
    clue: 0,
    hint: "衣架旁有一面镜子",
  },
  {
    scene: "公园",
    prompt: "下雨了，我们怎么办？",
    options: ["你自己回去", "一起撑伞慢慢走", "我没注意"],
    scores: [-10, 10, 0],
    clue: 1,
    hint: "看看长椅边的伞",
  },
  {
    scene: "书店",
    prompt: "你还记得我想看的书吗？",
    options: ["早忘了", "不如买最贵的", "这本我帮你留意很久了"],
    scores: [-10, 0, 10],
    clue: 2,
    hint: "翻翻书架上的标签",
  },
  {
    scene: "电影院",
    prompt: "电影不好看，要继续吗？",
    options: ["可以换个你喜欢的", "不许走", "你别吵"],
    scores: [10, 0, -10],
    clue: 3,
    hint: "看看电影票",
  },
  {
    scene: "餐厅",
    prompt: "我有点不开心，你发现了吗？",
    options: ["有吗", "你怎么这么麻烦", "发现了，愿意跟我聊聊吗"],
    scores: [0, -10, 10],
    clue: 0,
    hint: "餐桌上的纸条",
  },
  {
    scene: "花店",
    prompt: "你觉得哪束花最适合我？",
    options: ["这束是你最喜欢的颜色", "随便哪束", "都不适合你"],
    scores: [10, 0, -10],
    clue: 1,
    hint: "留意花束上的卡片",
  },
  {
    scene: "游乐场",
    prompt: "排队太久了，要不要换一个？",
    options: ["必须排下去", "你决定，我陪你", "你真麻烦"],
    scores: [0, 10, -10],
    clue: 2,
    hint: "找找园区地图",
  },
  {
    scene: "旅行",
    prompt: "我忘带东西了怎么办？",
    options: ["早说过你不靠谱", "一起看看附近哪里可以买", "自己想办法"],
    scores: [-10, 10, 0],
    clue: 3,
    hint: "行李箱边有清单",
  },
  {
    scene: "工作室",
    prompt: "我对今天的工作很沮丧。",
    options: ["别抱怨", "不想听", "你辛苦了，我愿意听"],
    scores: [0, -10, 10],
    clue: 0,
    hint: "桌上的工作记录",
  },
  {
    scene: "超市",
    prompt: "买零食还是买水果？",
    options: ["只买我喜欢的", "我们各选喜欢的", "什么都别买"],
    scores: [-10, 10, 0],
    clue: 1,
    hint: "购物车里的清单",
  },
  {
    scene: "海边",
    prompt: "以后我们还会再来吗？",
    options: ["一定找机会一起再来", "不知道", "和你来没意思"],
    scores: [10, 0, -10],
    clue: 2,
    hint: "沙滩上的相片",
  },
];

export const differenceScenes = [
  "咖啡厅",
  "电影院",
  "游乐场",
  "卧室",
  "海边",
] as const;
export const differenceObjects = [
  { id: 0, x: 16, y: 25, emoji: "☀️" },
  { id: 1, x: 37, y: 23, emoji: "🖼️" },
  { id: 2, x: 68, y: 24, emoji: "🎈" },
  { id: 3, x: 84, y: 31, emoji: "🌸" },
  { id: 4, x: 16, y: 65, emoji: "🪴" },
  { id: 5, x: 35, y: 62, emoji: "☕" },
  { id: 6, x: 58, y: 66, emoji: "🍰" },
  { id: 7, x: 79, y: 63, emoji: "🧸" },
  { id: 8, x: 49, y: 42, emoji: "💗" },
  { id: 9, x: 87, y: 79, emoji: "🎁" },
] as const;

export const ludoTasks: Record<string, string[][]> = {
  pure: [
    ["对视十秒", "说出对方一个优点", "手牵手三十秒"],
    ["第一次约会最开心的瞬间？", "最想和对方去哪里？"],
  ],
  warm: [
    ["拥抱三十秒", "牵手说一句悄悄话", "给对方一个额头吻"],
    ["哪一刻让你心动？", "最喜欢怎样的拥抱？"],
  ],
  fun: [
    ["帮对方按肩一分钟", "模仿一只小动物", "讲一个冷笑话"],
    ["谁更容易迟到？", "你们最搞笑的回忆是什么？"],
  ],
};
