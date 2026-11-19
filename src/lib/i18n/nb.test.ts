import { describe, expect, it } from "vitest";
import { en, translator } from "./index";
import { collectKeys } from "./keys";
import { nb } from "./nb";

const t = translator("nb");
const slots = (text: string) => [...text.matchAll(/\{(\d+)\}/g)].map((match) => match[1]).sort();

describe("the Norwegian table", () => {
  const keys = collectKeys(process.cwd());

  it("has every text the app can show", () => {
    const missing = [...keys].filter(([key]) => nb[key] === undefined).map(([key, where]) => `${where}  ${JSON.stringify(key)}`);
    expect(missing, "add these to src/lib/i18n/nb.ts").toEqual([]);
  });

  it("holds nothing the app no longer shows", () => {
    expect(Object.keys(nb).filter((key) => !keys.has(key))).toEqual([]);
  });

  it("only uses values the English text has", () => {
    const wrong = Object.entries(nb).filter(([key, value]) => slots(value).some((slot) => !slots(key).includes(slot)));
    expect(wrong).toEqual([]);
  });

  it("keeps the spaces a piece of a sentence starts and ends with", () => {
    const edge = (text: string) => [/^\s/.test(text), /\s$/.test(text)];
    expect(Object.entries(nb).filter(([key, value]) => edge(key).join() !== edge(value).join())).toEqual([]);
  });
});

describe("translator", () => {
  it("leaves English as it is written", () => {
    expect(en("Save")).toBe("Save");
    expect(en`${3} to buy`).toBe("3 to buy");
  });

  it("says a fixed text and a text with values in Norwegian", () => {
    expect(t("Save")).toBe("Lagre");
    expect(t`${3} to buy`).toBe("3 å kjøpe");
    // Norwegian puts the day before the time.
    expect(t`${"07:00"} on ${"torsdag"}`).toBe("torsdag kl. 07:00");
  });

  it("falls back to English for a text it does not have", () => {
    expect(t("A text nobody translated")).toBe("A text nobody translated");
  });

  it("recognises a sentence that was put together elsewhere", () => {
    expect(t.loose("Enter your name.")).toBe("Skriv inn navnet ditt.");
    expect(t.loose("Oat milk is already on the list.")).toBe("Oat milk står allerede på listen.");
    expect(t.loose("The parts add up to 250 kr, but the amount is 300 kr. Make them match.")).toBe("Delene blir til sammen 250 kr, men beløpet er 300 kr. Få dem til å stemme.");
    // Several messages at once, as the sign-up form sends them, stay readable.
    expect(t.loose("Something nobody wrote down.")).toBe("Something nobody wrote down.");
    expect(en.loose("Enter your name.")).toBe("Enter your name.");
  });
});
