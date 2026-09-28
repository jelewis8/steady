import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import { createWebAudioRecorder } from '../../platform/audio';
import { useVoiceNote } from '../../data/hooks';
import { deleteVoiceNote, saveVoiceNote } from '../../data/repo';
import { Button } from '../../ui/kit';

/** Records immediately on tap — no confirmation dialog (blueprint Screen 2). Audio stays on this device. */
export function VoiceNote({ noteId, seizureId, onChange }: { noteId: string | null; seizureId: string; onChange: (id: string | null) => void }) {
  const recorder = useMemo(() => createWebAudioRecorder(), []);
  const note = useVoiceNote(noteId);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const url = useMemo(() => (note?.blob ? URL.createObjectURL(note.blob) : null), [note]);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    recorder.cancel();
  }, [recorder]);

  if (!recorder.isSupported()) {
    return <p className="text-ink-2">Voice notes aren’t supported in this browser.</p>;
  }

  async function start() {
    setError(null);
    try {
      await recorder.start();
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError('Steady couldn’t use the microphone. You can allow it in your browser’s site settings.');
    }
  }

  async function stop() {
    if (timer.current) clearInterval(timer.current);
    const audio = await recorder.stop();
    setRecording(false);
    if (noteId) await deleteVoiceNote(noteId);
    const id = await saveVoiceNote(audio.blob, audio.mimeType, audio.durationMs, seizureId);
    onChange(id);
  }

  return (
    <div className="grid gap-2">
      {recording ? (
        <div className="flex items-center gap-3">
          <Button variant="primary" size="lg" icon={<Square aria-hidden size={20} />} onClick={stop}>
            Stop recording
          </Button>
          <span aria-live="off" className="text-lg font-bold tabular-nums">
            ● Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </span>
        </div>
      ) : (
        <Button size="lg" icon={<Mic aria-hidden size={22} />} onClick={start}>
          {noteId ? 'Record again' : 'Record a voice note'}
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
      {url && !recording && (
        <div className="flex flex-wrap items-center gap-2">
          <audio controls src={url} className="max-w-full">
            <track kind="captions" />
          </audio>
          <Button
            variant="ghost"
            icon={<Trash2 aria-hidden size={20} />}
            onClick={async () => {
              if (noteId) await deleteVoiceNote(noteId);
              onChange(null);
            }}
          >
            Delete recording
          </Button>
        </div>
      )}
    </div>
  );
}
