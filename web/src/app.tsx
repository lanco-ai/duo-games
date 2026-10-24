import { render } from "preact";
import { Home } from "./Home";
import { Room } from "./Room";
import { BASE } from "./api";
import "./style.css";
const path = location.pathname.slice(BASE.length),
  code = path.match(/^r\/([23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6})\/?$/)?.[1];
render(code ? <Room code={code} /> : <Home />, document.getElementById("app")!);
