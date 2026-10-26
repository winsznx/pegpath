"use client";

import { useState } from "react";
import { readRunLog, runLogCsv } from "@/lib/telemetry/events";
import { Button } from "@/components/ui";

export function RunLogDownload() {
  const [count, setCount] = useState<number | null>(null);

  const download = () => {
    const entries = readRunLog();
    setCount(entries.length);
    if (entries.length === 0) return;
    const url = URL.createObjectURL(new Blob([runLogCsv(entries)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "pegpath-run-log.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={download}>
        Download run log (CSV)
      </Button>
      {count === 0 && <span className="text-sm text-ink-soft">No runs recorded in this browser yet.</span>}
    </div>
  );
}
