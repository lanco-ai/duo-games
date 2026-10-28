export const radarAxes = [
  ["food", "饮食"],
  ["personality", "性格"],
  ["memories", "回忆"],
  ["future", "未来"],
  ["preferences", "喜好"],
] as const;
const tags: Record<string, string> = {
  吃喝: "food",
  饮食: "food",
  习惯: "personality",
  恋爱观: "personality",
  性格: "personality",
  回忆: "memories",
  未来: "future",
  假如: "preferences",
  喜好: "preferences",
};
export function radarStats(
  items: { tag: string; points: number; max: number }[],
) {
  const stats: Record<string, number> = {};
  for (const [axis] of radarAxes) {
    const covered = items.filter((i) => tags[i.tag] === axis && i.max > 0);
    stats[`radar_${axis}_count`] = covered.length;
    if (covered.length)
      stats[`radar_${axis}`] = Math.round(
        (100 * covered.reduce((sum, i) => sum + i.points, 0)) /
          covered.reduce((sum, i) => sum + i.max, 0),
      );
  }
  return stats;
}
