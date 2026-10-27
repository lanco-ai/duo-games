import { localStore } from "./storage";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { Home } from "./Home";
import { Room } from "./Room";
import { api, BASE, IS_PREVIEW, roomStorageKey } from "./api";
import "./style.css";
const path = location.pathname.slice(BASE.length),
  code = path.match(/^r\/([23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6})\/?$/)?.[1];
function App() {
  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let clientId = localStore.getItem(roomStorageKey("presenceClient"));
    if (!clientId || !/^[a-f0-9]{32}$/.test(clientId)) {
      clientId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join("");
      localStore.setItem(roomStorageKey("presenceClient"), clientId);
    }
    const pulse = async () => {
      try {
        const result = await api("presence", "POST", { clientId });
        if (active) setOnline(result.online);
      } catch {
        if (active) setOnline(null);
      }
      if (active) timer = setTimeout(pulse, 15_000);
    };
    void pulse();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  return (
    <>
      {IS_PREVIEW && (
        <div class="preview-notice">
          测试版 · 房间和战绩与正式站分开保存 <a href="/duo/">返回正式站</a>
        </div>
      )}
      {code ? <Room code={code} /> : <Home online={online} />}
    </>
  );
}
render(<App />, document.getElementById("app")!);
