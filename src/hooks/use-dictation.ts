import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictation for typed recall.
 *
 * The browser's own speech engine (Chrome, Edge, Safari) is used first: it is
 * free, needs no key and streams words as they are spoken. Firefox has no
 * engine, so `supported` is false there and the caller keeps the text box as
 * the fallback. Nothing is recorded or uploaded by this hook.
 */

type SpeechResultLike = {
  0?: { transcript?: string };
  isFinal: boolean;
};

type SpeechEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechResultLike | undefined;
  };
};

type SpeechErrorLike = { error?: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: SpeechErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

function messageFor(error?: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it in your browser, or type your answer instead.";
    case "no-speech":
      return "Nothing was heard. Tap the microphone and try again.";
    case "audio-capture":
      return "No microphone was found. Type your answer instead.";
    case "network":
      return "The speech service could not be reached. Type your answer instead.";
    default:
      return "Dictation stopped. Try the microphone again, or type your answer.";
  }
}

export function useDictation(onText: (text: string) => void) {
  // Read once from the browser rather than setting it in an effect: the
  // capability cannot change while the page is open.
  const [supported] = useState(() => Boolean(getSpeechRecognition()));
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const settled = useRef("");
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  }, [onText]);

  useEffect(() => {
    const Constructor = getSpeechRecognition();
    if (!Constructor) return;

    const instance = new Constructor();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-GB";

    instance.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript ?? "";
        if (!text) continue;
        if (result?.isFinal) {
          settled.current = `${settled.current} ${text}`.trim();
        } else {
          interim += ` ${text}`;
        }
      }
      callback.current(`${settled.current}${interim}`.trim());
    };

    instance.onerror = (event) => {
      setError(messageFor(event.error));
      setListening(false);
    };
    instance.onend = () => setListening(false);

    recognition.current = instance;
    return () => {
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      try {
        instance.abort();
      } catch {
        // Some engines throw when aborting a session that never started.
      }
      recognition.current = null;
    };
  }, []);

  /** Starts a fresh dictation: the previous transcript is discarded. */
  const start = useCallback(() => {
    const instance = recognition.current;
    if (!instance) return;
    setError(null);
    settled.current = "";
    callback.current("");
    try {
      instance.start();
      setListening(true);
    } catch {
      // Chrome throws if a previous session has not finished ending.
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognition.current?.stop();
    } catch {
      // Stopping an idle session is harmless.
    }
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  const clear = useCallback(() => {
    settled.current = "";
    setError(null);
  }, []);

  return { supported, listening, error, start, stop, toggle, clear };
}
