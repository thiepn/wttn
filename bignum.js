(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WTTNMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LOG10_MAX_NUMBER = Math.log10(Number.MAX_VALUE);

  class BigNum {
    constructor(log10 = null) {
      this.log10 = log10 === -Infinity ? null : log10;
    }
    static zero() { return new BigNum(null); }
    static one() { return new BigNum(0); }
    static fromLog10(log10) {
      return Number.isFinite(log10) ? new BigNum(log10) : (log10 === -Infinity ? BigNum.zero() : new BigNum(log10));
    }
    static from(value) {
      if (value instanceof BigNum) return value.clone();
      if (value && typeof value === 'object') {
        if (value.zero === true) return BigNum.zero();
        if (typeof value.log10 === 'number' || value.log10 === null) return new BigNum(value.log10);
      }
      if (value === null || value === undefined) return BigNum.zero();
      if (typeof value === 'number') {
        if (value <= 0) return BigNum.zero();
        return new BigNum(Math.log10(value));
      }
      if (typeof value === 'string') {
        const s = value.trim().toLowerCase();
        if (s === '0' || s === '0.0') return BigNum.zero();
        const match = s.match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+))(?:e([+-]?\d+(?:\.\d+)?))?$/);
        if (!match) throw new Error(`Unsupported BigNum literal: ${value}`);
        const mantissa = Number(match[1]);
        const exponent = match[2] ? Number(match[2]) : 0;
        if (!(mantissa > 0)) return BigNum.zero();
        return new BigNum(Math.log10(mantissa) + exponent);
      }
      throw new TypeError(`Cannot convert ${typeof value} to BigNum`);
    }
    clone() { return new BigNum(this.log10); }
    get isZero() { return this.log10 === null; }
    cmp(other) {
      other = BigNum.from(other);
      if (this.isZero && other.isZero) return 0;
      if (this.isZero) return -1;
      if (other.isZero) return 1;
      return Math.sign(this.log10 - other.log10);
    }
    gt(other) { return this.cmp(other) > 0; }
    gte(other) { return this.cmp(other) >= 0; }
    lt(other) { return this.cmp(other) < 0; }
    lte(other) { return this.cmp(other) <= 0; }
    eq(other, eps = 1e-12) {
      other = BigNum.from(other);
      if (this.isZero || other.isZero) return this.isZero === other.isZero;
      return Math.abs(this.log10 - other.log10) <= eps;
    }
    add(other) {
      other = BigNum.from(other);
      if (this.isZero) return other;
      if (other.isZero) return this.clone();
      const hi = Math.max(this.log10, other.log10);
      const lo = Math.min(this.log10, other.log10);
      if (hi - lo > 16) return new BigNum(hi);
      return new BigNum(hi + Math.log10(1 + 10 ** (lo - hi)));
    }
    sub(other) {
      other = BigNum.from(other);
      if (other.isZero) return this.clone();
      if (this.lte(other)) return BigNum.zero();
      const diff = other.log10 - this.log10;
      if (diff < -16) return this.clone();
      return new BigNum(this.log10 + Math.log10(1 - 10 ** diff));
    }
    mul(other) {
      other = BigNum.from(other);
      if (this.isZero || other.isZero) return BigNum.zero();
      return new BigNum(this.log10 + other.log10);
    }
    div(other) {
      other = BigNum.from(other);
      if (other.isZero) throw new Error('Division by zero');
      if (this.isZero) return BigNum.zero();
      return new BigNum(this.log10 - other.log10);
    }
    pow(power) {
      if (power === 0) return BigNum.one();
      if (this.isZero) return BigNum.zero();
      return new BigNum(this.log10 * power);
    }
    max(other) { return this.gte(other) ? this.clone() : BigNum.from(other); }
    min(other) { return this.lte(other) ? this.clone() : BigNum.from(other); }
    floor() {
      if (this.isZero) return BigNum.zero();
      if (this.log10 >= 15) return this.clone();
      return BigNum.from(Math.floor(this.toNumber()));
    }
    toNumber() {
      if (this.isZero) return 0;
      if (this.log10 > LOG10_MAX_NUMBER) return Infinity;
      return 10 ** this.log10;
    }
    toJSON() { return this.isZero ? { zero: true } : { log10: this.log10 }; }
    format(digits = 3) {
      if (this.isZero) return '0';
      if (!Number.isFinite(this.log10)) return 'Infinity';
      if (this.log10 >= -3 && this.log10 < 6) {
        return this.toNumber().toLocaleString('en-US', { maximumFractionDigits: digits });
      }
      const exponent = Math.floor(this.log10);
      const mantissa = 10 ** (this.log10 - exponent);
      return `${mantissa.toFixed(digits)}e${exponent}`;
    }
  }

  const bn = value => BigNum.from(value);
  function piecewiseLogCost({ baseLog10 = 0, slope = 0.1, quadratic = [], cubic = [] }, owned) {
    let log = baseLog10 + slope * owned;
    for (const term of quadratic) {
      const x = Math.max(0, owned - term.start);
      log += term.coefficient * x * x;
    }
    for (const term of cubic) {
      const x = Math.max(0, owned - term.start);
      log += term.coefficient * x * x * x;
    }
    return BigNum.fromLog10(log);
  }
  function softcap(value, threshold, power) {
    value = bn(value); threshold = bn(threshold);
    if (value.lte(threshold)) return value;
    return threshold.mul(value.div(threshold).pow(power));
  }

  return { BigNum, bn, piecewiseLogCost, softcap };
});
