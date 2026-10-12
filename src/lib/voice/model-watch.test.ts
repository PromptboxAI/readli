import { describe, expect, it } from "vitest";
import { readModels } from "./model-watch";

describe("ElevenLabs model watch", () => {
  it("flags models Readli doesn't know yet and marks the one in use", () => {
    const models = readModels(
      [
        { model_id: "eleven_multilingual_v2", name: "Multilingual v2", can_do_text_to_speech: true },
        { model_id: "eleven_v4", name: "Eleven v4", can_do_text_to_speech: true },
        { model_id: "eleven_v5", name: "Eleven v5", description: "Newest", can_do_text_to_speech: true },
        { model_id: "eleven_english_sts_v9", name: "Speech to speech", can_do_text_to_speech: false },
      ],
      "eleven_v4",
    );
    expect(models.map((m) => m.id)).toEqual(["eleven_v5", "eleven_v4", "eleven_multilingual_v2"]);
    expect(models[0]).toMatchObject({ isNew: true, inUse: false });
    expect(models[1]).toMatchObject({ isNew: false, inUse: true });
    expect(readModels({ error: "nope" }, "eleven_v4")).toEqual([]);
  });
});
