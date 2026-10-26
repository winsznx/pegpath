/**
 * Local run log for the evidence table in the PRD (§14.1). It stays in this browser's localStorage,
 * holds only public data (chain, block, amounts, tx hash, timings, error category) and is never sent
 * anywhere. The person can download it as CSV.
 */
export type RunLogEntry = {
  runId: string;
  dateUtc: string;
  chainId: number;
  block: string;
  requestedMusd: string;
  estimatedRedeemableMusd: string;
  result:
    | "quote-ready"
    | "quote-blocked"
    | "user-rejected"
    | "submitted"
    | "confirmed-verified"
    | "confirmed-unverified"
    | "reverted"
    | "unknown-pending";
  txHash: string;
  actualRedeemedMusd: string;
  actualBtcReceived: string;
  btcFee: string;
  preflightMs: string;
  simulateMs: string;
  confirmMs: string;
  errorCategory: string;
  notes: string;
};

const STORAGE_KEY = "pegpath.runlog.v1";
const MAX_ENTRIES = 500;

export const RUN_LOG_COLUMNS: ReadonlyArray<keyof RunLogEntry> = [
  "runId",
  "dateUtc",
  "chainId",
  "block",
  "requestedMusd",
  "estimatedRedeemableMusd",
  "result",
  "txHash",
  "actualRedeemedMusd",
  "actualBtcReceived",
  "btcFee",
  "preflightMs",
  "simulateMs",
  "confirmMs",
  "errorCategory",
  "notes",
];

export function readRunLog(): RunLogEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RunLogEntry[]) : [];
  } catch (error) {
    console.warn("PegPath run log unavailable", error);
    return [];
  }
}

export function recordRun(entry: Partial<RunLogEntry> & Pick<RunLogEntry, "runId" | "result">): void {
  const full: RunLogEntry = {
    dateUtc: new Date().toISOString(),
    chainId: 31611,
    block: "",
    requestedMusd: "",
    estimatedRedeemableMusd: "",
    txHash: "",
    actualRedeemedMusd: "",
    actualBtcReceived: "",
    btcFee: "",
    preflightMs: "",
    simulateMs: "",
    confirmMs: "",
    errorCategory: "",
    notes: "",
    ...entry,
  };
  try {
    const next = [...readRunLog(), full].slice(-MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("PegPath run log not saved", error);
  }
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function runLogCsv(entries: RunLogEntry[]): string {
  const header = RUN_LOG_COLUMNS.join(",");
  const rows = entries.map((e) => RUN_LOG_COLUMNS.map((c) => csvCell(e[c])).join(","));
  return [header, ...rows].join("\n");
}
