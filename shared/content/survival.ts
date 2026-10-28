export const survivalChapters = [
  "暧昧期",
  "热恋期",
  "磨合期",
  "见家长",
  "纪念日",
];
export interface SurvivalQuestion {
  id: string;
  chapter: number;
  scene: string;
  prompt: string;
  options: string[];
  objects: { name: string; icon: string }[];
}
export const survivalQuestions: SurvivalQuestion[] = [
  {
    id: "survival-0-0",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "第一次见面你最想注意什么？",
    options: [
      "聊聊最近喜欢的事",
      "先说一个好笑的经历",
      "慢慢介绍彼此",
      "一起找共同爱好",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-0-1",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "周末空出半天，你最期待我们做什么？",
    options: [
      "去逛一家小书店",
      "在公园慢慢走",
      "一起试一家小店",
      "看一场喜欢的电影",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-0-2",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "收到我的消息时你希望看到什么？",
    options: [
      "今天发生的小事",
      "一张随手拍的照片",
      "一句想起我的话",
      "下次见面的小计划",
    ],
    objects: [
      {
        name: "手机",
        icon: "📱",
      },
      {
        name: "时钟",
        icon: "🕰️",
      },
      {
        name: "便签",
        icon: "📝",
      },
      {
        name: "台灯",
        icon: "💡",
      },
    ],
  },
  {
    id: "survival-0-3",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "一起散步时，你想聊什么？",
    options: ["最近的兴趣", "小时候的故事", "想去的地方", "沿路看到的风景"],
    objects: [
      {
        name: "雨伞",
        icon: "☂️",
      },
      {
        name: "地图",
        icon: "🗺️",
      },
      {
        name: "背包",
        icon: "🎒",
      },
      {
        name: "车票",
        icon: "🎫",
      },
    ],
  },
  {
    id: "survival-0-4",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "你想用什么方式说晚安？",
    options: [
      "一句简单的晚安",
      "一段轻声的语音",
      "一首睡前的歌",
      "约好明天再聊",
    ],
    objects: [
      {
        name: "手机",
        icon: "📱",
      },
      {
        name: "时钟",
        icon: "🕰️",
      },
      {
        name: "便签",
        icon: "📝",
      },
      {
        name: "台灯",
        icon: "💡",
      },
    ],
  },
  {
    id: "survival-0-5",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "我紧张的时候，你希望我怎样开口？",
    options: ["我有一点紧张", "可以慢慢说吗", "我想先听你说", "我们边走边聊吧"],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-0-6",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "下次见面，你想选在哪里？",
    options: [
      "安静的小咖啡店",
      "有树荫的公园",
      "热闹的夜市",
      "能一起看书的地方",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-0-7",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "我送一个小礼物，你最期待什么？",
    options: [
      "一本你选的书",
      "一张手写卡片",
      "一件实用小物",
      "一份亲手做的小点心",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-0-8",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "突然下雨，你希望我做什么？",
    options: [
      "把伞往你那边偏",
      "找个屋檐先等雨",
      "一起买把喜欢的伞",
      "笑着聊聊这场雨",
    ],
    objects: [
      {
        name: "雨伞",
        icon: "☂️",
      },
      {
        name: "地图",
        icon: "🗺️",
      },
      {
        name: "背包",
        icon: "🎒",
      },
      {
        name: "车票",
        icon: "🎫",
      },
    ],
  },
  {
    id: "survival-0-9",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "选一首属于我们的歌，你看重什么？",
    options: [
      "第一次听时的感觉",
      "能想起彼此的歌词",
      "一起哼起来很轻松",
      "适合走路的节奏",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-0-10",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "我约你吃饭，你更喜欢怎样安排？",
    options: [
      "提前选好餐厅",
      "列几个选择一起挑",
      "临时遇见喜欢的店",
      "一起去买菜做饭",
    ],
    objects: [
      {
        name: "菜谱",
        icon: "📖",
      },
      {
        name: "餐盘",
        icon: "🍽️",
      },
      {
        name: "番茄",
        icon: "🍅",
      },
      {
        name: "菜单",
        icon: "📋",
      },
    ],
  },
  {
    id: "survival-0-11",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "你觉得我今天哪里不一样？",
    options: [
      "换了新发型",
      "今天特别有精神",
      "穿了我送的那件",
      "没变一直这么好看",
    ],
    objects: [
      {
        name: "镜子",
        icon: "🪞",
      },
      {
        name: "衣架",
        icon: "👚",
      },
      {
        name: "梳子",
        icon: "🪮",
      },
      {
        name: "相机",
        icon: "📷",
      },
    ],
  },
  {
    id: "survival-0-12",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "一起拍照时，你希望我说什么？",
    options: ["提醒我看镜头", "逗我笑起来", "拍下自然的瞬间", "夸我今天很上镜"],
    objects: [
      {
        name: "镜子",
        icon: "🪞",
      },
      {
        name: "衣架",
        icon: "👚",
      },
      {
        name: "梳子",
        icon: "🪮",
      },
      {
        name: "相机",
        icon: "📷",
      },
    ],
  },
  {
    id: "survival-0-13",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "晚一点才回消息，你想听怎样的解释？",
    options: [
      "刚才在专心忙事情",
      "我想认真想好再回",
      "我现在有空陪你了",
      "下次忙之前先告诉你",
    ],
    objects: [
      {
        name: "手机",
        icon: "📱",
      },
      {
        name: "时钟",
        icon: "🕰️",
      },
      {
        name: "便签",
        icon: "📝",
      },
      {
        name: "台灯",
        icon: "💡",
      },
    ],
  },
  {
    id: "survival-0-14",
    chapter: 0,
    scene: "暧昧期 · 我们的小客厅",
    prompt: "第一次分别时，你想听什么？",
    options: ["各看各的书", "听同一张歌单", "靠着看看窗外", "一起做手边的小事"],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-0",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "下班之后你最想怎样见面？",
    options: [
      "一起散步再回家",
      "先吃一顿热饭",
      "安静抱一小会儿",
      "各自放松后再聊",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-1",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "你忙了一天希望我怎样照顾你？",
    options: [
      "替我准备点吃的",
      "听我说完今天的事",
      "一起收拾一点家务",
      "让我先睡一小会儿",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-2",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "周末早晨你最想听什么？",
    options: [
      "早呀今天慢慢来",
      "早餐想吃什么",
      "我们出去走走吗",
      "再赖床五分钟吧",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-3",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "一起买菜时你最希望怎样分工？",
    options: [
      "我选菜你提袋子",
      "一起决定今晚菜单",
      "各挑一样喜欢的菜",
      "你算预算我找食材",
    ],
    objects: [
      {
        name: "菜谱",
        icon: "📖",
      },
      {
        name: "餐盘",
        icon: "🍽️",
      },
      {
        name: "番茄",
        icon: "🍅",
      },
      {
        name: "菜单",
        icon: "📋",
      },
    ],
  },
  {
    id: "survival-1-4",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "计划短途旅行你先想到什么？",
    options: [
      "住得舒服一点",
      "有好吃的小店",
      "能看喜欢的风景",
      "行程别排得太满",
    ],
    objects: [
      {
        name: "雨伞",
        icon: "☂️",
      },
      {
        name: "地图",
        icon: "🗺️",
      },
      {
        name: "背包",
        icon: "🎒",
      },
      {
        name: "车票",
        icon: "🎫",
      },
    ],
  },
  {
    id: "survival-1-5",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "你想如何庆祝一个普通的好日子？",
    options: [
      "拍一张日常合照",
      "做一顿简单的饭",
      "认真互相夸一句",
      "留时间一起散步",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-6",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "我突然有一天假，你想怎么安排？",
    options: [
      "补上想去的小店",
      "在家看完那部电影",
      "去附近随意走走",
      "一起把小计划实现",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-7",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "看电影之前你希望我准备什么？",
    options: [
      "准备一杯水",
      "选好喜欢的位置",
      "带上你想吃的零食",
      "先把时间安排好",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-8",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "发现你不舒服时你希望我做什么？",
    options: [
      "先问你哪里难受",
      "把水放到手边",
      "陪你安排休息",
      "按你的需要去帮忙",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-9",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "你想把哪种小事变成我们的习惯？",
    options: [
      "睡前聊十分钟",
      "周末一起采购",
      "每周散步一次",
      "记下一件开心的事",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-10",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "一起收拾房间你更喜欢怎样配合？",
    options: [
      "一人负责一个区域",
      "边听歌边慢慢做",
      "先一起整理最乱的地方",
      "轮流决定怎么摆放",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-11",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "我做饭失败了你想怎么度过今晚？",
    options: [
      "换一道容易做的菜",
      "一起点喜欢的外卖",
      "把失败变成笑话",
      "你切菜我来掌勺",
    ],
    objects: [
      {
        name: "菜谱",
        icon: "📖",
      },
      {
        name: "餐盘",
        icon: "🍽️",
      },
      {
        name: "番茄",
        icon: "🍅",
      },
      {
        name: "菜单",
        icon: "📋",
      },
    ],
  },
  {
    id: "survival-1-12",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "礼物送到时你最想听什么？",
    options: [
      "看见它就想到了你",
      "谢谢你记住我的喜好",
      "我们一起拆开吧",
      "以后也想送你惊喜",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-13",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "今天很想你，你希望我怎样表达？",
    options: [
      "认真说一句想你",
      "发来此刻的照片",
      "约一个见面的时间",
      "陪我听一首歌",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-1-14",
    chapter: 1,
    scene: "热恋期 · 我们的小客厅",
    prompt: "两个人安静相处你最喜欢什么？",
    options: [
      "各做各的但待在一起",
      "分享一条有趣的发现",
      "靠着看一会儿电视",
      "一起整理旧照片",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-0",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "意见不同的时候你想先做什么？",
    options: [
      "先把各自想法讲清",
      "暂停一下喝口水",
      "找一个都能接受的办法",
      "先确认我们在讨论同件事",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-1",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "你生气的时候最需要我怎么做？",
    options: [
      "先听我把话说完",
      "给我一点安静时间",
      "抱抱再慢慢说",
      "问我现在最需要什么",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-2",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "我忘记一件约定你希望怎么补救？",
    options: [
      "说清忘记的原因",
      "重新约一个具体时间",
      "认真道歉并记下来",
      "问问我怎样补救更好",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-3",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "临时改变计划你更在意什么？",
    options: [
      "早点告诉我变动",
      "解释原因让我理解",
      "一起安排替代方案",
      "确认我的时间也被尊重",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-4",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "预算不一致时你希望怎样讨论？",
    options: [
      "先列出必须花的钱",
      "说说各自更在意什么",
      "留一部分给双方自由支配",
      "约个轻松时间一起算",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-5",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "你不想说话时你需要什么？",
    options: [
      "陪着但先不追问",
      "让我独处一会儿",
      "发一句随时愿意听",
      "帮我处理眼前的小事",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-6",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "误会发生后你希望怎样开始解释？",
    options: [
      "先复述你理解的意思",
      "说清自己的感受",
      "一起核对发生了什么",
      "承认我可能有理解偏差",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-7",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "我打断你说话后你希望听到什么？",
    options: [
      "对不起请继续说",
      "刚才那一点我想确认",
      "我先听你讲完整",
      "你说的这件事很重要",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-8",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "你想怎样商量各自的私人时间？",
    options: [
      "先说各自需要的时长",
      "约好固定的独处时间",
      "有变化时提前沟通",
      "同时留出相处的时间",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-9",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "争执之后第一顿饭你希望怎样吃？",
    options: [
      "做一道熟悉的家常菜",
      "一起去常去的小店",
      "安静吃完再继续聊",
      "边做饭边恢复轻松",
    ],
    objects: [
      {
        name: "菜谱",
        icon: "📖",
      },
      {
        name: "餐盘",
        icon: "🍽️",
      },
      {
        name: "番茄",
        icon: "🍅",
      },
      {
        name: "菜单",
        icon: "📋",
      },
    ],
  },
  {
    id: "survival-2-10",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "两个人做事速度不同该怎样配合？",
    options: [
      "分工做擅长的部分",
      "先约定完成的时间",
      "快的人问问要不要帮忙",
      "互相说清现在的进度",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-11",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "你觉得委屈时最希望我注意什么？",
    options: [
      "我的语气变轻了",
      "我重复提起同一件事",
      "我开始不太想说话",
      "我在等你主动问一句",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-12",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "我没有听清你的请求你希望我怎么回应？",
    options: [
      "请你再说一次好吗",
      "我听到的是这样对吗",
      "我先把手里的事放下",
      "这件事对你很重要吗",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-13",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "遇到压力时你希望怎样分担？",
    options: [
      "问清哪件事最急",
      "陪我列一张小清单",
      "先听我讲完不急着建议",
      "接手一件你熟悉的事",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-2-14",
    chapter: 2,
    scene: "磨合期 · 我们的小客厅",
    prompt: "和好之后你最想我们记住什么？",
    options: [
      "说出下次的具体做法",
      "记住彼此的底线",
      "也记住刚才的善意",
      "提醒我们仍是同一队",
    ],
    objects: [
      {
        name: "沙发",
        icon: "🛋️",
      },
      {
        name: "留言卡",
        icon: "💌",
      },
      {
        name: "相片",
        icon: "🖼️",
      },
      {
        name: "日历",
        icon: "📅",
      },
    ],
  },
  {
    id: "survival-3-0",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "第一次去你家我应该先关心什么？",
    options: [
      "家人的称呼习惯",
      "家里喜欢的饭菜",
      "需要注意的小礼节",
      "先了解当天的安排",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-1",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "饭桌上聊到未来时你希望怎么回答？",
    options: [
      "我们有在认真商量",
      "先听听家人的想法",
      "把已经确定的说清楚",
      "没想好的就诚实说明",
    ],
    objects: [
      {
        name: "菜谱",
        icon: "📖",
      },
      {
        name: "餐盘",
        icon: "🍽️",
      },
      {
        name: "番茄",
        icon: "🍅",
      },
      {
        name: "菜单",
        icon: "📋",
      },
    ],
  },
  {
    id: "survival-3-2",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "给长辈选礼物你更看重什么？",
    options: [
      "是否适合他们使用",
      "能否体现平时的关心",
      "有没有特别喜欢的口味",
      "一份不过分隆重的心意",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-3",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "家人问起我们怎么认识你想怎么讲？",
    options: [
      "讲一个自然的小细节",
      "说说彼此第一印象",
      "分享共同的兴趣",
      "用轻松的方式慢慢讲",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-4",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "你紧张时希望我用什么暗号？",
    options: [
      "捏一下我的手",
      "看我一眼就懂",
      "帮我接一句话",
      "找机会一起去倒杯水",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-5",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "行程安排不同你希望怎样协调？",
    options: [
      "先照顾长辈的节奏",
      "提前说明我们的时间",
      "一起找中间方案",
      "把变动早点告诉大家",
    ],
    objects: [
      {
        name: "雨伞",
        icon: "☂️",
      },
      {
        name: "地图",
        icon: "🗺️",
      },
      {
        name: "背包",
        icon: "🎒",
      },
      {
        name: "车票",
        icon: "🎫",
      },
    ],
  },
  {
    id: "survival-3-6",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "家人夸奖我时你希望我怎样回应？",
    options: [
      "谢谢你们的认可",
      "也夸夸你平时的照顾",
      "讲一件一起做好的小事",
      "笑着说还在一起学习",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-7",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "家人提出建议时你希望我怎样接话？",
    options: [
      "先认真听完整",
      "问清建议背后的担心",
      "说说我们已经做的准备",
      "回去后两人再商量",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-8",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "吃饭口味不同时你希望怎样安排？",
    options: [
      "提前问问饮食偏好",
      "大家各选一道喜欢的菜",
      "多准备一点清淡口味",
      "请家人推荐拿手菜",
    ],
    objects: [
      {
        name: "菜谱",
        icon: "📖",
      },
      {
        name: "餐盘",
        icon: "🍽️",
      },
      {
        name: "番茄",
        icon: "🍅",
      },
      {
        name: "菜单",
        icon: "📋",
      },
    ],
  },
  {
    id: "survival-3-9",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "你想提前告诉我哪件家庭小事？",
    options: [
      "称呼背后的小故事",
      "家人常说的玩笑",
      "饭桌上的小习惯",
      "一张重要的家庭照片",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-10",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "临走前你希望我们一起做什么？",
    options: [
      "一起收拾一下餐桌",
      "认真向家人道别",
      "约好下次见面的时间",
      "确认大家安全到家",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-11",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "第一次见长辈你最期待怎样的陪伴？",
    options: [
      "在旁边自然接话",
      "时不时问问我的感觉",
      "和我一起准备小礼物",
      "让我知道可以依靠你",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-12",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "家人聊起旧照片你希望我怎么参与？",
    options: [
      "认真听照片的故事",
      "夸夸小时候的你",
      "分享一件自己的童年趣事",
      "问问当时的生活细节",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-13",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "碰到尴尬问题你希望我如何配合？",
    options: [
      "自然把话题接过去",
      "坦诚说我们还在商量",
      "用轻松的玩笑缓和",
      "先照顾一下我的感受",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-3-14",
    chapter: 3,
    scene: "见家长 · 我们的小客厅",
    prompt: "回家之后你最想和我聊什么？",
    options: [
      "今天最开心的瞬间",
      "有没有让我紧张的地方",
      "哪些安排下次可以更好",
      "谢谢你今天一直陪着我",
    ],
    objects: [
      {
        name: "茶杯",
        icon: "🍵",
      },
      {
        name: "合照",
        icon: "🖼️",
      },
      {
        name: "礼盒",
        icon: "🎁",
      },
      {
        name: "水果盘",
        icon: "🍊",
      },
    ],
  },
  {
    id: "survival-4-0",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "今年纪念日你最想留下什么？",
    options: [
      "一张能看出开心的照片",
      "一封写给未来的信",
      "一段共同完成的小视频",
      "一次认真回顾的聊天",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-1",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "回看旧照片时你最想听哪句话？",
    options: [
      "我还记得当时的心情",
      "谢谢你一直在身边",
      "原来我们一起走了这么远",
      "下次还想一起去那里",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-2",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "你希望我们十年后还保留什么？",
    options: [
      "每晚认真说晚安",
      "对小事保持好奇",
      "争执后仍愿意沟通",
      "给彼此留一点惊喜",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-3",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "如果只写一句纪念卡你期待什么？",
    options: [
      "我记得你做过的小事",
      "很高兴又一起走过一年",
      "下一个愿望我们一起实现",
      "谢谢你让我成为更好的自己",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-4",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "今年我们一起克服了什么？",
    options: [
      "一件拖了很久的小事",
      "一次难忘的生活变化",
      "一段忙碌却互相支持的日子",
      "一个曾经有点怕的决定",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-5",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "你想怎样重温第一次约会？",
    options: [
      "重走当时的路",
      "再吃一次那道菜",
      "穿着舒服的衣服随意逛",
      "把当年的照片再拍一次",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-6",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "最平凡的日子里你希望怎样被爱？",
    options: [
      "想说话时被认真听见",
      "忙起来也有人记得吃饭",
      "有人愿意分担家务",
      "偶尔收到一句直接的喜欢",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-7",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "你希望下一段旅程从哪里开始？",
    options: [
      "一个没去过的小地方",
      "一件想学的新技能",
      "一次更慢的日常旅行",
      "一个共同的小目标",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-8",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "你最想向未来的我们许什么愿？",
    options: [
      "保持健康一起散步",
      "遇到难题仍好好说话",
      "多记得彼此的小愿望",
      "留时间做真正喜欢的事",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-9",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "想给过去的我们说一句什么？",
    options: [
      "别太紧张慢慢来",
      "谢谢当时没有放弃",
      "你们会创造很多好回忆",
      "再多拍几张日常照片",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-10",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "你希望怎样记录共同成长？",
    options: [
      "每月写下一件进步",
      "每年重拍一张合照",
      "留下一本共同的手账",
      "为彼此完成的小事庆祝",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-11",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "关于陪伴你最珍惜哪个细节？",
    options: [
      "有人记得我的小习惯",
      "一句不用解释也懂的话",
      "一起忙完后的一杯热茶",
      "需要帮助时你真的在",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-12",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "你最想让我记住你的哪件小心愿？",
    options: [
      "想去却还没去的小地方",
      "一直惦记的一道菜",
      "很久没做的小爱好",
      "想和你一起实现的计划",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-13",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "忙碌的一年后你想怎样庆祝？",
    options: [
      "在家做一顿喜欢的饭",
      "找一天只属于我们",
      "出门看一场演出",
      "把这一年的照片整理好",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
  {
    id: "survival-4-14",
    chapter: 4,
    scene: "纪念日 · 我们的小客厅",
    prompt: "我们一起点蜡烛时你最想听什么？",
    options: [
      "下一个愿望一起实现",
      "谢谢这一年的照顾",
      "以后也继续认真听你说",
      "不着急我们还有很多明天",
    ],
    objects: [
      {
        name: "蛋糕",
        icon: "🎂",
      },
      {
        name: "相册",
        icon: "📔",
      },
      {
        name: "纪念卡",
        icon: "💌",
      },
      {
        name: "蜡烛",
        icon: "🕯️",
      },
    ],
  },
];
