"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickMimeType } from "@/lib/audio/mime";
import { createLevelTracker, evaluateLevels, type QcResult } from "@/lib/audio/qc";

export type MicError = "unsupported" | "insecure" | "denied" | "no_device" | "in_use" | "interrupted" | "unknown";

export interface RecordedTake {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  qc: QcResult;
}

export const MIC_ERROR_MESSAGES: Record<MicError, string> = {
  unsupported: "This browser can't record audio. Try the latest Safari, Chrome or Edge.",
  insecure: "Recording needs a secure (https) page.",
  denied:
    "Microphone access was blocked. Allow the microphone for this site in your browser settings (on iPhone: Settings > Safari > Microphone), then try again.",
  no_device: "We couldn't find a microphone. Plug one in or check your device's sound settings.",
  in_use: "Another app is using the microphone. Close it (or end the call) and try again.",
  interrupted: "The microphone stopped, maybe because of a call or a headset change. Your take is paused.",
  unknown: "Something went wrong starting the microphone. Please try again.",
};

/**
 * Capture-only voice settings. Browser noise suppression and auto gain can add
 * artefacts a voice clone would copy, so they are off; echo cancellation stays
 * on because nothing should be playing anyway.
 */
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
};

function classify(err: unknown): MicError {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no_device";
  if (name === "NotReadableError" || name === "AbortError") return "in_use";
  return "unknown";
}

/**
 * Microphone + MediaRecorder for the teleprompter. Exposes the live level as a
 * ref (not state) so the meter animates without re-rendering the page.
 */
export function useMicrophone({ onInterrupted }: { onInterrupted?: () => void } = {}) {
  const [error, setError] = useState<MicError | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const levelRef = useRef(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const trackerRef = useRef<ReturnType<typeof createLevelTracker> | null>(null);
  const capturingRef = useRef(false);
  const recordedMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const onInterruptedRef = useRef(onInterrupted);
  onInterruptedRef.current = onInterrupted;

  const close = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    levelRef.current = 0;
    setIsOpen(false);
  }, []);

  useEffect(() => close, [close]);

  const open = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    setError(null);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(window.isSecureContext === false ? "insecure" : "unsupported");
      return false;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
    } catch (err) {
      setError(classify(err));
      return false;
    }
    streamRef.current = stream;

    const interrupted = () => {
      if (capturingRef.current) onInterruptedRef.current?.();
    };
    for (const track of stream.getAudioTracks()) {
      track.addEventListener("ended", () => {
        setError("interrupted");
        interrupted();
      });
      // iOS mutes the track during a phone call or Siri.
      track.addEventListener("mute", interrupted);
    }

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let last = performance.now();
    const loop = (now: number) => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i] ?? 0);
        if (v > peak) peak = v;
      }
      levelRef.current = Math.min(1, peak);
      if (capturingRef.current) trackerRef.current?.push(levelRef.current, Math.min(now - last, 100));
      last = now;
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    setIsOpen(true);
    return true;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (!(await open())) return false;
    const stream = streamRef.current;
    if (!stream) return false;
    await audioCtxRef.current?.resume(); // Safari starts contexts suspended
    const mimeType = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 192_000 }) : new MediaRecorder(stream);
    } catch {
      setError("unsupported");
      return false;
    }
    // Each recorder gets its own array so late chunks from a discarded take never leak into the next.
    const chunks: Blob[] = [];
    chunksRef.current = chunks;
    trackerRef.current = createLevelTracker();
    recordedMsRef.current = 0;
    recorder.addEventListener("dataavailable", (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    });
    recorder.addEventListener("error", () => {
      setError("interrupted");
      onInterruptedRef.current?.();
    });
    // 1s timeslices keep memory bounded and allow segment uploads later.
    recorder.start(1000);
    recorderRef.current = recorder;
    capturingRef.current = true;
    segmentStartRef.current = performance.now();
    setError(null);
    return true;
  }, [open]);

  const bank = () => {
    if (segmentStartRef.current !== null) recordedMsRef.current += performance.now() - segmentStartRef.current;
    segmentStartRef.current = null;
  };

  const pause = useCallback(() => {
    const r = recorderRef.current;
    if (r?.state === "recording") r.pause();
    capturingRef.current = false;
    bank();
  }, []);

  const resume = useCallback(() => {
    const r = recorderRef.current;
    if (r?.state === "paused") r.resume();
    capturingRef.current = true;
    segmentStartRef.current = performance.now();
    setError(null);
  }, []);

  const stop = useCallback(async (): Promise<RecordedTake | null> => {
    const r = recorderRef.current;
    if (!r) return null;
    capturingRef.current = false;
    bank();
    const done = new Promise<void>((resolve) => r.addEventListener("stop", () => resolve(), { once: true }));
    if (r.state !== "inactive") r.stop();
    await done;
    recorderRef.current = null;
    const mimeType = r.mimeType || chunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    const qc = evaluateLevels(trackerRef.current?.stats() ?? { totalMs: 0, speechMs: 0, silentMs: 0, clippedMs: 0, noiseFloor: 0 });
    return { blob, mimeType, durationMs: Math.round(recordedMsRef.current), qc };
  }, []);

  /** Throws away the current recording without producing a take. */
  const discard = useCallback(() => {
    const r = recorderRef.current;
    capturingRef.current = false;
    segmentStartRef.current = null;
    if (r && r.state !== "inactive") r.stop();
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  return { error, isOpen, levelRef, open, start, pause, resume, stop, discard, close };
}
