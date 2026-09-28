// D1 placeholder (Ryan, by Oct 4). The one place the membership price and trial length live; N6 bills from it.
export const PRICING: { monthlyCents: number; trialDays: number } = { monthlyCents: 5000, trialDays: 7 };

export function formatUsd(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen"];

// "Seven days free." Spelled out at the start of a sentence, digits past fourteen.
export const countWord = (n: number) => WORDS[n] ?? String(n);
