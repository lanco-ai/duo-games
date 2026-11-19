// Web Push（RFC 8291 加密 + RFC 8292 VAPID），只用 node:crypto，不引第三方库。
import {
  createECDH,
  createPrivateKey,
  createCipheriv,
  hkdfSync,
  randomBytes,
  sign,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";

export interface PushKeys {
  publicKey: string; // 65 字节未压缩公钥，base64url
  privateKey: string; // 32 字节私钥，base64url
  subject: string; // mailto: 或 https: 联系地址
}
export interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const b64 = (b: Buffer) => b.toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url");

// 只向浏览器厂商的推送服务发请求，避免被当成任意地址的请求代理。
const HOSTS = [
  "push.apple.com",
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
];
export function validSubscription(v: any): v is Subscription {
  if (!v || typeof v.endpoint !== "string" || v.endpoint.length > 1024)
    return false;
  let url: URL;
  try {
    url = new URL(v.endpoint);
  } catch {
    return false;
  }
  if (
    url.protocol !== "https:" ||
    url.port ||
    !HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h))
  )
    return false;
  if (typeof v.keys?.p256dh !== "string" || typeof v.keys?.auth !== "string")
    return false;
  const p = unb64(v.keys.p256dh),
    a = unb64(v.keys.auth);
  return p.length === 65 && p[0] === 4 && a.length === 16;
}

export function generateKeys(subject: string): PushKeys {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  return {
    publicKey: b64(
      Buffer.concat([Buffer.from([4]), unb64(jwk.x!), unb64(jwk.y!)]),
    ),
    privateKey: jwk.d!,
    subject,
  };
}

export function loadKeys(file: string): PushKeys | null {
  try {
    const k = JSON.parse(readFileSync(file, "utf8"));
    if (
      unb64(k.publicKey).length === 65 &&
      unb64(k.privateKey).length === 32 &&
      /^(mailto:|https:)/.test(k.subject)
    )
      return k;
  } catch {}
  return null;
}

function hkdf(salt: Buffer, ikm: Buffer, info: string | Buffer, len: number) {
  return Buffer.from(hkdfSync("sha256", ikm, salt, info, len));
}

// RFC 8291 aes128gcm：单条记录，明文后接 0x02 分隔符。salt/私钥只在测试里传入。
export function encrypt(
  sub: Subscription,
  plaintext: Buffer,
  fixed?: { salt: Buffer; privateKey: Buffer },
) {
  const uaPublic = unb64(sub.keys.p256dh),
    auth = unb64(sub.keys.auth);
  const ecdh = createECDH("prime256v1");
  if (fixed) ecdh.setPrivateKey(fixed.privateKey);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const salt = fixed?.salt ?? randomBytes(16);
  const ikm = hkdf(
    auth,
    ecdh.computeSecret(uaPublic),
    Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]),
    32,
  );
  const key = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0", 16),
    nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0", 12);
  const cipher = createCipheriv("aes-128-gcm", key, nonce);
  const body = Buffer.concat([
    cipher.update(Buffer.concat([plaintext, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, body]);
}

function vapid(keys: PushKeys, key: KeyObject, endpoint: string, now: number) {
  const part = (v: object) => b64(Buffer.from(JSON.stringify(v)));
  const unsigned =
    part({ typ: "JWT", alg: "ES256" }) +
    "." +
    part({
      aud: new URL(endpoint).origin,
      exp: Math.floor(now / 1000) + 12 * 3600,
      sub: keys.subject,
    });
  const signature = sign("sha256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${unsigned}.${b64(signature)}, k=${keys.publicKey}`;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string; // 点开通知后打开的站内路径
  tag?: string; // 同一 tag 的通知会互相替换
}

// 发送结果：ok 已送达推送服务；gone 订阅已失效，应删除；error 暂时失败。
export type SendResult = "ok" | "gone" | "error";

export class Pusher {
  private key: KeyObject;
  constructor(
    readonly keys: PushKeys,
    private post: typeof fetch = fetch,
  ) {
    const pub = unb64(keys.publicKey);
    this.key = createPrivateKey({
      key: {
        kty: "EC",
        crv: "P-256",
        d: keys.privateKey,
        x: b64(pub.subarray(1, 33)),
        y: b64(pub.subarray(33)),
      },
      format: "jwk",
    });
  }
  async send(sub: Subscription, message: PushMessage): Promise<SendResult> {
    try {
      const res = await this.post(sub.endpoint, {
        method: "POST",
        headers: {
          Authorization: vapid(this.keys, this.key, sub.endpoint, Date.now()),
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          TTL: String(24 * 3600),
          Urgency: "normal",
          ...(message.tag ? { Topic: message.tag.slice(0, 32) } : {}),
        },
        body: encrypt(sub, Buffer.from(JSON.stringify(message))),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 404 || res.status === 410) return "gone";
      if (!res.ok)
        console.warn(
          "推送失败",
          new URL(sub.endpoint).hostname,
          res.status,
          (await res.text()).slice(0, 200),
        );
      return res.ok ? "ok" : "error";
    } catch (e) {
      console.warn("推送失败", new URL(sub.endpoint).hostname, String(e));
      return "error";
    }
  }
}
