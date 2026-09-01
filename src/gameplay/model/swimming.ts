import { clamp } from '../../core/math';

export interface SwimmingMotionInput {
  yaw: number;
  pitch: number;
  forwardAxis: number;
  rightAxis: number;
  speed: number;
  buoyancy: number;
  ascend: boolean;
  descend: boolean;
}

export interface SwimmingMotion {
  x: number;
  z: number;
  vertical: number;
}

export function calculateSwimmingMotion(input: SwimmingMotionInput): SwimmingMotion {
  const pitch = clamp(input.pitch, -Math.PI / 2, Math.PI / 2);
  const horizontalLook = Math.cos(pitch);
  let x = -Math.sin(input.yaw) * horizontalLook * input.forwardAxis
    + Math.cos(input.yaw) * input.rightAxis;
  let z = -Math.cos(input.yaw) * horizontalLook * input.forwardAxis
    - Math.sin(input.yaw) * input.rightAxis;
  let y = Math.sin(pitch) * input.forwardAxis;
  const length = Math.hypot(x, y, z);
  if (length > 1) {
    x /= length;
    y /= length;
    z /= length;
  }

  let vertical = y * input.speed;
  const hasVerticalLookIntent = input.forwardAxis !== 0 && Math.abs(pitch) >= 0.12;
  if (!hasVerticalLookIntent) vertical += input.buoyancy;
  if (input.ascend) vertical = Math.max(vertical, 2.8);
  else if (input.descend) vertical = Math.min(vertical, -2.4);

  return { x: x * input.speed, z: z * input.speed, vertical };
}
