"use client";

import { useRef, useState } from "react";

export default function UploadPage() {
  const [status, setStatus] = useState<string>("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send(file: File) {
    setBusy(true);
    setStatus("Uploading…");
    const fd = new FormData();
    fd.append("image", file);
    try {
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok) {
        setStatus(`Saved as ${d.file} (${d.bytes} bytes). Tell Buffy — it's ready to read.`);
      } else {
        setStatus(`Error: ${d.error ?? r.status}`);
      }
    } catch {
      setStatus("Upload failed — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    send(f);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 text-[#eaeaea]">
      <h1 className="text-[28px] font-bold tracking-tight">Vision upload</h1>
      <p className="mt-2 max-w-md text-center text-[14px] text-[#a0a0a0]">
        Drop your design screenshot here. It saves to the server, then Buffy runs it
        through the vision model to read your vision and rebuild the UI from it.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="mt-8 flex h-64 w-full max-w-md cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[#2a2a30] bg-[#0f0f12] transition hover:border-[#00d4ff]/60 hover:bg-[#131318]"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="preview" className="max-h-56 max-w-full rounded-[10px] object-contain" />
        ) : (
          <>
            <span className="text-[40px]">📷</span>
            <span className="mt-3 text-[14px] font-medium">Drop an image or click to browse</span>
            <span className="mt-1 text-[12px] text-[#5c5c66]">PNG, JPG, WEBP · up to 15 MB</span>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {status && (
        <p className={`mt-4 max-w-md text-center font-mono text-[13px] ${busy ? "text-[#00d4ff]" : "text-[#00ff88]"}`}>
          {status}
        </p>
      )}
    </main>
  );
}
