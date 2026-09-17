// NPI check digit is Luhn over "80840" + the 9-digit base; 24 is the prefix's fixed contribution.
function checkDigit(base9: string): number {
  let sum = 24;
  for (let i = 0; i < 9; i++) {
    const d = Number(base9[8 - i]);
    if (i % 2 === 0) {
      const doubled = d * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += d;
    }
  }
  return (10 - (sum % 10)) % 10;
}

export function npiFromBase(base9: string): string {
  if (!/^\d{9}$/.test(base9)) throw new Error("NPI base must be 9 digits");
  return base9 + checkDigit(base9);
}

export function isValidNpi(npi: string): boolean {
  if (!/^[12]\d{9}$/.test(npi)) return false;
  return checkDigit(npi.slice(0, 9)) === Number(npi[9]);
}
