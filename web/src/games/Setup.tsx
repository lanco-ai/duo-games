import { useState } from "preact/hooks";
import type { Action, RoomView, Seat } from "../../../shared/protocol";
import {
  gameOptions,
  type ExtraId,
  type GameOptions,
} from "../../../shared/games/types";
import { BASE } from "../api";
import { Calibration } from "./audio";
export default function Setup({
  id,
  room,
  seat,
  send,
  code,
  token,
  onLibrary,
}: {
  id: ExtraId;
  room: RoomView;
  seat: Seat;
  send: (a: Action) => Promise<boolean>;
  code: string;
  token: string;
  onLibrary: () => void;
}) {
  const opts = gameOptions(id, room.settings.games?.[id]),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const update = (values: GameOptions) =>
    send({
      type: "settings",
      settings: {
        ...room.settings,
        games: { ...room.settings.games, [id]: { ...opts, ...values } },
      },
    });
  const select = (
    key: string,
    label: string,
    values: [string | number, string][],
  ) => (
    <label class="setup-field">
      {label}
      <select
        aria-label={label}
        value={String(opts[key])}
        onChange={(e) =>
          void update({
            [key]:
              typeof values[0][0] === "number"
                ? Number(e.currentTarget.value)
                : e.currentTarget.value,
          })
        }
      >
        {values.map(([value, label]) => (
          <option value={value}>{label}</option>
        ))}
      </select>
    </label>
  );
  const checks = (key: string, label: string, values: string[]) => (
    <div class="setup-checks">
      <span>{label}</span>
      <div>
        {values.map((value) => (
          <label>
            <input
              type="checkbox"
              checked={(opts[key] as string[]).includes(value)}
              onChange={(e) => {
                const next = e.currentTarget.checked
                  ? [...(opts[key] as string[]), value]
                  : (opts[key] as string[]).filter((v) => v !== value);
                if (next.length) void update({ [key]: next });
              }}
            />
            {value}
          </label>
        ))}
      </div>
    </div>
  );
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const bitmap = await createImageBitmap(file),
        scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("图片处理失败"))),
          "image/jpeg",
          0.82,
        ),
      );
      if (blob.size > 2 * 1024 * 1024)
        throw new Error("这张照片有点大，请换一张或裁剪后重试。");
      const response = await fetch(BASE + "api/rooms/" + code + "/images", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "image/jpeg",
        },
        body: blob,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      await update({ image: data.imageId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <div class="game-setup">
      <fieldset disabled={room.proposal?.by !== seat || uploading}>
        {id === "draw-guess" && (
          <>
            {select("rounds", "轮数", [
              [4, "4 轮"],
              [6, "6 轮"],
              [8, "8 轮"],
            ])}
            {select("seconds", "每轮时长", [
              [60, "60 秒"],
              [80, "80 秒"],
              [100, "100 秒"],
            ])}
            {checks("libraries", "词库", ["日常", "恋爱", "我们的回忆"])}
          </>
        )}
        {id === "mind-meld" &&
          select("seconds", "每轮限时", [
            [0, "不限时"],
            [30, "30 秒"],
            [60, "60 秒"],
          ])}
        {id === "know-me" && (
          <>
            {select("count", "题数", [
              [10, "10 题"],
              [15, "15 题"],
              [20, "20 题"],
            ])}
            {checks("categories", "分类", [
              "吃喝",
              "习惯",
              "回忆",
              "恋爱观",
              "假如",
              "未来",
            ])}
            <label class="check-line">
              <input
                type="checkbox"
                checked={!!opts.unused}
                onChange={(e) =>
                  void update({ unused: e.currentTarget.checked })
                }
              />
              只出没玩过的题
            </label>
          </>
        )}
        {id === "gomoku" && (
          <>
            {select("first", "谁先下", [
              ["随机", "随机"],
              ["房主", "房主"],
              ["TA", "TA"],
            ])}
            {select("seconds", "每步限时", [
              [0, "不限时"],
              [30, "30 秒"],
              [60, "60 秒"],
            ])}
            <label class="setup-field">
              小赌约
              <input
                aria-label="小赌约"
                maxLength={20}
                value={String(opts.wager)}
                onChange={(e) => void update({ wager: e.currentTarget.value })}
              />
            </label>
            <p class="muted">
              请喝奶茶 / 洗一次碗 / 为 TA 做一顿饭，或者自己写一句。
            </p>
          </>
        )}
        {id === "red-thread" && (
          <>
            {select("level", "一起爬哪一关", [
              ["1", "相识 · 学会拉住 TA"],
              ["2", "暧昧 · 追上移动的平台"],
              ["3", "热恋 · 冰面与弹簧"],
              ["4", "相守 · 一起打开门"],
              ["endless", "∞ 无尽攀登"],
            ])}
            <p class="muted">
              左右移动，跳跃，按住「抓」。红线绷紧时，按住跳向 TA 爬。
            </p>
          </>
        )}
        {id === "puzzle-us" && (
          <>
            {select("pieces", "拼图块数", [
              [24, "24 块 · 轻松"],
              [48, "48 块 · 日常"],
              [96, "96 块 · 耐心"],
              [150, "150 块 · 挑战"],
            ])}
            <p>选择一张风景，或上传你们的合照</p>
            <div class="scene-picker">
              {[
                ["sunset", "海边日落"],
                ["sakura", "樱花"],
                ["stars", "星空"],
                ["cats", "猫咪"],
                ["city", "城市夜景"],
                ["balloons", "热气球"],
              ].map(([id, label]) => (
                <button
                  type="button"
                  aria-pressed={opts.image === "scene:" + id}
                  onClick={() => void update({ image: "scene:" + id })}
                >
                  <img src={BASE + "scenes/" + id + ".svg"} alt={label} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <label class="upload-photo">
              {uploading
                ? "正在处理照片…"
                : String(opts.image).startsWith("scene:")
                  ? "上传我们的照片"
                  : "✓ 已选择合照 · 换一张"}
              <input
                type="file"
                aria-label="上传拼图照片"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void upload(e.currentTarget.files?.[0])}
              />
            </label>
          </>
        )}
        {id === "heartbeat" &&
          select("track", "选择曲目", [
            ["meet", "初见 · 90 BPM · 简单"],
            ["date", "约会 · 110 BPM · 普通"],
            ["heart", "心动 · 128 BPM · 困难"],
          ])}
      </fieldset>
      {["draw-guess", "know-me"].includes(id) && (
        <button class="text-button" onClick={onLibrary}>
          {id === "draw-guess"
            ? "✎ 添加只有你们懂的回忆词"
            : "✎ 添加我们的题目"}
        </button>
      )}
      {id === "heartbeat" && (
        <>
          <p class="notice">坐在一起时，建议只开一台设备的声音，避免回声。</p>
          <Calibration />
        </>
      )}
      {error && (
        <p role="alert" class="error">
          {error}
        </p>
      )}
    </div>
  );
}
