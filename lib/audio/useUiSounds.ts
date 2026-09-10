"use client";

import { useCallback } from "react";
import { useAudioStore, type AudioState } from "@/store/useAudioStore";

type ToneName = "hover" | "click" | "systemOn";

type ToneConfig = {
  frequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
};

const TONES: Record<ToneName, ToneConfig> = {
  hover: { frequency: 1180, duration: 0.014, gain: 0.009, type: "square" },
  click: { frequency: 82, duration: 0.052, gain: 0.032, type: "sine" },
  systemOn: { frequency: 47, duration: 0.28, gain: 0.024, type: "sawtooth" },
};

let sharedContext: AudioContext | null = null;
let lastHoverAt = 0;
let lastAnyToneAt = 0;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  sharedContext ??= new AudioContextCtor({ latencyHint: "interactive" });
  return sharedContext;
}

function playTone(tone: ToneName) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (tone === "hover" && now - lastHoverAt < 120) return;
  if (now - lastAnyToneAt < 28) return;
  if (tone === "hover") lastHoverAt = now;
  lastAnyToneAt = now;

  const context = getContext();
  if (!context) return;

  const fire = () => {
    const config = TONES[tone];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(config.gain, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + config.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + config.duration + 0.01);

    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  };

  if (context.state === "suspended") {
    void context.resume().then(fire).catch(() => undefined);
    return;
  }

  fire();
}

export function useUiSounds() {
  const isMuted = useAudioStore((state: AudioState) => state.isMuted);

  const play = useCallback((tone: ToneName) => {
    if (isMuted) return;
    playTone(tone);
  }, [isMuted]);

  return {
    playHover: useCallback(() => play("hover"), [play]),
    playClick: useCallback(() => play("click"), [play]),
    playSystemOn: useCallback(() => play("systemOn"), [play]),
  };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
