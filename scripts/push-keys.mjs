// 生成推送密钥（VAPID）。用法：node scripts/push-keys.mjs <联系地址> <密钥文件>
// 例：sudo -u duo-games node scripts/push-keys.mjs https://example.com/ /var/lib/duo-games/push-keys.json
// 已有密钥时拒绝覆盖：换密钥会让所有设备的提醒失效，需要重新开启。
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";

const [subject, file] = process.argv.slice(2);
if (!/^(mailto:|https:\/\/)/.test(subject || "") || !file) {
  console.error(
    "用法：node scripts/push-keys.mjs <mailto:… 或 https://…> <密钥文件>",
  );
  process.exit(1);
}
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = privateKey.export({ format: "jwk" });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, "base64url"),
  Buffer.from(jwk.y, "base64url"),
]).toString("base64url");
try {
  writeFileSync(
    file,
    JSON.stringify({ publicKey, privateKey: jwk.d, subject }) + "\n",
    {
      flag: "wx",
      mode: 0o600,
    },
  );
} catch (e) {
  console.error(e.code === "EEXIST" ? `${file} 已存在，未覆盖。` : e.message);
  process.exit(1);
}
console.log(`已写入 ${file}，公钥 ${publicKey}`);
