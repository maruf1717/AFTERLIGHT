/**
 * Trigonometry that gives bit-for-bit the same answer in every browser.
 *
 * JavaScript lets each engine compute Math.sin, Math.cos, Math.atan2 and Math.hypot its own
 * way, and Safari, Chrome and Firefox do differ in the last digits. The city plan is built from
 * these numbers and every device must build the very same plan (parcel ids are written into the
 * shared ledger), so the plan and the rules use these functions instead. They only use + - * /
 * and Math.sqrt, which every engine must round exactly the same way.
 */

const PI = 3.141592653589793
const HALF_PI = 1.5707963267948966
const QUARTER_PI = 0.7853981633974483
const TWO_PI = 6.283185307179586

/** sin on [-π/4, π/4] (Taylor series, error well below 1e-15). */
function sinCore(x: number) {
  const x2 = x * x
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000))))))))
}

/** cos on [-π/4, π/4]. */
function cosCore(x: number) {
  const x2 = x * x
  return 1 + x2 * (-1 / 2 + x2 * (1 / 24 + x2 * (-1 / 720 + x2 * (1 / 40320 + x2 * (-1 / 3628800 + x2 * (1 / 479001600 + x2 * (-1 / 87178291200 + x2 / 20922789888000)))))))
}

/** Split x into a quarter turn count and a remainder in [-π/4, π/4]. */
function reduce(x: number): [number, number] {
  const turns = Math.round(x / TWO_PI)
  let r = x - turns * TWO_PI
  const q = Math.round(r / HALF_PI)
  r -= q * HALF_PI
  return [((q % 4) + 4) % 4, r]
}

export function sin(x: number) {
  if (!Number.isFinite(x)) return NaN
  const [q, r] = reduce(x)
  return q === 0 ? sinCore(r) : q === 1 ? cosCore(r) : q === 2 ? -sinCore(r) : -cosCore(r)
}

export function cos(x: number) {
  if (!Number.isFinite(x)) return NaN
  const [q, r] = reduce(x)
  return q === 0 ? cosCore(r) : q === 1 ? -sinCore(r) : q === 2 ? -cosCore(r) : sinCore(r)
}

/** atan for any x. */
export function atan(x: number): number {
  if (Number.isNaN(x)) return NaN
  if (x < 0) return -atan(-x)
  if (x > 1) return HALF_PI - atan(1 / x)
  // Halve the angle twice (tan(a/2) = t / (1 + √(1 + t²))) so the series converges fast.
  let t = x / (1 + Math.sqrt(1 + x * x))
  t = t / (1 + Math.sqrt(1 + t * t))
  const t2 = t * t
  let term = t
  let sum = t
  for (let k = 1; k <= 12; k++) {
    term *= -t2
    sum += term / (2 * k + 1)
  }
  return 4 * sum
}

export function atan2(y: number, x: number) {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN
  if (x > 0) return atan(y / x)
  if (x < 0) return y >= 0 ? atan(y / x) + PI : atan(y / x) - PI
  return y > 0 ? HALF_PI : y < 0 ? -HALF_PI : 0
}

export function hypot(x: number, y: number) {
  return Math.sqrt(x * x + y * y)
}

export { PI, HALF_PI, QUARTER_PI }
