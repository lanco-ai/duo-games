import { describe, expect, it } from "vitest";
import { createPublicKey, verify } from "node:crypto";
import {
  encrypt,
  generateKeys,
  Pusher,
  validSubscription,
} from "../../server/push";

const u = (s: string) => Buffer.from(s, "base64url");

describe("web push", () => {
  it("matches the RFC 8291 appendix A example", () => {
    const body = encrypt(
      {
        endpoint:
          "https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV",
        keys: {
          p256dh:
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
          auth: "BTBZMqHH6r4Tts7J_aSIgg",
        },
      },
      Buffer.from("When I grow up, I want to be a watermelon"),
      {
        salt: u("DGv6ra1nlYgDCS1FRnbzlw"),
        privateKey: u("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"),
      },
    );
    expect(body.toString("base64url")).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });

  it("accepts only push-service endpoints with well-formed keys", () => {
    const keys = {
      p256dh: generateKeys("mailto:a@example.com").publicKey,
      auth: "BTBZMqHH6r4Tts7J_aSIgg",
    };
    const ok = (endpoint: string) => validSubscription({ endpoint, keys });
    expect(ok("https://web.push.apple.com/QK1x")).toBe(true);
    expect(ok("https://fcm.googleapis.com/fcm/send/x")).toBe(true);
    expect(ok("http://web.push.apple.com/x")).toBe(false);
    expect(ok("https://web.push.apple.com:444/x")).toBe(false);
    expect(ok("https://evilpush.apple.com.example/x")).toBe(false);
    expect(ok("https://127.0.0.1/x")).toBe(false);
    expect(
      validSubscription({
        endpoint: "https://web.push.apple.com/x",
        keys: { ...keys, auth: "short" },
      }),
    ).toBe(false);
  });

  it("signs a VAPID token the push service can verify", async () => {
    const keys = generateKeys("https://example.com/");
    const sent: { url: string; init: RequestInit }[] = [];
    const pusher = new Pusher(keys, (async (url: string, init: RequestInit) => {
      sent.push({ url, init });
      return new Response(null, { status: 201 });
    }) as typeof fetch);
    const sub = {
      endpoint: "https://web.push.apple.com/abc",
      keys: {
        p256dh: generateKeys("mailto:a@example.com").publicKey,
        auth: "BTBZMqHH6r4Tts7J_aSIgg",
      },
    };
    expect(await pusher.send(sub, { title: "t", body: "b", url: "/" })).toBe(
      "ok",
    );
    const headers = sent[0].init.headers as Record<string, string>;
    const [, t, k] = headers.Authorization.match(/^vapid t=(.+), k=(.+)$/)!;
    expect(k).toBe(keys.publicKey);
    const [h, c, s] = t.split(".");
    const claims = JSON.parse(u(c).toString());
    expect(claims.aud).toBe("https://web.push.apple.com");
    expect(claims.sub).toBe("https://example.com/");
    const pub = u(keys.publicKey);
    const key = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: pub.subarray(1, 33).toString("base64url"),
        y: pub.subarray(33).toString("base64url"),
      },
      format: "jwk",
    });
    expect(
      verify(
        "sha256",
        Buffer.from(h + "." + c),
        { key, dsaEncoding: "ieee-p1363" },
        u(s),
      ),
    ).toBe(true);
    expect(headers["Content-Encoding"]).toBe("aes128gcm");

    const gone = new Pusher(
      keys,
      (async () =>
        new Response(null, { status: 410 })) as unknown as typeof fetch,
    );
    expect(await gone.send(sub, { title: "t", body: "b", url: "/" })).toBe(
      "gone",
    );
  });
});
