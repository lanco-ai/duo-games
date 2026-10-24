import { describe, it, expect } from "vitest";
import { init, apply, view, result } from "../../shared/games/talk-cards/rules";
import { cards } from "../../shared/content/cards";
const settings = {
  decks: ["轻松", "走心"] as ("轻松" | "走心")[],
  limit: 10 as const,
};
describe("talk cards authority", () => {
  it("has 40 unique authored prompts in each deck", () => {
    for (const deck of ["轻松", "走心", "未来", "小挑战"])
      expect(cards.filter((c) => c.deck === deck)).toHaveLength(40);
    expect(new Set(cards.map((c) => c.text)).size).toBe(160);
  });
  it("hides undrawn cards and rejects the wrong player", () => {
    const s = init(settings, 7, []);
    expect(view(s).card).toBeNull();
    expect(JSON.stringify(view(s))).not.toContain("order");
    expect(apply(s, 1, { type: "draw" }, 100).error).toBe("NOT_YOUR_TURN");
  });
  it("uses a scheduled flip and advances simultaneous next only once", () => {
    let s = init(settings, 7, []);
    s = apply(s, 0, { type: "draw" }, 100).s;
    expect(s.flipAt).toBe(700);
    expect(apply(s, 1, { type: "next", idx: 0 }, 200).error).toBe("INVALID");
    s = apply(s, 0, { type: "next", idx: 0 }, 800).s;
    s = apply(s, 1, { type: "next", idx: 0 }, 800).s;
    expect(s.idx).toBe(1);
    expect(s.turn).toBe(1);
    expect(s.played).toBe(1);
  });
  it("skip keeps the same drawer and does not count as discussed", () => {
    let s = apply(init(settings, 8, []), 0, { type: "draw" }, 0).s;
    s = apply(s, 0, { type: "skip", idx: 0 }, 700).s;
    expect(s.turn).toBe(0);
    expect(s.played).toBe(0);
    expect(s.skipped).toBe(1);
  });
  it("persists separate favorites and only accepts the revealed current card", () => {
    let s = apply(init(settings, 1, []), 0, { type: "draw" }, 0).s;
    const id = view(s).card!.id;
    expect(apply(s, 1, { type: "fav", cardId: id, on: true }, 100).error).toBe(
      "INVALID",
    );
    s = apply(s, 1, { type: "fav", cardId: id, on: true }, 700).s;
    expect(s.favorites[1]).toContain(id);
    expect(s.favorites[0]).toEqual([]);
    expect(
      apply(s, 0, { type: "answer", cardId: id, text: "a".repeat(301) }, 700)
        .error,
    ).toBe("INVALID");
  });
  it("finishes 10 cards and avoids previously discussed cards on replay", () => {
    let s = init(settings, 9, []);
    for (let i = 0; i < 10; i++) {
      s = apply(s, s.turn, { type: "draw" }, i * 1000).s;
      s = apply(s, s.turn, { type: "next", idx: s.idx }, i * 1000 + 700).s;
    }
    expect(result(s)?.stats.played).toBe(10);
    expect(
      init(settings, 9, s.discussed).order.some((id) =>
        s.discussed.includes(id),
      ),
    ).toBe(false);
  });
});

it("keeps a draft tied to its discussed card after the partner advances", () => {
  let s = apply(init(settings, 20, []), 0, { type: "draw" }, 0).s;
  const original = view(s).card!;
  s = apply(s, 1, { type: "next", idx: 0 }, 700).s;
  s = apply(s, 1, { type: "draw" }, 800).s;
  const answer = apply(
    s,
    0,
    { type: "answer", cardId: original.id, text: "给原来的问题写回答" },
    1500,
  );
  expect(answer.error).toBeUndefined();
  expect(answer.answer?.card.id).toBe(original.id);
  expect(answer.answer?.card.id).not.toBe(view(s).card!.id);
  expect(
    apply(
      s,
      0,
      { type: "answer", cardId: s.order[4], text: "不能写未来卡" },
      1500,
    ).error,
  ).toBe("INVALID");
});
