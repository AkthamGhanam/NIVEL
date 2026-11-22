import { describe, expect, it, vi } from "vitest";

import {
  type AudioRecorder,
  browserMicrophone,
  MAX_NOTE_SECONDS,
  type Microphone,
  MicrophoneError,
  NOTE_FORMATS,
  noteClock,
  noteSeconds,
  type RecorderEvents,
  recordVoiceNote,
} from "./voice-recorder";

/** Micrófono falso: graba los trozos que se le indiquen y avisa como lo hace el navegador. */
function fakeMicrophone(options: { supported?: readonly string[]; mimeType?: string } = {}) {
  const track = { stop: vi.fn() };
  const state: { events?: RecorderEvents; format?: string | undefined } = {};
  const recorder: AudioRecorder = {
    mimeType: options.mimeType ?? "audio/webm;codecs=opus",
    start: vi.fn(),
    stop: vi.fn(() => state.events?.onStop()),
  };
  const microphone: Microphone = {
    open: vi.fn(async () => ({ getTracks: () => [track] })),
    supports: (format) => (options.supported ?? ["audio/webm;codecs=opus"]).includes(format),
    record: (_stream, { format, events }) => {
      state.events = events;
      state.format = format;
      return recorder;
    },
  };
  const say = (bytes: number) => state.events?.onData(new Blob([new Uint8Array(bytes)]));
  return { microphone, recorder, track, state, say };
}

const named = (name: string) => Object.assign(new Error(name), { name });

describe("nota de voz", () => {
  it("graba en el formato más liviano que el navegador admita y entrega el audio sin parámetros de códec", async () => {
    const { microphone, recorder, track, state, say } = fakeMicrophone();

    const recording = await recordVoiceNote(microphone);
    say(1200);
    say(0);
    say(800);
    const note = await recording.finish();

    expect(state.format).toBe(NOTE_FORMATS[0]);
    expect(recorder.start).toHaveBeenCalledOnce();
    expect(note.size).toBe(2000);
    expect(note.type).toBe("audio/webm");
    // Al terminar, el micrófono queda libre.
    expect(track.stop).toHaveBeenCalled();
  });

  it("en Safari graba en MP4, y si el navegador no declara formatos usa el suyo", async () => {
    const safari = fakeMicrophone({ supported: ["audio/mp4"], mimeType: "audio/mp4" });
    const unknown = fakeMicrophone({ supported: [], mimeType: "" });

    const first = await recordVoiceNote(safari.microphone);
    safari.say(10);
    const second = await recordVoiceNote(unknown.microphone);
    unknown.say(10);

    expect(safari.state.format).toBe("audio/mp4");
    expect((await first.finish()).type).toBe("audio/mp4");
    expect(unknown.state.format).toBeUndefined();
    expect((await second.finish()).type).toBe("");
  });

  it("una grabación vacía no se envía", async () => {
    const { microphone, track } = fakeMicrophone();

    const recording = await recordVoiceNote(microphone);

    await expect(recording.finish()).rejects.toThrow("No se grabó nada");
    expect(track.stop).toHaveBeenCalled();
  });

  it("al descartar suelta el micrófono y bota lo grabado, aunque la grabadora ya estuviera detenida", async () => {
    const { microphone, recorder, track, say } = fakeMicrophone();
    const recording = await recordVoiceNote(microphone);
    say(500);
    vi.mocked(recorder.stop).mockImplementationOnce(() => {
      throw named("InvalidStateError");
    });

    recording.cancel();

    expect(track.stop).toHaveBeenCalled();
    await expect(recording.finish()).rejects.toThrow("No se grabó nada");
  });

  it("explica con palabras por qué no se pudo usar el micrófono", async () => {
    const failing = (error: unknown) => ({
      ...fakeMicrophone().microphone,
      open: async () => {
        throw error;
      },
    });

    await expect(recordVoiceNote(failing(named("NotAllowedError")))).rejects.toThrow("No tenemos permiso");
    await expect(recordVoiceNote(failing(named("NotFoundError")))).rejects.toThrow(
      "No encontramos un micrófono",
    );
    await expect(recordVoiceNote(failing("raro"))).rejects.toThrow("No pudimos usar el micrófono");
    await expect(recordVoiceNote(failing(named("AbortError")))).rejects.toBeInstanceOf(MicrophoneError);
  });

  it("si la grabadora falla al arrancar o a mitad de camino, suelta el micrófono y lo dice", async () => {
    const broken = fakeMicrophone();
    vi.mocked(broken.recorder.start).mockImplementationOnce(() => {
      throw named("NotSupportedError");
    });
    const midway = fakeMicrophone();
    vi.mocked(midway.recorder.stop).mockImplementationOnce(() => midway.state.events?.onError());

    await expect(recordVoiceNote(broken.microphone)).rejects.toThrow("No pudimos usar el micrófono");
    expect(broken.track.stop).toHaveBeenCalled();
    const recording = await recordVoiceNote(midway.microphone);
    await expect(recording.finish()).rejects.toThrow("No pudimos usar el micrófono");
    expect(midway.track.stop).toHaveBeenCalled();
  });

  it("sin grabadora en el navegador avisa que se puede escribir", async () => {
    // En las pruebas no hay navegador: no existe `MediaRecorder`.
    expect(browserMicrophone()).toBeUndefined();
    await expect(recordVoiceNote()).rejects.toThrow("no permite grabar");
  });
});

describe("micrófono del navegador", () => {
  it("pide solo audio y conecta los avisos de la grabadora", async () => {
    const stream = { getTracks: () => [] };
    const getUserMedia = vi.fn(async () => stream);
    const created: Array<{ options: unknown; instance: Record<string, unknown> }> = [];
    class FakeRecorder {
      static isTypeSupported = (format: string) => format === "audio/mp4";
      mimeType = "audio/mp4";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(_stream: unknown, options: unknown) {
        created.push({ options, instance: this as unknown as Record<string, unknown> });
      }
      start = vi.fn();
      stop = vi.fn();
    }
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    const events = { onData: vi.fn(), onStop: vi.fn(), onError: vi.fn() };

    const microphone = browserMicrophone();
    const recorder = microphone?.record(await microphone.open(), { format: "audio/mp4", events });
    microphone?.record(stream, { format: undefined, events });
    const instance = created[0]?.instance as unknown as FakeRecorder;
    const data = new Blob(["a"]);
    instance.ondataavailable?.({ data });
    instance.onstop?.();
    instance.onerror?.();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(microphone?.supports("audio/mp4")).toBe(true);
    expect(microphone?.supports("audio/webm")).toBe(false);
    expect(recorder?.mimeType).toBe("audio/mp4");
    expect(created[0]?.options).toEqual({ audioBitsPerSecond: 32_000, mimeType: "audio/mp4" });
    expect(created[1]?.options).toEqual({ audioBitsPerSecond: 32_000 });
    expect(events.onData).toHaveBeenCalledWith(data);
    expect(events.onStop).toHaveBeenCalledOnce();
    expect(events.onError).toHaveBeenCalledOnce();

    vi.stubGlobal("navigator", {});
    expect(browserMicrophone()).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe("reloj de la nota", () => {
  it("cuenta los segundos sin pasar del máximo ni bajar de cero", () => {
    expect(noteSeconds(1000, 1000)).toBe(0);
    expect(noteSeconds(1000, 13_900)).toBe(12);
    expect(noteSeconds(1000, 999_000)).toBe(MAX_NOTE_SECONDS);
    expect(noteSeconds(5000, 1000)).toBe(0);
  });

  it("se lee como minutos y segundos sobre el total", () => {
    expect(noteClock(0)).toBe("0:00 de 1:00");
    expect(noteClock(12)).toBe("0:12 de 1:00");
    expect(noteClock(60)).toBe("1:00 de 1:00");
  });
});
