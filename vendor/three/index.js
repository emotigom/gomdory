class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
}
class Color { constructor(v = 0) { this.value = v; } }
const MathUtils = { clamp: (v, min, max) => Math.min(Math.max(v, min), max) };
const DoubleSide = 2;
module.exports = { Vector3, Color, MathUtils, DoubleSide };
