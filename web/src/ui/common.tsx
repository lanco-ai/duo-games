import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { AVATARS, COLORS, type Profile } from "../../../shared/protocol";
import { Critter, TetheredPair } from "../art/ui";
import { KIND_NAMES, kindOf, type Mood } from "../art/critter";
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ComponentChildren;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      class={wide ? "wide-dialog" : ""}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div class="sheet">
        <div class="sheet-top">
          <h2 class="ribbon">{title}</h2>
          <button class="close-button" aria-label="关闭" onClick={close}>
            ×
          </button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </dialog>
  );
}
const COLOR_NAMES = ["珊瑚", "天蓝", "薄荷", "柠檬", "薰衣草", "蜜桃"];
export function ProfileForm({
  initial,
  blocked = [],
  submit,
  label = "进入房间",
  busy = false,
}: {
  initial?: Profile;
  blocked?: string[];
  submit: (p: Profile) => void;
  label?: string;
  busy?: boolean;
}) {
  const [name, setName] = useState(initial?.nickname || "");
  const [avatar, setAvatar] = useState(initial?.avatar || "🐰");
  const [color, setColor] = useState(
    initial && !blocked.includes(initial.color)
      ? initial.color
      : COLORS.find((c) => !blocked.includes(c))!,
  );
  return (
    <form
      class="profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) submit({ nickname: name.trim(), avatar, color });
      }}
    >
      <div class="profile-preview">
        <Critter avatar={avatar} color={color} mood="joy" size={104} />
        <span class="name-tag" style={{ "--player": color }}>
          {name.trim() || "你的名字"}
        </span>
      </div>
      <label>选个小伙伴</label>
      <div class="options avatar-options">
        {AVATARS.map((a) => (
          <button
            type="button"
            class={avatar === a ? "option selected" : "option"}
            aria-label={KIND_NAMES[kindOf(a)]}
            aria-pressed={avatar === a}
            onClick={() => setAvatar(a)}
          >
            <Critter avatar={a} color={color} size={48} shadow={false} />
          </button>
        ))}
      </div>
      <label for="nickname">你的昵称</label>
      <input
        id="nickname"
        value={name}
        maxLength={12}
        placeholder="让 TA 一眼认出你"
        required
        onInput={(e) => setName(e.currentTarget.value)}
        autoComplete="nickname"
      />
      <label>围巾颜色</label>
      <div class="options">
        {COLORS.map((c, i) => (
          <button
            type="button"
            class={"swatch " + (color === c ? "selected" : "")}
            style={{ "--player": c }}
            aria-label={COLOR_NAMES[i]}
            aria-pressed={color === c}
            disabled={blocked.includes(c)}
            onClick={() => setColor(c)}
          >
            {color === c ? "✓" : ""}
          </button>
        ))}
      </div>
      <button class="go wide big" disabled={busy || !name.trim()}>
        {busy ? "请稍等…" : label + " ❤"}
      </button>
    </form>
  );
}
/** Two critters tied by the red thread, used on status pages. */
export function Couple({
  left = { avatar: "🐰", color: "#FF6B6B" },
  right = { avatar: "🐻", color: "#4D9DFF" },
  mood = "joy",
  size = 96,
}: {
  left?: { avatar: string; color: string };
  right?: { avatar: string; color: string } | null;
  mood?: Mood;
  size?: number;
}) {
  return (
    <div class="couple-pair" style={{ "--size": size + "px" }}>
      <TetheredPair left={left} right={right} mood={mood} size={size} />
    </div>
  );
}
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.append(el);
    el.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    el.remove();
    return ok;
  }
}
let audio: AudioContext | undefined;
export function unlockSound() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {}
}
export function chime() {
  if (localStorage.getItem("duo.sound") === "off" || !audio) return;
  try {
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.04, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.2);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.2);
  } catch {}
}
