import { describe, expect, it } from "vitest";
import {
  durationGuidance,
  formatClock,
  initialRecorderState,
  recorderReducer,
  type RecorderAction,
  type RecorderState,
} from "./recorder-machine";

function run(actions: RecorderAction[], from: RecorderState = initialRecorderState): RecorderState {
  return actions.reduce(recorderReducer, from);
}

const consented: RecorderAction[] = [
  { type: "set_consent", field: "adultOwner", value: true },
  { type: "set_consent", field: "processing", value: true },
  { type: "accept_consent" },
];

describe("consent gate", () => {
  it("blocks recording until both declarations are ticked", () => {
    const s = run([{ type: "set_consent", field: "adultOwner", value: true }, { type: "accept_consent" }, { type: "start" }]);
    expect(s.status).toBe("consent");
  });

  it("moves to ready with both declarations", () => {
    expect(run(consented).status).toBe("ready");
  });

  it("cannot be skipped with Start over", () => {
    expect(run([{ type: "start_over" }]).status).toBe("consent");
  });
});

describe("continuous take", () => {
  it("records, pauses and resumes in one take without any next-prompt step", () => {
    const s = run([
      ...consented,
      { type: "start" },
      { type: "tick", deltaMs: 30_000 },
      { type: "pause" },
      { type: "tick", deltaMs: 10_000 },
      { type: "resume" },
      { type: "tick", deltaMs: 40_000 },
      { type: "finish" },
    ]);
    expect(s.status).toBe("review");
    expect(s.elapsedMs).toBe(70_000); // paused time excluded
    expect(s.pauseCount).toBe(1);
  });

  it("can finish while paused", () => {
    expect(
      run([...consented, { type: "start" }, { type: "tick", deltaMs: 60_000 }, { type: "pause" }, { type: "finish" }]).status,
    ).toBe("review");
  });

  it("won't finish before the one-minute minimum", () => {
    const s = run([...consented, { type: "start" }, { type: "tick", deltaMs: 59_000 }, { type: "finish" }]);
    expect(s.status).toBe("recording");
  });

  it("start over resets the take but keeps consent", () => {
    const s = run([...consented, { type: "start" }, { type: "tick", deltaMs: 5_000 }, { type: "start_over" }]);
    expect(s).toMatchObject({ status: "ready", elapsedMs: 0, pauseCount: 0, take: 1 });
    expect(s.consent).toEqual({ adultOwner: true, processing: true });
  });

  it("ignores negative ticks and ticks while paused", () => {
    const s = run([...consented, { type: "start" }, { type: "tick", deltaMs: -50 }, { type: "pause" }, { type: "tick", deltaMs: 999 }]);
    expect(s.elapsedMs).toBe(0);
  });
});

describe("duration guidance", () => {
  it("targets 60 to 120 seconds without a hard cut-off", () => {
    expect(durationGuidance(59_999)).toBe("too_short");
    expect(durationGuidance(60_000)).toBe("in_range");
    expect(durationGuidance(120_000)).toBe("in_range");
    expect(durationGuidance(150_000)).toBe("long");
  });

  it("formats the clock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65_400)).toBe("1:05");
  });
});
