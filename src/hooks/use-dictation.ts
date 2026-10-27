import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictation for typed recall.
 *
 * The browser's own speech engine (Chrome, Edge, Safari) is used: it is free,
 * needs no key and streams words as they are spoken. Firefox has no engine, so
 * `supported` is false there and the caller keeps the text box as the fallback.
 * Nothing is recorded or uploaded by this hook.
 *
 * Speech engines end a session on their own and refuse a new `start()` while
 * the previous one is still shutting down, which is what made dictation look
 * broken from one card to the next: the failure was swallowed and the button
 * did nothing. A start now retries once, every failure is shown to the student,
 * whatever they had typed is kept, and an unexpected stop resumes listening.
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

/** How long to wait before retrying a start the engine refused. */
const RESTART_DELAY_MS = 250;

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
    case "language-not-supported":
      return "This browser cannot dictate that language. Type your answer instead.";
    default:
      return "Dictation stopped. Try the microphone again, or type your answer.";
  }
}

const START_FAILED_MESSAGE =
  "Dictation could not start. Check that the microphone is allowed, then try again — you can always type your answer.";

export function useDictation(onText: (text: string) => void) {
  // Read once from the browser rather than setting it in an effect: the
  // capability cannot change while the page is open.
  const [supported] = useState(() => Boolean(getSpeechRecognition()));
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const settled = useRef("");
  const callback = useRef(onText);
  // True between the student tapping the microphone and tapping it again, so an
  // engine that ends by itself can be told apart from the student stopping.
  const wantsToListen = useRef(false);
  const restartTimer = useRef<number | null>(null);

  useEffect(() => {
    callback.current = onText;
  }, [onText]);

  const clearRestart = useCallback(() => {
    if (restartTimer.current !== null) {
      window.clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
  }, []);

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
      // A real error (denied microphone, no speech, network) is reported and
      // left stopped: restarting into the same error would loop.
      wantsToListen.current = false;
      clearRestart();
      setError(messageFor(event.error));
      setListening(false);
    };

    instance.onend = () => {
      setListening(false);
      if (!wantsToListen.current) return;
      // A continuous session also ends on its own after a pause or a dropped
      // connection, with no error at all. Resume it so the student can keep
      // talking instead of finding a dead microphone.
      clearRestart();
      restartTimer.current = window.setTimeout(() => {
        restartTimer.current = null;
        if (!wantsToListen.current) return;
        try {
          instance.start();
          setListening(true);
        } catch {
          wantsToListen.current = false;
          setError(START_FAILED_MESSAGE);
        }
      }, RESTART_DELAY_MS);
    };

    recognition.current = instance;
    return () => {
      clearRestart();
      wantsToListen.current = false;
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
  }, [clearRestart]);

  /**
   * Starts dictation, keeping `base` as the words already in the box. The
   * transcript is appended to it, so a typed answer is never wiped by tapping
   * the microphone.
   */
  const start = useCallback(
    (base = "") => {
      const instance = recognition.current;
      if (!instance) return;
      setError(null);
      clearRestart();
      settled.current = base.trim();
      wantsToListen.current = true;

      const attempt = (isRetry: boolean) => {
        if (!wantsToListen.current) return;
        try {
          instance.start();
          setListening(true);
        } catch {
          if (!isRetry) {
            // Chrome throws while the previous session is still ending, which
            // is common when moving between cards. One short retry recovers.
            restartTimer.current = window.setTimeout(() => {
              restartTimer.current = null;
              attempt(true);
            }, RESTART_DELAY_MS);
            return;
          }
          wantsToListen.current = false;
          setListening(false);
          setError(START_FAILED_MESSAGE);
        }
      };
      attempt(false);
    },
    [clearRestart],
  );

  const stop = useCallback(() => {
    wantsToListen.current = false;
    clearRestart();
    try {
      recognition.current?.stop();
    } catch {
      // Stopping an idle session is harmless.
    }
    setListening(false);
  }, [clearRestart]);

  const toggle = useCallback(
    (base = "") => {
      if (listening) stop();
      else start(base);
    },
    [listening, start, stop],
  );

  const clear = useCallback(() => {
    clearRestart();
    settled.current = "";
    setError(null);
  }, [clearRestart]);

  return { supported, listening, error, start, stop, toggle, clear };
}
