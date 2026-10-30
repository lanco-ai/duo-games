import type { ComponentChildren } from "preact";
import { critterSVG, kindOf, type Mood, type Pose, INK } from "./critter";
export function Critter({
  avatar,
  color,
  mood = "normal",
  pose = "stand",
  size = 64,
  shadow = true,
  label,
  class: cls = "",
}: {
  avatar?: string;
  color: string;
  mood?: Mood;
  pose?: Pose;
  size?: number;
  shadow?: boolean;
  label?: string;
  class?: string;
}) {
  return (
    <svg
      class={"critter " + cls}
      width={size}
      height={size}
      viewBox="-4 -8 108 108"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      dangerouslySetInnerHTML={{
        __html: critterSVG(kindOf(avatar), color, mood, pose, shadow),
      }}
    />
  );
}
/** Characters and tether share one coordinate system and one animation. */
export function TetheredPair({
  left,
  right,
  size = 96,
  mood = "joy",
  leftOnline = true,
  rightOnline = true,
}: {
  left: { avatar?: string; color: string };
  right?: { avatar?: string; color: string } | null;
  size?: number;
  mood?: Mood;
  leftOnline?: boolean;
  rightOnline?: boolean;
}) {
  return (
    <svg
      class={
        "tethered-pair" + (right && leftOnline && rightOnline ? " hop" : "")
      }
      width={(size * 248) / 108}
      height={size}
      viewBox="-4 -8 248 108"
      aria-hidden="true"
    >
      <g class="pair-thread" opacity={right ? 1 : 0.45}>
        <path
          d="M50,78 Q120,100 190,78"
          fill="none"
          stroke={INK}
          stroke-width="5"
          stroke-linecap="round"
        />
        <path
          d="M50,78 Q120,100 190,78"
          fill="none"
          stroke="#E8364F"
          stroke-width="3"
          stroke-linecap="round"
        />
      </g>
      <g
        data-pair-seat="0"
        class={leftOnline ? "" : "offline"}
        dangerouslySetInnerHTML={{
          __html: critterSVG(kindOf(left.avatar), left.color, mood),
        }}
      />
      {right ? (
        <g
          data-pair-seat="1"
          transform="translate(140 0)"
          class={rightOnline ? "" : "offline"}
          dangerouslySetInnerHTML={{
            __html: critterSVG(kindOf(right.avatar), right.color, mood),
          }}
        />
      ) : (
        <g transform="translate(140 0)">
          <rect
            x="23"
            y="28"
            width="54"
            height="68"
            rx="24"
            fill="#FFF8E6"
            fill-opacity=".6"
            stroke={INK}
            stroke-width="3"
            stroke-dasharray="5 4"
          />
          <text x="50" y="76" text-anchor="middle" fill={INK} font-size="38">
            ?
          </text>
        </g>
      )}
    </svg>
  );
}
const CLOUD =
  "M24,52C12,52 6,44 9,36C11,29 18,27 23,29C24,18 34,11 45,13C52,6 66,6 73,15C82,11 95,16 96,28C105,29 112,36 110,44C108,50 103,52 97,52Z";
export function Cloud({ class: cls = "" }: { class?: string }) {
  return (
    <svg class={"cloud " + cls} viewBox="0 0 120 60" aria-hidden="true">
      <path d={CLOUD} fill="#fff" stroke="#A7D5F5" stroke-width="3" />
      <path
        d="M14,46C30,50 80,51 104,46C102,50 99,52 96,52L24,52C19,52 16,50 14,46Z"
        fill="#E4F3FF"
      />
    </svg>
  );
}
/** Full-bleed cartoon background: sky, drifting clouds, hills and optional ground. */
export function Scene({
  variant = "day",
  ground = false,
  children,
}: {
  variant?: "day" | "night";
  ground?: boolean;
  children?: ComponentChildren;
}) {
  const night = variant === "night";
  return (
    <div class={"scene scene-" + variant} aria-hidden="true">
      {night ? (
        <>
          <span class="stars" />
          <span class="stars stars-2" />
          <svg class="moon" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="26" fill="#FFE58A" stroke={INK} stroke-width="3" />
            <circle cx="31" cy="33" r="4" fill="#F5CF5C" />
            <circle cx="49" cy="50" r="5.5" fill="#F5CF5C" />
            <path d="M30,44Q34,48 38,44M44,44Q48,48 52,44" stroke={INK} stroke-width="2.6" fill="none" stroke-linecap="round" />
          </svg>
        </>
      ) : (
        <>
          <Cloud class="c1" />
          <Cloud class="c2" />
          <Cloud class="c3" />
          <Cloud class="c4" />
        </>
      )}
      <svg class="hills" viewBox="0 0 400 160" preserveAspectRatio="none">
        <path
          d="M0,62C55,18 125,8 196,58C246,26 330,6 400,48L400,160L0,160Z"
          fill={night ? "#2E4A78" : "#A6E07A"}
          stroke={night ? "#1C2D4E" : "#5DAF3C"}
          stroke-width="2.5"
          vector-effect="non-scaling-stroke"
        />
        <path
          d="M0,104C70,66 150,74 214,100C276,72 344,64 400,94L400,160L0,160Z"
          fill={night ? "#22385A" : "#79CC50"}
          stroke={night ? "#16233C" : "#3F9A2C"}
          stroke-width="2.5"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      {ground && (
        <div class="ground">
          <svg class="grass-edge" viewBox="0 0 120 16" preserveAspectRatio="none">
            <path
              d="M0,0H120V8C115,8 113,14 108,14C103,14 101,8 96,8C91,8 89,14 84,14C79,14 77,8 72,8C67,8 65,14 60,14C55,14 53,8 48,8C43,8 41,14 36,14C31,14 29,8 24,8C19,8 17,14 12,14C7,14 5,8 0,8Z"
              fill="#6FCB45"
              stroke="#3F8F27"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}
export function Logo() {
  const layer = (dy: number, main: boolean) => (
    <g transform={"translate(0," + dy + ")"}>
      <text
        x="180"
        y="54"
        text-anchor="middle"
        font-size="40"
        fill={main ? "url(#logo-green)" : "#2F6B12"}
        stroke="#2F6B12"
        stroke-width="11"
        stroke-linejoin="round"
        paint-order="stroke"
      >
        情侣双人
      </text>
      <text
        x="180"
        y="146"
        text-anchor="middle"
        font-size="84"
        fill={main ? "url(#logo-gold)" : "#6B2E05"}
        stroke={main ? "#8A3F0A" : "#6B2E05"}
        stroke-width="15"
        stroke-linejoin="round"
        paint-order="stroke"
      >
        二人世界
      </text>
    </g>
  );
  return (
    <svg class="logo" viewBox="0 0 360 172" role="img" aria-label="二人世界">
      <defs>
        <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#FFF7AE" />
          <stop offset=".42" stop-color="#FFD23F" />
          <stop offset="1" stop-color="#FF8C1A" />
        </linearGradient>
        <linearGradient id="logo-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F1FF9A" />
          <stop offset=".5" stop-color="#A5E24C" />
          <stop offset="1" stop-color="#5CB82C" />
        </linearGradient>
      </defs>
      <g transform="rotate(-3 180 100)">
        {layer(6, false)}
        {layer(0, true)}
      </g>
    </svg>
  );
}
export const TILE_COLORS: Record<string, [string, string]> = {
  "talk-cards": ["#9C8BFF", "#5B4BD6"],
  "draw-guess": ["#FFCB6B", "#FF9A3C"],
  "mind-meld": ["#D2B0FF", "#9B6BFF"],
  "know-me": ["#FFA6C6", "#FF6B9A"],
  gomoku: ["#97E8B6", "#38B872"],
  "red-thread": ["#FF9B9B", "#F04E5E"],
  "my-eyes": ["#86D8FF", "#3AA3E8"],
  "heart-bounce": ["#FFE47A", "#FFB21E"],
  "puzzle-us": ["#A9CCFF", "#5B8DEF"],
  heartbeat: ["#FFA3E3", "#C45BFF"],
  "love-slots": ["#FFB3C7", "#E8436D"],
};
const S = { stroke: INK, "stroke-width": 2.6, "stroke-linejoin": "round", "stroke-linecap": "round" } as const;
const HEART = (x: number, y: number, r: number) =>
  `M${x},${y + r * 0.95}C${x - r * 1.6},${y - r * 0.15} ${x - r * 0.85},${y - r * 1.25} ${x},${y - r * 0.45}C${x + r * 0.85},${y - r * 1.25} ${x + r * 1.6},${y - r * 0.15} ${x},${y + r * 0.95}Z`;
export function GameIcon({ id }: { id: string }) {
  let body: ComponentChildren = null;
  if (id === "talk-cards")
    body = (
      <>
        <g transform="rotate(-9 26 40)">
          <rect x="10" y="20" width="31" height="39" rx="6" fill="#FFF8EA" {...S} />
          <text x="25.5" y="49" text-anchor="middle" font-size="25" fill="#7B5CFF" class="icon-text">?</text>
        </g>
        <circle cx="46" cy="18" r="12" fill="#FFE066" {...S} />
        <path d="M40,18Q43,21 46,18M47.5,22Q50,24.5 52.5,22" fill="none" {...S} stroke-width="2" />
        <path d="M54,40l2,4 4,2-4,2-2,4-2-4-4-2 4-2z" fill="#FFF" stroke="none" />
      </>
    );
  else if (id === "draw-guess")
    body = (
      <>
        <path d="M30,8C13,8 5,22 7,35C9,49 22,56 33,54C40,53 40,46 37,43C34,40 38,34 44,36C53,38 59,32 58,23C56,13 45,8 30,8Z" fill="#FFE6C2" {...S} />
        <circle cx="20" cy="26" r="4.5" fill="#FF5D6C" {...S} stroke-width="2" />
        <circle cx="31" cy="18" r="4.5" fill="#4DABF7" {...S} stroke-width="2" />
        <circle cx="44" cy="22" r="4.5" fill="#69DB7C" {...S} stroke-width="2" />
        <circle cx="19" cy="40" r="4.5" fill="#FFD43B" {...S} stroke-width="2" />
        <g transform="rotate(38 46 44)">
          <rect x="43" y="28" width="7" height="24" rx="3" fill="#B97A45" {...S} />
          <path d="M43,52h7l-1,5c-1,4-4,4-5,0z" fill="#FF5D6C" {...S} />
        </g>
      </>
    );
  else if (id === "mind-meld")
    body = (
      <>
        <circle cx="23" cy="27" r="15" fill="#FFC2DB" {...S} />
        <circle cx="41" cy="27" r="15" fill="#A9DBFF" {...S} />
        <path d="M32,15.2A15,15 0 0 1 32,38.8A15,15 0 0 1 32,15.2Z" fill="#FFFFFF" {...S} stroke-width="2" />
        <path d={HEART(32, 27, 5.6)} fill="#FF4D6A" {...S} stroke-width="2" />
        <circle cx="15" cy="49" r="4.5" fill="#FFC2DB" {...S} stroke-width="2" />
        <circle cx="10" cy="57" r="2.6" fill="#FFC2DB" {...S} stroke-width="2" />
        <circle cx="49" cy="49" r="4.5" fill="#A9DBFF" {...S} stroke-width="2" />
        <circle cx="54" cy="57" r="2.6" fill="#A9DBFF" {...S} stroke-width="2" />
      </>
    );
  else if (id === "know-me")
    body = (
      <>
        <path d="M12,10H52A7,7 0 0 1 59,17V40A7,7 0 0 1 52,47H32L20,57V47H12A7,7 0 0 1 5,40V17A7,7 0 0 1 12,10Z" fill="#FFFFFF" {...S} />
        <path d={HEART(24, 28, 8.5)} fill="#FF4D6A" {...S} stroke-width="2.2" />
        <text x="44" y="38" text-anchor="middle" font-size="22" fill="#7B5CFF" class="icon-text">?</text>
      </>
    );
  else if (id === "gomoku")
    body = (
      <>
        <rect x="8" y="8" width="48" height="48" rx="7" fill="#F5C47E" {...S} />
        <path d="M20,9V55M32,9V55M44,9V55M9,20H55M9,32H55M9,44H55" stroke="#B9823F" stroke-width="1.8" />
        <path d={HEART(20, 20, 6.5)} fill="#FF5D6C" {...S} stroke-width="2" />
        <path d={HEART(32, 32, 6.5)} fill="#4D9DFF" {...S} stroke-width="2" />
        <path d={HEART(44, 44, 6.5)} fill="#FF5D6C" {...S} stroke-width="2" />
        <path d={HEART(44, 20, 6.5)} fill="#4D9DFF" {...S} stroke-width="2" />
      </>
    );
  else if (id === "red-thread")
    body = (
      <>
        <path d="M18,40Q32,58 46,40" fill="none" stroke={INK} stroke-width="5" stroke-linecap="round" />
        <path d="M18,40Q32,58 46,40" fill="none" stroke="#E8364F" stroke-width="2.8" stroke-linecap="round" />
        <g
          transform="translate(-3 10) scale(.42)"
          dangerouslySetInnerHTML={{ __html: critterSVG("bunny", "#FF6B6B", "joy", "stand", false) }}
        />
        <g
          transform="translate(26 10) scale(.42)"
          dangerouslySetInnerHTML={{ __html: critterSVG("bear", "#4D9DFF", "joy", "stand", false) }}
        />
      </>
    );
  else if (id === "my-eyes")
    body = (
      <>
        <path d="M8,46H24V38H40V30H56" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 7" />
        <path d="M5,26C15,10 49,10 59,26C49,42 15,42 5,26Z" fill="#FFFFFF" {...S} />
        <circle cx="32" cy="26" r="10" fill="#4DABF7" {...S} />
        <circle cx="32" cy="26" r="4.5" fill={INK} />
        <circle cx="35.5" cy="22.5" r="2.4" fill="#FFFFFF" />
        <path d="M14,12l-3-5M32,8V2M50,12l3-5" {...S} fill="none" />
      </>
    );
  else if (id === "heart-bounce")
    body = (
      <>
        <path d={HEART(32, 22, 13)} fill="#FF4D6A" {...S} />
        <ellipse cx="26" cy="15" rx="3.2" ry="2" fill="#FFFFFF" opacity=".8" transform="rotate(-35 26 15)" />
        <path d="M10,30Q6,22 10,14M54,30Q58,22 54,14" fill="none" {...S} stroke="#FFFFFF" stroke-width="3" />
        <rect x="10" y="48" width="44" height="9" rx="4.5" fill="#4D9DFF" {...S} />
        <path d="M17,57V61M47,57V61" {...S} />
      </>
    );
  else if (id === "puzzle-us")
    body = (
      <>
        <path d="M10,18H24C22,8 38,8 36,18H50V30C60,28 60,44 50,42V54H36C38,46 22,46 24,54H10V42C18,44 18,28 10,30Z" fill="#FFFFFF" {...S} />
        <path d={HEART(30, 33, 8)} fill="#FF4D6A" {...S} stroke-width="2.2" />
      </>
    );
  else if (id === "heartbeat")
    body = (
      <>
        <path d="M22,44V14L48,8V38" fill="none" {...S} stroke-width="4" />
        <path d="M22,14L48,8" {...S} stroke-width="7" />
        <ellipse cx="16" cy="46" rx="8" ry="6.5" fill="#FFFFFF" {...S} transform="rotate(-20 16 46)" />
        <ellipse cx="42" cy="40" rx="8" ry="6.5" fill="#FFFFFF" {...S} transform="rotate(-20 42 40)" />
        <path d={HEART(50, 53, 7)} fill="#FF4D6A" {...S} stroke-width="2" />
      </>
    );
  if (!body) {
    const symbols: Record<string, string> = {survival:'💌','spot-difference':'🔍','coop-kitchen':'🍳','couple-ludo':'🎲','hide-seek':'🔦','couple-jump':'🧊','love-slots':'🎰'};
    body = <text x="32" y="44" text-anchor="middle" font-size="31">{symbols[id] || '💗'}</text>;
  }
  const [a, b] = TILE_COLORS[id] || ["#FFD", "#FC8"];
  return (
    <svg class="game-icon" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={"tile-" + id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={a} />
          <stop offset="1" stop-color={b} />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="61" height="61" rx="15" fill={"url(#tile-" + id + ")"} stroke={INK} stroke-width="3" />
      <rect x="6" y="5" width="52" height="10" rx="5" fill="#FFFFFF" opacity=".28" />
      {body}
    </svg>
  );
}
