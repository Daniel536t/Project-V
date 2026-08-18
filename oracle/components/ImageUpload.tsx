"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface ImageUploadProps {
  onResult?: (result: unknown) => void;
}

/** Dropzone for photo uploads — sends images to /api/valuate. */
export default function ImageUpload({ onResult }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setError(null);
      setLoading(true);
      setPreview(URL.createObjectURL(file));

      try {
        const base64 = await toBase64(file);
        const res = await fetch("/api/valuate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, name: file.name }),
        });
        const data = await res.json();
        onResult?.(data);
      } catch {
        setError("Upload failed.");
      } finally {
        setLoading(false);
      }
    },
    [onResult],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
        isDragActive
          ? "border-spider-red bg-spider-red/10"
          : "border-spider-blue/40 bg-panel/60 hover:border-spider-red"
      }`}
    >
      <input {...getInputProps()} />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Upload preview"
          className="mb-4 max-h-48 rounded-xl object-contain"
        />
      ) : (
        <span className="text-4xl">🕸️</span>
      )}
      <p className="font-display text-xl tracking-wider text-foreground">
        {isDragActive ? "RELEASE TO ANALYZE" : "DROP A PHOTO HERE"}
      </p>
      <p className="mt-2 text-sm text-foreground/50">
        {loading
          ? "Consulting the Oracle…"
          : "or click to upload — we'll identify it and assess rarity."}
      </p>
      {error && <p className="mt-2 text-sm text-spider-red">{error}</p>}
    </div>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
