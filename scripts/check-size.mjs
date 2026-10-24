import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const manifest = JSON.parse(
    readFileSync("dist/web/.vite/manifest.json", "utf8"),
  ),
  sizes = new Map();
function size(file) {
  if (!sizes.has(file))
    sizes.set(file, gzipSync(readFileSync("dist/web/" + file)).length);
  return sizes.get(file);
}
function graph(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const child of manifest[key].imports || []) graph(child, seen);
  return seen;
}
const entry = Object.keys(manifest).find((k) => manifest[k].isEntry),
  initial = graph(entry),
  js = [...initial].reduce((sum, k) => sum + size(manifest[k].file), 0),
  cssFiles = new Set([...initial].flatMap((k) => manifest[k].css || [])),
  css = [...cssFiles].reduce((sum, k) => sum + size(k), 0);
for (const [key, value] of Object.entries(manifest)) {
  if (!value.file.endsWith(".js")) continue;
  const total = [...graph(key)]
    .filter((k) => !initial.has(k))
    .reduce((sum, k) => sum + size(manifest[k].file), 0);
  console.log(
    value.file + ": " + (size(value.file) / 1024).toFixed(2) + " KiB gzip",
  );
  if (total > 80 * 1024) throw new Error("Lazy graph exceeds 80 KiB: " + key);
}
if (js > 60 * 1024 || css > 15 * 1024)
  throw new Error("Initial asset budget exceeded");
console.log(
  "PASS initial JS " +
    (js / 1024).toFixed(2) +
    " KiB; CSS " +
    (css / 1024).toFixed(2) +
    " KiB gzip",
);
