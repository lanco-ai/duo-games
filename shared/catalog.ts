export interface GameMeta {
  devices?: "pair" | "both";
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  intro: string;
  rules: string[];
  tags: string[];
  duration: string;
  net: string;
  gradient: string;
  milestone: string;
}
export const games: GameMeta[] = [
  ...(
    [
      [
        "survival",
        "求生欲·双人版",
        "💌",
        "秘密选好最想听的话，猜猜 TA 的心意",
        [
          "需两台设备，轮流提问和猜心意",
          "双方秘密提交后揭晓，猜错由提问者回应",
          "五题一章，留下 TA 最想听的三句话",
        ],
        "默契",
      ],
      [
        "spot-difference",
        "各看一半",
        "🔍",
        "你看原图，TA 看修改图，把发现说给对方听",
        [
          "第一关同屏教学，之后各看一张图",
          "描述物品的位置和样子，一起点出不同",
          "五个独立场景，点错扣三秒，按剩余时间评星",
        ],
        "合作",
      ],
      [
        "coop-kitchen",
        "双人厨房",
        "🍳",
        "五间厨房，分工传菜与同步做蛋糕",
        [
          "按住方向连续移动，面向工作台按住操作",
          "两人分工传菜、洗盘，完成双人蛋糕",
          "按得分获得星级，解锁五个厨房关卡",
        ],
        "合作",
      ],
      [
        "couple-ludo",
        "心动棋",
        "🎲",
        "选一颗骰子，或让一步，和 TA 一起走到承诺",
        [
          "投两颗选一颗，也可把点数让给 TA",
          "回答、评分、合作挑战、记回忆，再选择岔路",
          "默认两人都到终点通关，也可选择较量",
        ],
        "较量",
      ],
      [
        "hide-seek",
        "房间里的秘密",
        "🔦",
        "听一声吱呀，在小房子里和 TA 斗智",
        [
          "选藏身点并布置干扰，寻找者有六次搜查",
          "躲藏者可换位两次、装死一次，注意房间声音",
          "三轮交换身份，解锁三张地图；同屏交接遮挡",
        ],
        "较量",
      ],
      [
        "couple-jump",
        "双人跳一跳",
        "🧊",
        "看平台距离蓄力，牵手走过四段旅程",
        [
          "按住蓄力，松开跳跃",
          "接力轮流跳，同步模式各自瞄准平台一起松手",
          "三条命闯关，正中加分，通关解锁下一段旅程",
        ],
        "动作",
      ],
    ] as [string, string, string, string, string[], string][]
  ).map(([id, name, emoji, tagline, rules, tag]) => ({
    id,
    name,
    emoji,
    tagline,
    intro: id === "survival" ? "需要两台设备。" + tagline : tagline,
    devices: ["survival", "spot-difference"].includes(id)
      ? ("pair" as const)
      : ("both" as const),
    rules,
    tags: [tag],
    duration: "5–10 分钟",
    net: "一般网络即可",
    gradient: "#FFD3BA,#FF87A5",
    milestone: "M5",
  })),
  {
    id: "talk-cards",
    devices: "both",
    name: "深夜聊天卡",
    emoji: "🌙",
    tagline: "抽一张卡，聊一个平时不会问的问题",
    intro:
      "四套卡组：轻松、走心、未来、小挑战。轮流抽卡，被问到的人认真回答；喜欢的卡可以收藏，想留下的回答可以写进你们的问答本。这里没有输赢，只有更懂彼此。",
    rules: [
      "选好卡组，轮到谁，谁来抽卡",
      "两边同时翻开；问题问对方，小挑战由抽卡人完成",
      "聊完点「下一张」，换对方抽",
    ],
    tags: ["默契"],
    duration: "不限",
    net: "延迟友好",
    gradient: "#3B3F8C,#1E2140",
    milestone: "M0",
  },
  {
    id: "draw-guess",
    devices: "pair",
    name: "你画我猜",
    emoji: "🎨",
    tagline: "你画 TA 猜，画得越抽象笑得越大声",
    intro:
      "两人轮流当画手。猜中了，两个人一起得分。词库里藏着恋爱专属词，也可以写下只有你们才懂的回忆词。",
    rules: [
      "轮流当画手，从三个词里挑一个",
      "80 秒内画出来，TA 来猜",
      "猜中一起得分，越快分越高",
    ],
    tags: ["合作"],
    duration: "10 分钟",
    net: "延迟友好",
    gradient: "#FFB86B,#FF6B6B",
    milestone: "M1",
  },
  {
    id: "mind-meld",
    devices: "pair",
    name: "心有灵犀",
    emoji: "🔮",
    tagline: "同时说一个词，直到你们说出同一个",
    intro:
      "从两个不同的词出发，一起寻找它们的联系。海和猫，也许会在鱼这里相遇。",
    rules: [
      "各自写一个词，同时揭晓",
      "想一个和上轮两个词都有关的词",
      "写出同一个词就成功",
    ],
    tags: ["默契"],
    duration: "5 分钟",
    net: "延迟友好",
    gradient: "#B79BFF,#7B5CFF",
    milestone: "M1",
  },
  {
    id: "know-me",
    devices: "both",
    name: "你懂我吗",
    emoji: "💌",
    tagline: "TA 最爱吃什么？最怕什么？答错了要解释哦",
    intro: "主角如实回答，另一半来猜。猜错了正好聊一聊：原来你是这么想的。",
    rules: [
      "轮流当主角，回答自己的情况",
      "另一半猜，双方都交了再揭晓",
      "看看默契指数与五维雷达；一台设备请选择背靠背模式",
    ],
    tags: ["默契"],
    duration: "8 分钟",
    net: "延迟友好",
    gradient: "#FF9AB5,#FF4D6A",
    milestone: "M1",
  },
  {
    id: "gomoku",
    devices: "pair",
    name: "爱心五子棋",
    emoji: "♟️",
    tagline: "五子连珠，输的人请奶茶",
    intro: "经典五子棋，配上一点小赌约。想悔棋得 TA 同意，让不让就看感情啦。",
    rules: [
      "轮流在棋盘上落子",
      "横、竖、斜五子连成线就赢",
      "可选黑棋三三/四四禁手；悔棋、求和需 TA 同意",
    ],
    tags: ["较量"],
    duration: "10 分钟",
    net: "延迟友好",
    gradient: "#8FD3C7,#2EC4A6",
    milestone: "M1",
  },
  {
    id: "red-thread",
    devices: "pair",
    name: "一线牵",
    emoji: "🧶",
    tagline: "一根红线绑住你们，一个掉下去，另一个得拉住",
    intro:
      "月老的红线把你们绑在一起，向上爬，到鹊桥上相会。喊出来，等一等，拉一把。",
    rules: [
      "左右移动、跳跃，按住「抓」成为锚点",
      "用红线互相拉住，一起向上爬",
      "两人都站上鹊桥就过关",
    ],
    tags: ["合作", "动作"],
    duration: "15 分钟",
    net: "需稳定网络",
    gradient: "#FF7A7A,#D7263D",
    milestone: "M2",
  },
  {
    id: "my-eyes",
    devices: "pair",
    name: "你是我的眼",
    emoji: "🔦",
    tagline: "一个看得见地图，一个走在迷雾里",
    intro: "一个看地图指挥，一个在迷雾中前进。放心把方向交给 TA。",
    rules: [
      "引路人看全图，行者看附近",
      "靠信号和语音配合，拿钥匙找出口",
      "每关可画一次路线，TA 能看两秒；过关交换身份",
    ],
    tags: ["合作"],
    duration: "10 分钟",
    net: "延迟友好",
    gradient: "#5A6378,#2B2F3F",
    milestone: "M3",
  },
  {
    id: "heart-bounce",
    devices: "pair",
    name: "颠颠爱心",
    emoji: "💗",
    tagline: "轮流把爱心颠起来，别让它落地",
    intro: "同一个人不能连续接两次。把这一颗小爱心，好好交到 TA 手里。",
    rules: [
      "爱心亮谁的颜色，就轮到谁接",
      "移动小托盘，轮流把爱心颠起来",
      "每 15 连击可吃星星加宽托盘；10/25/50 连击评星",
    ],
    tags: ["合作", "动作"],
    duration: "5 分钟",
    net: "一般网络即可",
    gradient: "#FFD36E,#FF9A3C",
    milestone: "M3",
  },
  {
    id: "puck-sling",
    name: "桌上弹射冰球",
    emoji: "🏒",
    tagline: "把冰球弹过中间的小门，先清空自己半场的人赢",
    intro:
      "一张木头小球桌，中间一道矮墙只留一个小门。两个人同时开弹，不分回合：你弹过去，TA 弹回来，手快更要手准。",
    rules: [
      "按住自己半场的冰球，往后拉再松手",
      "冰球穿过中间小门，就到了 TA 的半场",
      "先清空自己半场获胜；时间到时剩得少的赢",
    ],
    tags: ["较量", "动作"],
    duration: "3 分钟",
    net: "一般网络即可",
    gradient: "#F3D29B,#B97A43",
    milestone: "M6",
  },
  {
    id: "puzzle-us",
    devices: "pair",
    name: "拼出我们",
    emoji: "🧩",
    tagline: "用你们的合照做拼图，一起拼回来",
    intro: "从一张合照出发，两个人在同一张桌子上，把记忆一点点拼回来。",
    rules: [
      "选图片和拼图块数",
      "一起拖动拼图块，靠近就会吸附",
      "完成的照片留在你们的画廊",
    ],
    tags: ["合作"],
    duration: "15 分钟",
    net: "延迟友好",
    gradient: "#8EC5FF,#4D7CFF",
    milestone: "M4",
  },
  {
    id: "heartbeat",
    devices: "pair",
    name: "心跳节拍",
    emoji: "🎶",
    tagline: "跟着节拍一起点，你们的心跳同步了吗",
    intro:
      "在各自的节奏里，寻找一起合拍的瞬间。坐在一起时，记得只开一台的声音。",
    rules: [
      "先做一次简单的节拍校准",
      "跟着音乐点击双轨，金色尾巴按住到结束",
      "箭头接力交给 TA，副歌一起点亮爱心",
    ],
    tags: ["默契", "动作"],
    duration: "3 分钟",
    net: "延迟友好",
    gradient: "#FF6FB5,#9B3CFF",
    milestone: "M4",
  },
];

export const gameGroups = ["聊天", "合作", "较量", "动作"] as const;
export function gameGroup(game: GameMeta) {
  if (["talk-cards", "mind-meld", "know-me", "survival"].includes(game.id))
    return "聊天";
  if (["heartbeat", "couple-jump", "heart-bounce"].includes(game.id))
    return "动作";
  if (["gomoku", "couple-ludo", "hide-seek"].includes(game.id)) return "较量";
  return "合作";
}
