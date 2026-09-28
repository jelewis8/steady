import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, ShieldCheck, Trash2 } from 'lucide-react';
import {
  dosesCsv,
  isEncryptedEnvelope,
  parseEnvelope,
  seizuresCsv,
  sleepCsv,
  summarizeData,
  type EncryptedEnvelope,
  type ExportEnvelope,
} from '../../core/exportSchema';
import { SCHEMA_VERSION } from '../../core/defaults';
import { todayKey } from '../../core/time';
import { setMeta } from '../../data/db';
import { useMeta } from '../../data/hooks';
import { ensureDay } from '../../data/repo';
import { checksumOf, storage } from '../../data/storage';
import { base64ToBytes, bytesToBase64, PBKDF2_ITERATIONS, webCrypto } from '../../platform/crypto';
import { webShare } from '../../platform/share';
import { toast } from '../../state/ui';
import { Button, Card, CardTitle, Field, Input, PageHeader, Segmented, Sheet, Toggle } from '../../ui/kit';

async function encryptEnvelope(env: ExportEnvelope, passphrase: string): Promise<EncryptedEnvelope> {
  const salt = webCrypto.randomSalt();
  const key = await webCrypto.deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const payload = await webCrypto.encrypt(JSON.stringify(env), key);
  return {
    format: 'steady-encrypted-export',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: env.exportedAt,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, saltBase64: bytesToBase64(salt) },
    cipher: { name: 'AES-GCM', ivBase64: payload.ivBase64 },
    ciphertextBase64: payload.ciphertextBase64,
  };
}

async function decryptEnvelope(enc: EncryptedEnvelope, passphrase: string): Promise<unknown> {
  const key = await webCrypto.deriveKey(passphrase, base64ToBytes(enc.kdf.saltBase64), enc.kdf.iterations);
  const text = await webCrypto.decrypt({ ivBase64: enc.cipher.ivBase64, ciphertextBase64: enc.ciphertextBase64 }, key);
  return JSON.parse(text);
}

export function DataPage() {
  const lastExport = useMeta<string>('lastExportAt');
  const [counts, setCounts] = useState<{ label: string; count: number }[]>([]);
  const [encrypt, setEncrypt] = useState(false);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string | null>(null);

  useEffect(() => {
    storage.exportAll().then((env) => setCounts(summarizeData(env.data).filter((c) => c.count > 0)));
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(e.usage != null ? `${(e.usage / 1024 / 1024).toFixed(1)} MB` : null))
      .catch(() => undefined);
  }, []);

  const passOk = !encrypt || (pass.length >= 8 && pass === pass2);

  async function exportJson() {
    setBusy(true);
    try {
      const env = await storage.exportAll();
      const date = todayKey();
      if (encrypt) {
        const enc = await encryptEnvelope(env, pass);
        webShare.download({ name: `steady-backup-${date}.encrypted.json`, mimeType: 'application/json', content: JSON.stringify(enc) });
      } else {
        webShare.download({ name: `steady-backup-${date}.json`, mimeType: 'application/json', content: JSON.stringify(env, null, 2) });
      }
      await setMeta('lastExportAt', new Date().toISOString());
      toast('Backup saved to your downloads. Keep it somewhere safe — it contains your health data.');
    } catch (e) {
      toast(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv(kind: 'seizures' | 'doses' | 'sleep') {
    const env = await storage.exportAll();
    const content = kind === 'seizures' ? seizuresCsv(env.data) : kind === 'doses' ? dosesCsv(env.data) : sleepCsv(env.data);
    webShare.download({ name: `steady-${kind}-${todayKey()}.csv`, mimeType: 'text/csv', content });
  }

  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title="Backup & data" back="/more" subtitle="Everything lives only in this browser on this device. A backup file is your safety net." />

      <Card labelledBy="exp-h">
        <CardTitle id="exp-h" icon={<Download aria-hidden size={20} />}>
          Back up everything
        </CardTitle>
        {counts.length > 0 && (
          <p className="mb-3 text-ink-2">Includes {counts.map((c) => `${c.count} ${c.label}`).join(', ')}.</p>
        )}
        <div className="grid gap-4">
          <Toggle label="Protect the file with a passphrase" hint="Encrypted with AES-256. If you forget the passphrase, the file can’t be opened." checked={encrypt} onChange={setEncrypt} />
          {encrypt && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Passphrase" hint="At least 8 characters">
                {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />}
              </Field>
              <Field label="Type it again">
                {(id) => <Input id={id} type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />}
              </Field>
            </div>
          )}
          <Button variant="primary" size="lg" disabled={busy || !passOk} onClick={exportJson}>
            {busy ? 'Preparing…' : 'Save backup file'}
          </Button>
          <p className="text-sm text-ink-2">
            {lastExport ? `Last backup: ${new Date(lastExport).toLocaleString()}.` : 'No backup made yet.'} The file is plain, documented JSON — any
            future app can read it.
          </p>
        </div>
      </Card>

      <Card labelledBy="csv-h">
        <CardTitle id="csv-h">Spreadsheet files (CSV)</CardTitle>
        <p className="mb-3 text-ink-2">For opening in Excel or Google Sheets. These are a partial view — use the backup file to move to a new device.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportCsv('seizures')}>Seizures</Button>
          <Button onClick={() => exportCsv('doses')}>Medication doses</Button>
          <Button onClick={() => exportCsv('sleep')}>Sleep</Button>
        </div>
      </Card>

      <ImportCard />

      <Card labelledBy="st-h">
        <CardTitle id="st-h" icon={<ShieldCheck aria-hidden size={20} />}>
          Storage on this device
        </CardTitle>
        <p>
          {persisted ? 'Your browser has agreed to keep Steady’s data even when space runs low.' : 'Your browser may clear Steady’s data if the device runs very low on space. Installing Steady to your home screen and making regular backups protects you.'}
        </p>
        {usage && <p className="mt-1 text-ink-2">Using about {usage}.</p>}
        <p className="mt-2 text-sm text-ink-2">Clearing this site’s data or browsing history in your browser settings deletes Steady’s data. Back up first.</p>
      </Card>

      <EraseCard />
    </div>
  );
}

export function ImportCard({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [needPass, setNeedPass] = useState(false);
  const [pass, setPass] = useState('');
  const [env, setEnv] = useState<ExportEnvelope | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setRaw(null);
    setNeedPass(false);
    setPass('');
    setEnv(null);
    setWarnings([]);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  async function accept(obj: unknown) {
    const parsed = parseEnvelope(obj);
    if (!parsed.ok) return setError(parsed.error);
    const w = [...parsed.warnings];
    if (parsed.envelope.checksum) {
      const sum = await checksumOf((obj as ExportEnvelope).data);
      if (sum !== parsed.envelope.checksum) w.unshift('The file’s checksum doesn’t match — it may have been edited or damaged. Import carefully.');
    }
    setWarnings(w);
    setEnv(parsed.envelope);
  }

  async function onFile(f: File) {
    reset();
    try {
      const obj = JSON.parse(await f.text());
      if (isEncryptedEnvelope(obj)) {
        setRaw(obj);
        setNeedPass(true);
      } else await accept(obj);
    } catch {
      setError('That file couldn’t be read. Is it a Steady backup (.json)?');
    }
  }

  async function unlock() {
    try {
      setBusy(true);
      await accept(await decryptEnvelope(raw as EncryptedEnvelope, pass));
      setNeedPass(false);
    } catch {
      setError('That passphrase didn’t work. Check it and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!env) return;
    setBusy(true);
    try {
      await storage.importAll(env, mode);
      await ensureDay(todayKey());
      toast(mode === 'replace' ? 'Backup restored.' : 'Backup merged with your data.');
      reset();
      onImported?.();
    } catch (e) {
      setError(`Import failed, and nothing was changed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card labelledBy="imp-h">
      <CardTitle id="imp-h" icon={<FileUp aria-hidden size={20} />}>
        Restore from a backup
      </CardTitle>
      <Field label="Choose a Steady backup file">
        {(id) => (
          <input
            id={id}
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="tap w-full rounded-xl border-2 border-dashed border-line-strong bg-surface p-3 file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:font-bold file:text-accent-ink"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="mt-3 rounded-xl border-2 border-attn-line bg-attn-bg p-3 text-attn-ink">
          {error}
        </p>
      )}
      {needPass && (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void unlock();
          }}
        >
          <Field label="This backup is protected. Enter its passphrase.">
            {(id) => <Input id={id} type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} />}
          </Field>
          <Button type="submit" variant="primary" disabled={busy || !pass}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </Button>
        </form>
      )}
      {env && (
        <div className="mt-3 grid gap-3">
          <p>
            Backup from {new Date(env.exportedAt).toLocaleString()}. It contains{' '}
            {summarizeData(env.data)
              .filter((c) => c.count)
              .map((c) => `${c.count} ${c.label}`)
              .join(', ') || 'no records'}
            .
          </p>
          {warnings.map((w) => (
            <p key={w} className="text-sm text-attn-ink">
              ⚑ {w}
            </p>
          ))}
          <Segmented
            label="How should it be added?"
            value={mode}
            onChange={setMode}
            columns={1}
            options={[
              { value: 'merge', label: 'Add to what’s here', hint: 'Matching records are updated; nothing is deleted.' },
              { value: 'replace', label: 'Replace everything here', hint: 'This device’s current data is removed first.' },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="lg" disabled={busy} onClick={doImport}>
              {busy ? 'Importing…' : mode === 'replace' ? 'Replace and restore' : 'Import'}
            </Button>
            <Button onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function EraseCard() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  return (
    <Card labelledBy="erase-h">
      <CardTitle id="erase-h" icon={<Trash2 aria-hidden size={20} />}>
        Erase all data
      </CardTitle>
      <p className="text-ink-2">Removes everything Steady has stored on this device. Make a backup first if you might want it later.</p>
      <Button className="mt-3" onClick={() => setOpen(true)}>
        Erase all data…
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Erase everything?">
        <p>This permanently deletes all seizures, medications, routines, and settings from this device. It can’t be undone.</p>
        <Field label='Type "erase" to confirm'>
          {(id) => <Input id={id} className="mt-1" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
        </Field>
        <div className="mt-4 grid gap-2">
          <Button
            variant="sos"
            size="lg"
            disabled={typed.trim().toLowerCase() !== 'erase'}
            onClick={async () => {
              await storage.eraseAll();
              try {
                localStorage.clear();
                sessionStorage.clear();
              } catch {
                /* ignore */
              }
              window.location.assign('/welcome');
            }}
          >
            Erase everything
          </Button>
          <Button size="lg" onClick={() => setOpen(false)}>
            Keep my data
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}
