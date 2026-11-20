// 潮汐棋的美术：棋子和牌面。画法和半途岛一致（深棕描边、平涂两层明暗）。
// 棋子带“得分状态”：灯在干地上亮、被淹熄灭；珊瑚在水下鲜亮、离水发灰。
import type { JSX } from "preact";
import { INK } from "./critter";
import type { Card, PieceKind } from "../../../shared/games/tide/rules";

const S = {
  stroke: INK,
  "stroke-width": 2.8,
  "stroke-linejoin": "round",
  "stroke-linecap": "round",
} as const;

const LAMP = (lit: boolean) => (
  <g>
    {lit && <circle cx="32" cy="32" r="24" fill="#FFE27A" opacity=".55" />}
    <path d="M24 16h16l-2-6H26z" fill="#8A5A31" {...S} />
    <rect
      x="20"
      y="16"
      width="24"
      height="30"
      rx="9"
      fill={lit ? "#FFD23F" : "#CBBFA6"}
      {...S}
    />
    <path
      d="M27 22v18M37 22v18"
      stroke={lit ? "#FFF1B3" : "#E6DCC8"}
      stroke-width="3"
      stroke-linecap="round"
    />
    <path d="M22 46h20v6H22z" fill="#8A5A31" {...S} />
    {lit && <path d="M32 28c-3 3-3 7 0 9 3-2 3-6 0-9z" fill="#FF8A3D" />}
  </g>
);
const CORAL = (wet: boolean) => (
  <g>
    <path
      d="M32 54V32M32 46L20 36V24M20 36l-6-3M32 40l12-10V20M44 30l6-3M32 32l-5-9"
      {...S}
      stroke-width="8"
      fill="none"
    />
    <path
      d="M32 54V32M32 46L20 36V24M20 36l-6-3M32 40l12-10V20M44 30l6-3M32 32l-5-9"
      stroke={wet ? "#FF6F91" : "#D8B9B0"}
      stroke-width="4"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    {wet && (
      <>
        <circle
          cx="50"
          cy="16"
          r="3"
          fill="#D9F6FF"
          {...S}
          stroke-width="1.8"
        />
        <circle
          cx="14"
          cy="22"
          r="2.2"
          fill="#D9F6FF"
          {...S}
          stroke-width="1.6"
        />
      </>
    )}
    <path d="M20 54h24" {...S} />
  </g>
);
const STONE = (
  <g>
    <path
      d="M10 50c0-14 9-24 22-24s22 10 22 24c0 3-2 5-5 5H15c-3 0-5-2-5-5z"
      fill="#B9B3A8"
      {...S}
    />
    <path
      d="M20 40c4-3 9-3 12 0M38 44c3-2 6-2 8 0"
      {...S}
      fill="none"
      stroke-width="2.2"
    />
    <path
      d="M16 54h32"
      stroke="#8C867B"
      stroke-width="3"
      stroke-linecap="round"
    />
  </g>
);

/** 棋盘上的棋子；active 表示这一格这一回合会得分 */
export function PieceArt({
  kind,
  active = true,
}: {
  kind: PieceKind;
  active?: boolean;
}) {
  return (
    <svg viewBox="0 0 64 64" class="piece-art" aria-hidden="true">
      {kind === "lamp"
        ? LAMP(active)
        : kind === "coral"
          ? CORAL(active)
          : STONE}
    </svg>
  );
}

const CARD: Record<Card, JSX.Element> = {
  lamp: LAMP(true),
  coral: CORAL(true),
  stone: STONE,
  boat: (
    <g>
      <path d="M6 38h52L46 54H18z" fill="#FFFDF6" {...S} />
      <path d="M18 38L32 12l14 26" fill="#F3E9D2" {...S} />
      <path d="M32 12v26" {...S} stroke-width="2" />
      <path
        d="M40 22l10-4M44 30l10-2"
        {...S}
        stroke-width="2.4"
        stroke="#2F8FCF"
      />
    </g>
  ),
  net: (
    <g>
      <path d="M10 14h44l-6 40H16z" fill="#F3E3C3" {...S} />
      <path
        d="M12 26h40M14 38h36M22 14l4 40M32 14v40M42 14l-4 40"
        stroke={INK}
        stroke-width="2"
      />
      <circle cx="10" cy="14" r="3.4" fill="#FF6B6B" {...S} stroke-width="2" />
      <circle cx="54" cy="14" r="3.4" fill="#FF6B6B" {...S} stroke-width="2" />
    </g>
  ),
  wave: (
    <g>
      <path
        d="M6 44c6-16 22-30 38-28 8 1 12 8 8 14-4-6-12-6-14 2 8-2 14 4 12 12H6z"
        fill="#5AB4E6"
        {...S}
      />
      <path
        d="M14 42c6-10 14-16 24-18"
        stroke="#D9F2FF"
        stroke-width="3.4"
        fill="none"
        stroke-linecap="round"
      />
      <path
        d="M4 54c6-4 10-4 16 0s10 4 16 0 10-4 16 0 8 4 10 2"
        {...S}
        stroke="#2F8FCF"
        fill="none"
        stroke-width="3.4"
      />
    </g>
  ),
};

/** 牌面插画 */
export function CardArt({ card }: { card: Card }) {
  return (
    <svg viewBox="0 0 64 64" class="card-art" aria-hidden="true">
      {CARD[card]}
    </svg>
  );
}

/** 牌背：出了牌、还没揭晓时显示 */
export function CardBack() {
  return (
    <svg viewBox="0 0 64 88" class="card-back" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="58"
        height="82"
        rx="10"
        fill="#2F8FCF"
        {...S}
        stroke-width="3"
      />
      <rect
        x="9"
        y="9"
        width="46"
        height="70"
        rx="7"
        fill="none"
        stroke="#9BDDF7"
        stroke-width="2.4"
      />
      <path
        d="M14 50c6-6 12-6 18 0s12 6 18 0M14 38c6-6 12-6 18 0s12 6 18 0"
        stroke="#D9F2FF"
        stroke-width="3"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
  );
}

/** 大厅入口卡片上的小棋盘 */
export function TideMini() {
  return (
    <svg viewBox="0 0 64 64" class="ui-art" aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="10" fill="#F3D9A4" {...S} />
      <path d="M8 26h48v12H8z" fill="#5AB4E6" />
      <path
        d="M8 26c8-4 16 4 24 0s16-4 24 0"
        stroke="#D9F2FF"
        stroke-width="2.6"
        fill="none"
        stroke-linecap="round"
      />
      <rect x="6" y="6" width="52" height="52" rx="10" fill="none" {...S} />
      <g transform="translate(14 38) scale(.28)">{LAMP(true)}</g>
      <g transform="translate(32 8) scale(.28)">{CORAL(true)}</g>
    </svg>
  );
}
