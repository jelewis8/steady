import type { AudioBlob, AudioRecorder } from './interfaces';

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of candidates) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  return '';
}

/** MediaRecorder implementation. Audio never leaves the device. */
export function createWebAudioRecorder(): AudioRecorder {
  let rec: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let startedAt = 0;

  const release = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    rec = null;
  };

  return {
    isSupported() {
      return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    },
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.start(1000);
      startedAt = Date.now();
    },
    stop() {
      return new Promise<AudioBlob>((resolve, reject) => {
        const r = rec;
        if (!r) return reject(new Error('Not recording'));
        r.onstop = () => {
          const mimeType = r.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: mimeType });
          const durationMs = Date.now() - startedAt;
          release();
          resolve({ blob, mimeType, durationMs });
        };
        r.stop();
      });
    },
    cancel() {
      try {
        rec?.stop();
      } catch {
        /* already stopped */
      }
      chunks = [];
      release();
    },
    isRecording() {
      return rec?.state === 'recording';
    },
  };
}
