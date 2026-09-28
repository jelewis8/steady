import type { ExportFile, ShareProvider } from './interfaces';

function toBlob(file: ExportFile): Blob {
  return file.content instanceof Blob ? file.content : new Blob([file.content], { type: file.mimeType });
}

export const webShare: ShareProvider = {
  canShareFiles() {
    try {
      const f = new File(['x'], 'x.txt', { type: 'text/plain' });
      return typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });
    } catch {
      return false;
    }
  },
  async shareFile(file, title) {
    const f = new File([toBlob(file)], file.name, { type: file.mimeType });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: title ?? file.name });
        return 'shared';
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      }
    }
    this.download(file);
    return 'downloaded';
  },
  async shareText(text, title) {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text, title });
        return 'shared';
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      }
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  },
  download(file) {
    const url = URL.createObjectURL(toBlob(file));
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },
};
