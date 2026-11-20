// 半途岛的美术：作物三个生长阶段、加工品、建筑和界面图标。
// 统一画法：64×64 画布，深棕描边 2.6–3，圆角线帽，平涂两层明暗，和小动物同一套语言。
import type { JSX } from "preact";
import { INK } from "./critter";
import type { Crop, Item } from "../../../shared/island/rules";

const S = {
  stroke: INK,
  "stroke-width": 2.8,
  "stroke-linejoin": "round",
  "stroke-linecap": "round",
} as const;

function Svg(p: { children: JSX.Element | JSX.Element[]; class?: string }) {
  return (
    <svg viewBox="0 0 64 64" class={p.class} aria-hidden="true">
      {p.children}
    </svg>
  );
}

/** 发芽：所有作物共用 */
const Sprout = (tint: string) => (
  <g>
    <path d="M32 58V44" {...S} fill="none" />
    <path d="M32 47c-8 0-12-5-12-10 7 0 12 4 12 10z" fill={tint} {...S} />
    <path d="M32 44c6-1 11-6 10-12-7 1-11 6-10 12z" fill={tint} {...S} />
  </g>
);

const CROP_ART: Record<Crop, [JSX.Element, JSX.Element]> = {
  // [生长中, 成熟]
  berry: [
    <g>
      <path d="M14 58c-4-12 4-24 18-24s22 12 18 24z" fill="#5BAE4A" {...S} />
      <path d="M22 44c4-3 8-3 10 0M36 42c4-2 8-1 10 2" {...S} fill="none" />
    </g>,
    <g>
      <path d="M10 58c-5-16 6-30 22-30s27 14 22 30z" fill="#4E9E3F" {...S} />
      {[
        [20, 44],
        [31, 38],
        [42, 45],
        [26, 52],
        [38, 53],
        [47, 36],
        [16, 34],
      ].map(([x, y]) => (
        <g>
          <circle
            cx={x}
            cy={y}
            r="5.2"
            fill="#5A6BE0"
            {...S}
            stroke-width="2.4"
          />
          <circle cx={x - 1.6} cy={y - 1.8} r="1.4" fill="#C9D2FF" />
        </g>
      ))}
    </g>,
  ],
  wheat: [
    <g>
      {[20, 28, 36, 44].map((x, i) => (
        <path
          d={`M${x} 58C${x - 2} 48 ${x + 1} 40 ${x + (i % 2 ? 3 : -3)} 30`}
          {...S}
          stroke="#3F8F2E"
          stroke-width="4"
          fill="none"
        />
      ))}
    </g>,
    <g>
      {[16, 25, 34, 43, 50].map((x, i) => (
        <g>
          <path
            d={`M${x} 58C${x - 1} 46 ${x} 36 ${x + (i % 2 ? 2 : -2)} 26`}
            {...S}
            stroke="#B98A1E"
            stroke-width="3"
            fill="none"
          />
          <path
            d={`M${x + (i % 2 ? 2 : -2)} 10c5 4 5 12 0 18-5-6-5-14 0-18z`}
            fill="#F4C54A"
            {...S}
            stroke-width="2.4"
          />
        </g>
      ))}
    </g>,
  ],
  kelp: [
    <g>
      <path
        d="M26 58c-6-8 6-12 0-20M38 58c6-8-6-12 0-18"
        {...S}
        stroke="#2F9A7C"
        stroke-width="5"
        fill="none"
      />
    </g>,
    <g>
      <path
        d="M20 58c-8-10 8-14 0-26 6-4 2-12 6-18M32 58c6-10-6-16 2-28M44 58c8-10-8-16 0-26"
        {...S}
        stroke="#1F8A6C"
        stroke-width="5.5"
        fill="none"
      />
      <path
        d="M20 58c-8-10 8-14 0-26 6-4 2-12 6-18M32 58c6-10-6-16 2-28M44 58c8-10-8-16 0-26"
        stroke="#4CC3A0"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
      />
      <circle cx="50" cy="20" r="3" fill="#D9F6FF" {...S} stroke-width="2" />
      <circle
        cx="12"
        cy="28"
        r="2.2"
        fill="#D9F6FF"
        {...S}
        stroke-width="1.8"
      />
    </g>,
  ],
  cotton: [
    <g>
      <path
        d="M32 58V30M32 42l-10-8M32 38l10-9"
        {...S}
        stroke="#5E8A34"
        stroke-width="3.4"
        fill="none"
      />
      {[
        [22, 32],
        [42, 28],
        [32, 26],
      ].map(([x, y]) => (
        <circle
          cx={x}
          cy={y}
          r="4.5"
          fill="#8BC34A"
          {...S}
          stroke-width="2.4"
        />
      ))}
    </g>,
    <g>
      <path
        d="M32 58V30M32 44l-12-10M32 40l12-11"
        {...S}
        stroke="#6B7A3A"
        stroke-width="3.4"
        fill="none"
      />
      {[
        [19, 30],
        [45, 27],
        [32, 20],
      ].map(([x, y]) => (
        <path
          d={`M${x - 9} ${y + 2}c-2-7 5-11 9-7 2-6 11-5 11 2 6 0 7 8 1 10-2 5-10 5-12 1-5 3-11 0-9-6z`}
          fill="#FFFFFF"
          {...S}
          stroke-width="2.4"
        />
      ))}
    </g>,
  ],
  stoneflower: [
    <g>
      <path d="M10 58c-2-12 8-20 22-20s24 8 22 20z" fill="#B9B3A8" {...S} />
      <path d="M20 46c4-2 8-2 10 0" {...S} fill="none" stroke-width="2" />
      <path d="M38 38c0-6 4-8 6-8" {...S} stroke="#5E8A34" fill="none" />
      <circle
        cx="45"
        cy="29"
        r="3.4"
        fill="#F7A8C4"
        {...S}
        stroke-width="2.2"
      />
    </g>,
    <g>
      <path d="M8 58c-2-14 9-22 24-22s26 8 24 22z" fill="#A9A397" {...S} />
      <path
        d="M16 46c4-3 9-3 12 0M38 48c3-2 7-2 9 0"
        {...S}
        fill="none"
        stroke-width="2"
      />
      {[
        [22, 30, "#F48FB1"],
        [38, 24, "#F06292"],
        [48, 34, "#F8BBD0"],
      ].map(([x, y, c]) => (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              cx={x as number}
              cy={(y as number) - 5}
              rx="3.6"
              ry="5"
              fill={c as string}
              {...S}
              stroke-width="2"
              transform={`rotate(${a} ${x} ${y})`}
            />
          ))}
          <circle
            cx={x as number}
            cy={y as number}
            r="2.6"
            fill="#FFE066"
            {...S}
            stroke-width="1.8"
          />
        </g>
      ))}
    </g>,
  ],
  coralbud: [
    <g>
      <path
        d="M32 58V40M32 48l-8-8M32 44l8-8"
        {...S}
        stroke="#FF8A65"
        stroke-width="5.5"
        fill="none"
      />
    </g>,
    <g>
      <path
        d="M32 58V30M32 50L18 36V24M18 36l-6-4M32 42l14-12V20M46 30l7-3M32 34l-6-10M32 30l5-12"
        {...S}
        stroke-width="7.5"
        fill="none"
      />
      <path
        d="M32 58V30M32 50L18 36V24M18 36l-6-4M32 42l14-12V20M46 30l7-3M32 34l-6-10M32 30l5-12"
        stroke="#FF7F6E"
        stroke-width="3.6"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="18" cy="24" r="1.4" fill="#FFE0D6" />
      <circle cx="46" cy="20" r="1.4" fill="#FFE0D6" />
    </g>,
  ],
};
const SPROUT_TINT: Record<Crop, string> = {
  berry: "#7CC46A",
  wheat: "#8BC34A",
  kelp: "#4CC3A0",
  cotton: "#8BC34A",
  stoneflower: "#9CCC65",
  coralbud: "#FF9E80",
};

/** 作物：stage 0 发芽，1 生长，2 成熟 */
export function CropArt({ crop, stage }: { crop: Crop; stage: 0 | 1 | 2 }) {
  return (
    <Svg class={"crop-art stage-" + stage}>
      {stage === 0 ? Sprout(SPROUT_TINT[crop]) : CROP_ART[crop][stage - 1]}
    </Svg>
  );
}

const GOODS: Partial<Record<Item, JSX.Element>> = {
  oil: (
    <g>
      <path
        d="M22 18h20v6l6 8v22c0 3-2 5-5 5H21c-3 0-5-2-5-5V32l6-8z"
        fill="#FFF3D6"
        {...S}
      />
      <path
        d="M17 38h30v16c0 3-2 5-5 5H22c-3 0-5-2-5-5z"
        fill="#F7B733"
        {...S}
      />
      <rect x="20" y="10" width="24" height="8" rx="3" fill="#B97A3D" {...S} />
      <path
        d="M24 44c2-2 5-2 6 0"
        stroke="#FFE7A8"
        stroke-width="2.6"
        fill="none"
        stroke-linecap="round"
      />
    </g>
  ),
  paper: (
    <g>
      <path d="M14 18l30-6 6 34-30 6z" fill="#F3E9D2" {...S} />
      <path d="M10 22h30v34H10z" fill="#FFFDF6" {...S} />
      <path
        d="M16 32h18M16 39h18M16 46h12"
        stroke="#C9B48A"
        stroke-width="2.6"
        stroke-linecap="round"
      />
    </g>
  ),
  rope: (
    <g>
      <ellipse cx="32" cy="36" rx="22" ry="18" fill="#D9A766" {...S} />
      <ellipse cx="32" cy="36" rx="14" ry="11" fill="none" {...S} />
      <ellipse cx="32" cy="36" rx="6" ry="4.5" fill="#8A5A31" {...S} />
      <path d="M52 40c4 6 2 12-4 14" {...S} fill="none" stroke-width="4" />
    </g>
  ),
  cloth: (
    <g>
      <path d="M10 24h44v12H10z" fill="#FF8FA3" {...S} />
      <path
        d="M10 36h44v10c0 4-3 7-7 7H17c-4 0-7-3-7-7z"
        fill="#FF6F8C"
        {...S}
      />
      <path d="M10 24c0-4 3-7 7-7h30c4 0 7 3 7 7" fill="#FFB3C1" {...S} />
      <path
        d="M18 30h28M18 44h28"
        stroke="#FFFFFF"
        stroke-width="2.4"
        stroke-dasharray="2 4"
        stroke-linecap="round"
      />
    </g>
  ),
  stone: (
    <g>
      <path d="M8 40h24v16H8z" fill="#B9B3A8" {...S} />
      <path d="M32 40h24v16H32z" fill="#A9A397" {...S} />
      <path d="M20 24h24v16H20z" fill="#C8C2B6" {...S} />
      <path
        d="M24 30h6M12 46h6M36 46h6"
        stroke="#FFFFFF"
        stroke-width="2.4"
        stroke-linecap="round"
        opacity=".7"
      />
    </g>
  ),
  coral: (
    <g>
      <path
        d="M32 58V34M32 50L20 40V28M32 44l12-10V24M32 38l-4-10"
        {...S}
        stroke-width="8.5"
        fill="none"
      />
      <path
        d="M32 58V34M32 50L20 40V28M32 44l12-10V24M32 38l-4-10"
        stroke="#FF6F91"
        stroke-width="4.6"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M18 58h28" {...S} />
    </g>
  ),
};

const CARD_MARK: Partial<Record<Item, JSX.Element>> = {
  "card-lamp": (
    <g>
      <rect
        x="25"
        y="24"
        width="14"
        height="18"
        rx="6"
        fill="#FFD23F"
        {...S}
        stroke-width="2.4"
      />
      <path d="M28 24v-4h8v4M27 42h10" {...S} stroke-width="2.4" fill="none" />
    </g>
  ),
  "card-boat": (
    <g>
      <path d="M20 38h24l-5 8H25z" fill="#D9A066" {...S} stroke-width="2.4" />
      <path d="M32 38V20l9 12h-9" fill="#FFF" {...S} stroke-width="2.2" />
    </g>
  ),
  "card-net": (
    <path
      d="M22 22h20v20H22zM22 29h20M22 35h20M29 22v20M35 22v20"
      fill="#F3E3C3"
      {...S}
      stroke-width="2"
    />
  ),
  "card-stone": (
    <path
      d="M20 42c0-9 5-15 12-15s12 6 12 15c0 2-1 3-3 3H23c-2 0-3-1-3-3z"
      fill="#B9B3A8"
      {...S}
      stroke-width="2.4"
    />
  ),
  "card-coral": (
    <path
      d="M32 46V32M32 40l-7-6v-6M32 36l7-6v-6"
      {...S}
      stroke="#FF7F6E"
      stroke-width="4"
      fill="none"
    />
  ),
};

/** 背包、工坊、纸船里显示的物品图标 */
export function ItemArt({ item }: { item: Item }) {
  if (item in CARD_MARK)
    return (
      <Svg class="item-art card">
        <rect
          x="14"
          y="8"
          width="36"
          height="48"
          rx="7"
          fill="#FFFAF0"
          {...S}
        />
        <rect
          x="18"
          y="12"
          width="28"
          height="40"
          rx="5"
          fill="none"
          stroke="#E3CFA5"
          stroke-width="2"
        />
        {CARD_MARK[item]!}
      </Svg>
    );
  if (item in GOODS) return <Svg class="item-art">{GOODS[item]!}</Svg>;
  return <CropArt crop={item as Crop} stage={2} />;
}

export function BagArt() {
  return (
    <Svg class="ui-art">
      <path
        d="M22 22c0-8 4-12 10-12s10 4 10 12"
        fill="none"
        {...S}
        stroke-width="3.4"
      />
      <path
        d="M12 28c0-4 3-7 7-7h26c4 0 7 3 7 7v22c0 5-4 8-8 8H20c-4 0-8-3-8-8z"
        fill="#E59A4C"
        {...S}
      />
      <path d="M12 32h40v8H12z" fill="#C97A33" {...S} />
      <rect
        x="27"
        y="34"
        width="10"
        height="9"
        rx="2"
        fill="#FFD23F"
        {...S}
        stroke-width="2.2"
      />
    </Svg>
  );
}

export function WorkshopArt() {
  return (
    <svg viewBox="0 0 96 88" class="building-art" aria-hidden="true">
      <ellipse cx="48" cy="80" rx="40" ry="6" fill="rgba(58,38,24,.18)" />
      <path d="M16 40h64v38H16z" fill="#F3D9A4" {...S} />
      <path d="M8 44L48 12l40 32z" fill="#E86A4A" {...S} />
      <path
        d="M20 36l28-22 28 22"
        stroke="#FFB199"
        stroke-width="3"
        fill="none"
        stroke-linecap="round"
      />
      <path d="M40 78V56h16v22" fill="#8A5A31" {...S} />
      <rect x="22" y="50" width="12" height="12" rx="2" fill="#BFE6FF" {...S} />
      <rect x="62" y="50" width="12" height="12" rx="2" fill="#BFE6FF" {...S} />
      <path d="M64 22V10h8v18" fill="#B9B3A8" {...S} />
      <circle cx="74" cy="4" r="3" fill="#EEE" opacity=".8" />
    </svg>
  );
}

export function DockArt() {
  return (
    <svg viewBox="0 0 96 56" class="building-art dock" aria-hidden="true">
      <path d="M6 22h84v12H6z" fill="#C8975C" {...S} />
      <path d="M6 22h84" stroke="#E2B77E" stroke-width="3" />
      {[14, 34, 54, 74].map((x) => (
        <path d={`M${x} 34v18`} {...S} stroke-width="5" />
      ))}
      <path
        d="M24 22v12M44 22v12M64 22v12"
        stroke={INK}
        stroke-width="1.6"
        opacity=".5"
      />
      <circle cx="84" cy="16" r="6" fill="#FF6B6B" {...S} />
      <path d="M84 22v6" {...S} />
    </svg>
  );
}

/** 纸船；folded 时是寄出去的那只 */
export function BoatArt({ letter }: { letter?: boolean }) {
  return (
    <svg viewBox="0 0 72 56" class="boat-art" aria-hidden="true">
      <path d="M4 30h64L54 50H18z" fill="#FFFDF6" {...S} />
      <path d="M18 30L36 6l18 24" fill="#F3E9D2" {...S} />
      <path d="M36 6v24" {...S} stroke-width="2" />
      <path
        d="M12 38h48"
        stroke="#E3CFA5"
        stroke-width="2.4"
        stroke-linecap="round"
      />
      {letter && (
        <g>
          <rect
            x="44"
            y="4"
            width="22"
            height="16"
            rx="3"
            fill="#FFD23F"
            {...S}
            stroke-width="2.4"
          />
          <path d="M44 6l11 8 11-8" fill="none" {...S} stroke-width="2.2" />
        </g>
      )}
    </svg>
  );
}

export function DropArt() {
  return (
    <Svg class="ui-art">
      <path
        d="M32 6C24 20 14 30 14 40a18 18 0 0 0 36 0c0-10-10-20-18-34z"
        fill="#5AB4E6"
        {...S}
      />
      <path
        d="M24 40c0 5 3 9 8 10"
        stroke="#D9F2FF"
        stroke-width="4"
        fill="none"
        stroke-linecap="round"
      />
    </Svg>
  );
}

export function ShellBadge({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 64 64" class="shell-badge" aria-hidden="true">
      <path
        d="M32 3l7 8 10-3 1 10 10 4-5 9 5 9-10 4-1 10-10-3-7 8-7-8-10 3-1-10-10-4 5-9-5-9 10-4 1-10 10 3z"
        fill="#FFD23F"
        {...S}
        stroke-width="3"
      />
      <circle cx="32" cy="32" r="16" fill="#FFF8E1" {...S} stroke-width="2.6" />
      <text x="32" y="40" text-anchor="middle" class="shell-number">
        {level}
      </text>
    </svg>
  );
}

/** 大厅入口卡片上的小岛 */
export function IslandMini() {
  return (
    <svg viewBox="0 0 64 64" class="ui-art" aria-hidden="true">
      <ellipse cx="32" cy="46" rx="28" ry="10" fill="#5AB4E6" />
      <path
        d="M8 46c2-8 12-12 24-12s22 4 24 12c-6 4-14 6-24 6S14 50 8 46z"
        fill="#F3D9A4"
        {...S}
      />
      <path
        d="M14 42c4-5 10-7 18-7s14 2 18 7c-5 2-11 3-18 3s-13-1-18-3z"
        fill="#7CC46A"
        {...S}
        stroke-width="2.4"
      />
      <path d="M36 38c0-10 2-18 6-24" {...S} stroke-width="3.4" fill="none" />
      <path
        d="M42 14c-6-4-14-2-16 4 6-2 10-1 16-4zM42 14c4-6 12-6 16-2-6 0-10 0-16 2zM42 14c0 6 4 10 10 12-2-6-5-9-10-12z"
        fill="#4E9E3F"
        {...S}
        stroke-width="2.2"
      />
    </svg>
  );
}

/** 赢潮汐棋得到的装饰，摆在自己的岸上 */
export function DecorArt({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 64 64" class="decor-art" aria-hidden="true">
      <ellipse cx="32" cy="58" rx="24" ry="4" fill="rgba(58,38,24,.2)" />
      {id === "flowerbed" && (
        <g>
          <path d="M10 44h44v12H10z" fill="#B97A3D" {...S} />
          <path d="M10 44h44" stroke="#D9A066" stroke-width="3" />
          {[
            [18, 34, "#FF6F91"],
            [32, 28, "#FFD23F"],
            [46, 34, "#9B6BFF"],
          ].map(([x, y, c]) => (
            <g>
              <path
                d={`M${x} 44V${(y as number) + 4}`}
                {...S}
                stroke="#4E9E3F"
                stroke-width="3"
              />
              <circle
                cx={x as number}
                cy={y as number}
                r="6"
                fill={c as string}
                {...S}
                stroke-width="2.4"
              />
              <circle cx={x as number} cy={y as number} r="2" fill="#FFF8E1" />
            </g>
          ))}
        </g>
      )}
      {id === "bench" && (
        <g>
          <path d="M8 30h48v8H8z" fill="#D9A066" {...S} />
          <path d="M8 42h48v6H8z" fill="#C8975C" {...S} />
          <path d="M14 48v8M50 48v8M14 38v4M50 38v4" {...S} stroke-width="4" />
        </g>
      )}
      {id === "shells" && (
        <g>
          <path d="M14 54c0-10 6-16 12-16s12 6 12 16z" fill="#FFB3C1" {...S} />
          <path
            d="M20 54c0-8 3-12 6-14M32 54c0-8-3-12-6-14"
            stroke={INK}
            stroke-width="2"
            fill="none"
          />
          <path d="M34 54c1-8 6-12 12-12s10 6 8 12z" fill="#FFE0B2" {...S} />
          <path
            d="M44 32c4-6 12-4 12 2s-8 6-12 2z"
            fill="#BFE6FF"
            {...S}
            stroke-width="2.4"
          />
        </g>
      )}
    </svg>
  );
}

/** 7–10 级的地标，立在两岸之间 */
export function LandmarkArt({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 80 96" class="landmark-art" aria-hidden="true">
      <ellipse cx="40" cy="90" rx="30" ry="5" fill="rgba(20,80,120,.25)" />
      <path d="M12 88c4-10 14-14 28-14s24 4 28 14z" fill="#F3D9A4" {...S} />
      {id === "windmill" && (
        <g>
          <path d="M30 78l4-40h12l4 40z" fill="#FFF8E1" {...S} />
          <path d="M34 46h12" {...S} stroke-width="2" />
          <rect
            x="36"
            y="64"
            width="8"
            height="12"
            rx="2"
            fill="#8A5A31"
            {...S}
            stroke-width="2"
          />
          <g transform="translate(40 36)">
            {[0, 90, 180, 270].map((a) => (
              <path
                d="M0 0l4-24h6l-6 24z"
                fill="#FF8A65"
                {...S}
                stroke-width="2.4"
                transform={`rotate(${a})`}
              />
            ))}
            <circle r="4" fill="#FFD23F" {...S} stroke-width="2.4" />
          </g>
        </g>
      )}
      {id === "swing" && (
        <g>
          <path
            d="M18 78L28 20h24l10 58"
            fill="none"
            {...S}
            stroke-width="5"
            stroke="#8A5A31"
          />
          <path
            d="M18 78L28 20h24l10 58"
            fill="none"
            stroke="#C8975C"
            stroke-width="2"
          />
          <path d="M34 22v34M46 22v34" {...S} stroke-width="2.4" />
          <path d="M30 56h20v6H30z" fill="#FF6F91" {...S} />
          <path d="M24 20h32" {...S} stroke-width="5" stroke="#8A5A31" />
        </g>
      )}
      {id === "observatory" && (
        <g>
          <path d="M24 78V48h32v30z" fill="#E6DCC8" {...S} />
          <path d="M20 50c0-14 9-22 20-22s20 8 20 22z" fill="#5A6BE0" {...S} />
          <path d="M40 28v-4" {...S} />
          <path
            d="M44 34l14-10 4 6-14 8z"
            fill="#B9B3A8"
            {...S}
            stroke-width="2.4"
          />
          <path
            d="M28 18l2 4 4 1-4 1-2 4-2-4-4-1 4-1zM58 12l1.5 3 3 1-3 1-1.5 3-1.5-3-3-1 3-1z"
            fill="#FFD23F"
          />
          <rect
            x="35"
            y="62"
            width="10"
            height="16"
            rx="2"
            fill="#8A5A31"
            {...S}
            stroke-width="2"
          />
        </g>
      )}
      {id === "lighthouse" && (
        <g>
          <path d="M30 78l4-48h12l4 48z" fill="#FFF8E1" {...S} />
          <path
            d="M31.5 60h17M32.7 44h14.6"
            stroke="#E8436D"
            stroke-width="7"
          />
          <path d="M30 78l4-48h12l4 48z" fill="none" {...S} />
          <rect
            x="31"
            y="18"
            width="18"
            height="12"
            rx="2"
            fill="#FFD23F"
            {...S}
          />
          <path d="M28 18h24l-12-10z" fill="#E8436D" {...S} />
          <path d="M49 22l18-6v14z" fill="#FFE27A" opacity=".7" />
        </g>
      )}
    </svg>
  );
}
