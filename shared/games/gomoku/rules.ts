const axes = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];
function at(origin: number, step: number, dx: number, dy: number) {
  const x = (origin % 15) + step * dx,
    y = Math.floor(origin / 15) + step * dy;
  return x < 0 || x > 14 || y < 0 || y > 14 ? -1 : y * 15 + x;
}
function fours(board: number[], origin: number, seat: number) {
  const groups = new Set<string>();
  for (const [dx, dy] of axes)
    for (let start = -4; start <= 0; start++) {
      const cells = Array.from({ length: 5 }, (_, i) =>
        at(origin, start + i, dx, dy),
      );
      if (cells.some((c) => c < 0 || (board[c] !== seat && board[c] !== -1)))
        continue;
      const stones = cells.filter((c) => board[c] === seat);
      if (stones.length === 4)
        groups.add(stones.sort((a, b) => a - b).join(","));
    }
  return groups.size;
}
/** Only the requested double-three / double-four rule; overlines are allowed. */
export function forbiddenMove(
  board: number[],
  cell: number,
  seat: number,
): "double-three" | "double-four" | null {
  if (board[cell] !== -1) return null;
  const next = [...board];
  next[cell] = seat;
  // A winning move takes priority over threats created in another direction.
  for (const [dx, dy] of axes) {
    let count = 1;
    for (const sign of [-1, 1])
      for (let n = 1; n < 15; n++) {
        const c = at(cell, n * sign, dx, dy);
        if (c < 0 || next[c] !== seat) break;
        count++;
      }
    if (count >= 5) return null;
  }
  if (fours(next, cell, seat) >= 2) return "double-four";
  const threes = new Set<string>();
  for (const [dx, dy] of axes)
    for (let start = -3; start <= 0; start++) {
      const cells = Array.from({ length: 4 }, (_, i) =>
          at(cell, start + i, dx, dy),
        ),
        left = at(cell, start - 1, dx, dy),
        right = at(cell, start + 4, dx, dy);
      if (
        left < 0 ||
        right < 0 ||
        next[left] !== -1 ||
        next[right] !== -1 ||
        cells.some((c) => c < 0 || (next[c] !== seat && next[c] !== -1))
      )
        continue;
      const stones = cells.filter((c) => next[c] === seat),
        empty = cells.filter((c) => next[c] === -1);
      if (stones.length !== 3 || empty.length !== 1) continue;
      // The extension itself must be legal: a forbidden extension is not an open three.
      if (forbiddenMove(next, empty[0], seat) !== null) continue;
      threes.add(stones.sort((a, b) => a - b).join(","));
    }
  return threes.size >= 2 ? "double-three" : null;
}
