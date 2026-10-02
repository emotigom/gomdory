export class Vector3 {
  constructor(x?: number, y?: number, z?: number);
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): this;
  clone(): Vector3;
}
export class Color {
  constructor(v?: number | string);
}
export const MathUtils: {
  clamp(value: number, min: number, max: number): number;
};
export const DoubleSide: number;
