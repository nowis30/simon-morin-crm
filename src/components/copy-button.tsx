"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }

  return (
    <button type="button" onClick={onCopy} className="rounded-lg border border-emerald-200 px-3 py-2 text-sm">
      {done ? "Copie" : label}
    </button>
  );
}
