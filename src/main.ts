import "./styles.css";
import { GameApp } from "./app/GameApp";
import { supportsWebGl2 } from "./core/webgl";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("#app fehlt in index.html.");

let game: GameApp | null = null;

if (!supportsWebGl2()) {
  showWebGlFallback(root);
} else {
  try {
    game = new GameApp(root);
    void game.bootstrap();
  } catch (error) {
    showWebGlFallback(root, error instanceof Error ? error.message : String(error));
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => game?.dispose());
}

function showWebGlFallback(target: HTMLElement, detail?: string): void {
  const main = document.createElement("main");
  main.className = "webgl-fallback";
  const panel = document.createElement("section");
  panel.className = "webgl-fallback__panel";
  panel.setAttribute("aria-labelledby", "webgl-title");
  const eyebrow = document.createElement("p");
  eyebrow.className = "webgl-fallback__eyebrow";
  eyebrow.textContent = "Stranded 2";
  const title = document.createElement("h1");
  title.id = "webgl-title";
  title.textContent = "WebGL2 wird benötigt";
  const message = document.createElement("p");
  message.textContent = "Dieser Browser oder Grafiktreiber kann die 3D-Spielwelt nicht darstellen. Aktualisiere den Browser und den Grafiktreiber oder aktiviere Hardwarebeschleunigung.";
  const details = document.createElement("p");
  details.className = "webgl-fallback__detail";
  details.textContent = detail ? `Technisches Detail: ${detail}` : "Chrome, Edge und Firefox unterstützen WebGL2 auf aktuellen Desktop-Systemen.";
  const actions = document.createElement("div");
  actions.className = "webgl-fallback__actions";
  const help = document.createElement("a");
  help.className = "webgl-fallback__action webgl-fallback__action--primary";
  help.href = "https://get.webgl.org/webgl2/";
  help.target = "_blank";
  help.rel = "noopener noreferrer";
  help.textContent = "WebGL2 prüfen";
  const retry = document.createElement("button");
  retry.className = "webgl-fallback__action";
  retry.type = "button";
  retry.textContent = "Erneut versuchen";
  retry.addEventListener("click", () => window.location.reload());
  actions.append(help, retry);
  panel.append(eyebrow, title, message, details, actions);
  main.append(panel);
  target.replaceChildren(main);
}
