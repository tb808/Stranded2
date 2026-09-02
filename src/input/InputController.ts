export type InputAction =
  | "forward"
  | "backward"
  | "left"
  | "right"
  | "sprint"
  | "jump"
  | "dive"
  | "interact"
  | "attack"
  | "inventory"
  | "crafting"
  | "building"
  | "map"
  | "rotate"
  | "pause"
  | "hotbar1"
  | "hotbar2"
  | "hotbar3"
  | "hotbar4";

export interface InputSnapshot {
  held: ReadonlySet<InputAction>;
  pressed: ReadonlySet<InputAction>;
  lookDeltaX: number;
  lookDeltaY: number;
}

const KEY_BINDINGS: Readonly<Record<string, InputAction>> = {
  KeyW: "forward",
  KeyS: "backward",
  KeyA: "left",
  KeyD: "right",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  Space: "jump",
  ControlLeft: "dive",
  ControlRight: "dive",
  KeyE: "interact",
  Tab: "inventory",
  KeyC: "crafting",
  KeyB: "building",
  KeyM: "map",
  KeyR: "rotate",
  Escape: "pause",
  Digit1: "hotbar1",
  Digit2: "hotbar2",
  Digit3: "hotbar3",
  Digit4: "hotbar4",
};

export class InputController {
  private readonly held = new Set<InputAction>();
  private readonly pressed = new Set<InputAction>();
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private enabled = false;
  private sensitivity = 0.0022;
  private invertY = false;

  public constructor(private readonly element: HTMLElement) {}

  public attach(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    document.addEventListener("mousemove", this.onMouseMove);
    this.element.addEventListener("mousedown", this.onMouseDown);
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    this.element.removeEventListener("mousedown", this.onMouseDown);
    this.clear();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  public setLookSettings(sensitivity: number, invertY: boolean): void {
    this.sensitivity = sensitivity;
    this.invertY = invertY;
  }

  public consume(): InputSnapshot {
    const snapshot: InputSnapshot = {
      held: new Set(this.held),
      pressed: new Set(this.pressed),
      lookDeltaX: this.lookDeltaX * this.sensitivity,
      lookDeltaY: this.lookDeltaY * this.sensitivity * (this.invertY ? -1 : 1),
    };
    this.pressed.clear();
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    return snapshot;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS[event.code];
    if (!action || !this.enabled) return;
    if (!event.repeat) this.pressed.add(action);
    this.held.add(action);
    if (["Space", "Tab"].includes(event.code)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS[event.code];
    if (action) this.held.delete(action);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.enabled || document.pointerLockElement !== this.element) return;
    this.lookDeltaX += event.movementX;
    this.lookDeltaY += event.movementY;
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (!this.enabled || event.button !== 0) return;
    this.pressed.add("attack");
  };

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") this.clear();
  };

  private readonly clear = (): void => {
    this.held.clear();
    this.pressed.clear();
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
  };
}
