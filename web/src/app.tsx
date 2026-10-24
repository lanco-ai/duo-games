import { render } from "preact";
import { Home } from "./Home";
import { Room } from "./Room";
import { BASE, IS_PREVIEW } from "./api";
import "./style.css";
const path = location.pathname.slice(BASE.length),
  code = path.match(/^r\/([23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6})\/?$/)?.[1];
render(
  <>
    {IS_PREVIEW && (
      <div class="preview-notice">
        测试版 · 房间和战绩与正式站分开保存 <a href="/duo/">返回正式站</a>
      </div>
    )}
    {code ? <Room code={code} /> : <Home />}
  </>,
  document.getElementById("app")!,
);
