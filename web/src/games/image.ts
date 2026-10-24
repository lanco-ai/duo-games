import { useEffect, useState } from "preact/hooks";
import { BASE } from "../api";
export function usePicture(id: string, code: string, token: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      url = "";
    setImage(null);
    setError("");
    void (async () => {
      try {
        let src: string;
        if (id.startsWith("scene:"))
          src = BASE + "scenes/" + id.slice(6) + ".svg";
        else {
          const r = await fetch(BASE + "api/rooms/" + code + "/images/" + id, {
            headers: { Authorization: "Bearer " + token },
          });
          if (!r.ok) throw new Error("照片暂时无法打开");
          src = url = URL.createObjectURL(await r.blob());
        }
        const img = new Image();
        img.src = src;
        await img.decode();
        if (active) setImage(img);
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, code, token]);
  return { image, error };
}
export function downloadCanvas(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.download = name + ".png";
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
}
