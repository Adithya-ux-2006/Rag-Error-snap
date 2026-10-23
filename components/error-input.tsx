'use client';

import { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ChevronDown, ImagePlus, MonitorUp, Paperclip, X } from 'lucide-react';
import { Language } from '@/lib/types';

interface ErrorInputProps {
  onSolve: (query: string, language: Language, screenshot?: string) => Promise<void>;
  isLoading: boolean;
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'all', label: 'All Languages' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'javascript', label: 'JavaScript' },
];

export default function ErrorInput({ onSolve, isLoading }: ErrorInputProps) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<Language>('all');
  const [screenshot, setScreenshot] = useState<{ file: File; previewUrl: string } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (screenshot) URL.revokeObjectURL(screenshot.previewUrl);
    };
  }, [screenshot]);

  const attachScreenshot = (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAttachmentError('Choose an image file (PNG, JPG, GIF, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAttachmentError('Screenshots must be 5 MB or smaller.');
      return;
    }

    setAttachmentError(null);
    setScreenshot((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    attachScreenshot(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    attachScreenshot(event.dataTransfer.files[0]);
  };

  const handlePaste = (event: ClipboardEvent<HTMLFormElement>) => {
    const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'));
    if (image) attachScreenshot(image);
  };

  const clearScreenshot = () => {
    setScreenshot((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    setAttachmentError(null);
  };

  const captureScreen = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setAttachmentError('Screen capture is not supported in this browser. Upload or paste an image instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      stream.getTracks().forEach((track) => track.stop());

      canvas.toBlob((blob) => {
        if (blob) attachScreenshot(new File([blob], 'errorsnap-screenshot.png', { type: 'image/png' }));
      }, 'image/png');
    } catch (error) {
      if ((error as DOMException).name !== 'NotAllowedError') {
        setAttachmentError('Could not capture your screen. Try uploading or pasting an image instead.');
      }
    }
  };

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the screenshot.'));
    reader.readAsDataURL(file);
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setQuery(query.trim());
    try {
      await onSolve(query.trim(), language, screenshot ? await fileToDataUrl(screenshot.file) : undefined);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Could not attach the screenshot.');
    }
  };

  return (
    <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-6">
      <div className="panel p-6 space-y-5">
        <div>
          <label htmlFor="error-query" className="label">
            What went wrong?
          </label>
          <textarea
            id="error-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste your error message here, e.g., ModuleNotFoundError: No module named 'pandas'"
            className="w-full min-h-[140px] rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y transition-colors duration-150"
            disabled={isLoading}
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="label mb-0">Screenshot <span className="font-normal">(optional)</span></label>
            {screenshot && (
              <button
                type="button"
                onClick={clearScreenshot}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>

          {screenshot ? (
            <div className="relative overflow-hidden rounded-[6px] border border-border bg-secondary p-3">
              <div className="flex items-center gap-3">
                <img src={screenshot.previewUrl} alt="Attached screenshot preview" className="h-16 w-24 rounded object-cover border border-border bg-card" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{screenshot.file.name}</p>
                  <p className="text-xs text-muted-foreground">{Math.ceil(screenshot.file.size / 1024)} KB · ready to reference</p>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
              className="rounded-[6px] border border-dashed border-input bg-secondary/40 px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-card border border-border">
                    <ImagePlus className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">Drop, paste, or capture a screenshot of the error.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary gap-1.5 !px-3 !py-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Upload
                  </button>
                  <button type="button" onClick={captureScreen} className="btn-secondary gap-1.5 !px-3 !py-1.5">
                    <MonitorUp className="h-3.5 w-3.5" /> Capture
                  </button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleFileChange} className="sr-only" />
            </div>
          )}
          {attachmentError && <p className="mt-2 text-xs text-red-600">{attachmentError}</p>}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label htmlFor="language" className="label">
              Programming Language
            </label>
            <div className="relative">
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="select-field pr-8"
                disabled={isLoading}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="btn-primary"
          >
            {isLoading ? 'Finding...' : 'Find solution'}
          </button>
        </div>
      </div>
    </form>
  );
}
