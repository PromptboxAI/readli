"use client";

import { useRef, useState, type DragEvent } from "react";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * A file upload that looks like part of the form: a dashed box people can click or drop a file on,
 * then the chosen file's name with a Remove button. The real file input stays in the form (visually
 * hidden), so the form's FormData still carries the file under `name`.
 */
export function FilePicker({ id, name, label, hint }: { id: string; name: string; label: string; hint: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    const input = inputRef.current;
    if (!dropped || !input) return;
    const list = new DataTransfer();
    list.items.add(dropped);
    input.files = list.files;
    setFile(dropped);
  }

  function remove() {
    if (inputRef.current) inputRef.current.value = "";
    setFile(null);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-semibold">
        {label} <span className="font-normal text-muted">(optional)</span>
      </span>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={ACCEPT}
        aria-label={label}
        aria-describedby={`${id}-hint`}
        className="peer sr-only"
        onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-2xl bg-mint/40 px-4 py-3 ring-2 ring-ink/15" data-testid={`${name}-chosen`}>
          <span aria-hidden="true" className="text-2xl">
            📎
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{file.name}</span>
            <span className="block text-sm text-muted">{sizeLabel(file.size)}</span>
          </span>
          <label htmlFor={id} className="cursor-pointer text-sm font-semibold underline underline-offset-4">
            Change
          </label>
          <button type="button" onClick={remove} className="text-sm font-semibold text-coral-deep underline underline-offset-4">
            Remove
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ink ${
            dragging ? "border-ink bg-sunshine/40" : "border-ink/30 bg-surface hover:border-ink hover:bg-sunshine/20"
          }`}
        >
          <span aria-hidden="true" className="text-3xl">
            📄
          </span>
          <span className="font-semibold">
            <span className="underline underline-offset-4">Upload a file</span> or drag it here
          </span>
        </label>
      )}
      <p id={`${id}-hint`} className="text-sm text-muted">
        {hint}
      </p>
    </div>
  );
}
