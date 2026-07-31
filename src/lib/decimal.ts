const DEFAULT_SCALE = 18;
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_TEN = BigInt(10);

function pow10(scale: number) {
  let value = BIGINT_ONE;
  for (let index = 0; index < scale; index += 1) value *= BIGINT_TEN;
  return value;
}

function expandExponent(value: string) {
  const match = value.match(/^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/);
  if (!match) return value;

  const sign = match[1] === "-" ? "-" : "";
  const integer = match[2];
  const fraction = match[3] ?? "";
  const exponent = Number(match[4]);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 100) {
    throw new Error("Decimal exponent is out of range.");
  }

  const digits = `${integer}${fraction}`;
  const decimalIndex = integer.length + exponent;
  if (decimalIndex <= 0) return `${sign}0.${"0".repeat(-decimalIndex)}${digits}`;
  if (decimalIndex >= digits.length) return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

export function decimalToAtoms(value: string | number | bigint, scale = DEFAULT_SCALE) {
  const raw = expandExponent(String(value).trim());
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d*))?$/);
  if (!match) throw new Error("Invalid decimal value.");

  const sign = match[1] === "-" ? -BIGINT_ONE : BIGINT_ONE;
  const integer = BigInt(match[2]);
  const fraction = (match[3] ?? "").slice(0, scale).padEnd(scale, "0");
  return sign * (integer * pow10(scale) + BigInt(fraction || "0"));
}

export function atomsToDecimal(value: bigint, scale = DEFAULT_SCALE) {
  if (value === BIGINT_ZERO) return "0";
  const sign = value < BIGINT_ZERO ? "-" : "";
  const absolute = value < BIGINT_ZERO ? -value : value;
  const base = pow10(scale);
  const integer = absolute / base;
  const fraction = (absolute % base).toString().padStart(scale, "0").replace(/0+$/, "");
  return `${sign}${integer}${fraction ? `.${fraction}` : ""}`;
}

export function normalizeDecimal(value: string | number | bigint) {
  return atomsToDecimal(decimalToAtoms(value));
}

export function addDecimal(...values: Array<string | number | bigint>) {
  return atomsToDecimal(values.reduce<bigint>((sum, value) => sum + decimalToAtoms(value), BIGINT_ZERO));
}

export function subtractDecimal(left: string | number | bigint, right: string | number | bigint) {
  return atomsToDecimal(decimalToAtoms(left) - decimalToAtoms(right));
}

export function multiplyDecimal(left: string | number | bigint, right: string | number | bigint) {
  const base = pow10(DEFAULT_SCALE);
  return atomsToDecimal((decimalToAtoms(left) * decimalToAtoms(right)) / base);
}

export function divideDecimal(left: string | number | bigint, right: string | number | bigint) {
  const denominator = decimalToAtoms(right);
  if (denominator === BIGINT_ZERO) throw new Error("Cannot divide by zero.");
  const base = pow10(DEFAULT_SCALE);
  return atomsToDecimal((decimalToAtoms(left) * base) / denominator);
}

export function compareDecimal(left: string | number | bigint, right: string | number | bigint) {
  const difference = decimalToAtoms(left) - decimalToAtoms(right);
  return difference < BIGINT_ZERO ? -1 : difference > BIGINT_ZERO ? 1 : 0;
}

export function absDecimal(value: string | number | bigint) {
  const atoms = decimalToAtoms(value);
  return atomsToDecimal(atoms < BIGINT_ZERO ? -atoms : atoms);
}

export function negateDecimal(value: string | number | bigint) {
  return atomsToDecimal(-decimalToAtoms(value));
}

export function minDecimal(left: string | number | bigint, right: string | number | bigint) {
  return compareDecimal(left, right) <= 0 ? normalizeDecimal(left) : normalizeDecimal(right);
}

export function isZeroDecimal(value: string | number | bigint) {
  return decimalToAtoms(value) === BIGINT_ZERO;
}
