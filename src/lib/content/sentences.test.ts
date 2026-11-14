import { describe, expect, it } from "vitest";
import { sentencesOf } from "./sentences";
import { closingFor, isClosingSentence, saysTheEnd } from "./the-end";

describe("sentencesOf", () => {
  it("keeps English splitting as it was", () => {
    expect(sentencesOf("Mr. Brown came. “Hello!” he said. Then they slept.")).toEqual(["Mr. Brown came.", "“Hello!” he said.", "Then they slept."]);
  });

  it("splits Spanish before opening marks and accented capitals", () => {
    expect(sentencesOf("Era tarde. ¿Quién llama? ¡Ábreme! —Buenas noches... «Ven», dijo. Él calló.", "es")).toEqual([
      "Era tarde.",
      "¿Quién llama?",
      "¡Ábreme!",
      "—Buenas noches...",
      "«Ven», dijo.",
      "Él calló.",
    ]);
  });

  it("does not split where the sentence runs on in lower case", () => {
    expect(sentencesOf("Le dijo «¡ven!» y se fue... a la cama.", "es")).toHaveLength(1);
  });
});

describe("closing sentence", () => {
  it("is The End. in English and Fin. in Spanish", () => {
    expect(closingFor()).toBe("The End.");
    expect(closingFor("es")).toBe("Fin.");
    expect(isClosingSentence("Fin.") && isClosingSentence("The End.")).toBe(true);
    expect(saysTheEnd("¡Fin!") && saysTheEnd("The end")).toBe(true);
    expect(saysTheEnd("Final feliz")).toBe(false);
  });
});
