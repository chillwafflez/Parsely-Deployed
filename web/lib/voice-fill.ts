import { fetchSpeechToken, postVoiceFill } from "./api-client";
import type { SpeechToken, VoiceFillResponse } from "./types";

/** Discriminator for predictable error handling in the UI. */
export type VoiceErrorKind =
  | "no-speech"
  | "permission-denied"
  | "canceled"
  | "network"
  | "unknown";

export class VoiceRecognitionError extends Error {
  readonly kind: VoiceErrorKind;

  constructor(kind: VoiceErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "VoiceRecognitionError";
  }
}

// Module-level token cache. One tab, one cache — all recognition sessions
// share the same JWT until it's within 1 minute of its server-reported
// expiry. In-flight promise dedupes concurrent refreshes.
let cachedToken: SpeechToken | null = null;
let tokenRefresh: Promise<SpeechToken> | null = null;

async function getToken(): Promise<SpeechToken> {
  const now = Date.now();
  if (
    cachedToken &&
    new Date(cachedToken.expiresAt).getTime() > now + 60_000
  ) {
    return cachedToken;
  }
  if (!tokenRefresh) {
    tokenRefresh = fetchSpeechToken()
      .then((t) => {
        cachedToken = t;
        return t;
      })
      .finally(() => {
        tokenRefresh = null;
      });
  }
  return tokenRefresh;
}

interface StartRecognitionOptions {
  /** Called with the final transcript once recognition completes successfully. */
  onTranscript: (text: string) => void;
  /** Called on any terminal error (no-match, permission, network, etc.). */
  onError: (err: VoiceRecognitionError) => void;
}

/**
 * Starts a single-utterance recognition session. Resolves with a cancel
 * function as soon as the recognizer is wired — callers can invoke it to
 * abort an in-progress recognition (mic button → stop).
 *
 * The Speech SDK is dynamically imported so its ~200 KB bundle loads only
 * when the user actually clicks mic, not on first paint of the fill stage.
 *
 * MUST be called from a user-gesture handler (click, keydown). Browsers
 * block `getUserMedia` otherwise and the failure surfaces as an opaque
 * permission error.
 */
export async function startRecognition({
  onTranscript,
  onError,
}: StartRecognitionOptions): Promise<() => void> {
  let token: SpeechToken;
  try {
    token = await getToken();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token fetch failed";
    onError(new VoiceRecognitionError("network", message));
    return () => {};
  }

  const SpeechSDK = await import("microsoft-cognitiveservices-speech-sdk");

  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
    token.token,
    token.region
  );
  speechConfig.speechRecognitionLanguage = "en-US";

  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

  let settled = false;
  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    fn();
    // close() releases mic + SDK resources; safe to call from either
    // success or cancel paths.
    recognizer.close();
  };

  recognizer.recognizeOnceAsync(
    (result) => {
      switch (result.reason) {
        case SpeechSDK.ResultReason.RecognizedSpeech:
          settle(() => onTranscript(result.text ?? ""));
          break;
        case SpeechSDK.ResultReason.NoMatch:
          settle(() =>
            onError(
              new VoiceRecognitionError(
                "no-speech",
                "Couldn't hear that — try again."
              )
            )
          );
          break;
        case SpeechSDK.ResultReason.Canceled: {
          const details = SpeechSDK.CancellationDetails.fromResult(result);
          const kind = classifyCancellation(details.errorDetails ?? "");
          settle(() =>
            onError(
              new VoiceRecognitionError(
                kind,
                details.errorDetails || "Recognition canceled"
              )
            )
          );
          break;
        }
        default:
          settle(() =>
            onError(
              new VoiceRecognitionError(
                "unknown",
                `Unexpected recognition result: ${result.reason}`
              )
            )
          );
      }
    },
    (err) => {
      settle(() =>
        onError(
          new VoiceRecognitionError(
            "unknown",
            typeof err === "string" ? err : "Recognition failed"
          )
        )
      );
    }
  );

  return () => {
    // User clicked stop. Treat as a silent cancel — no error surface,
    // no transcript. Closes the recognizer, which also releases the mic.
    settle(() => {});
  };
}

/** Heuristic mapping from raw Speech SDK error text to our kind union. */
function classifyCancellation(detail: string): VoiceErrorKind {
  const lower = detail.toLowerCase();
  if (lower.includes("notallowed") || lower.includes("permission")) {
    return "permission-denied";
  }
  if (lower.includes("network") || lower.includes("connection")) {
    return "network";
  }
  return "canceled";
}

/**
 * Thin wrapper on postVoiceFill so callers import a single module rather
 * than juggling api-client + voice-fill in one component.
 */
export async function fillFromTranscript(
  templateId: string,
  transcript: string,
  currentValues: Record<string, string | null>
): Promise<VoiceFillResponse> {
  return postVoiceFill({ templateId, transcript, currentValues });
}
