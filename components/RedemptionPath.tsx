import { formatPpmPercent, formatRatioPercent, formatTolerance } from "@/lib/amounts/units";
import { RELIABLE_TOLERANCE_PPM } from "@/lib/redemption/partialWindow";
import type { PlanStep, RedemptionPlan } from "@/lib/redemption/planRedemption";
import { toleranceOf } from "@/lib/redemption/quote";
import type { OracleMovement, Reliability } from "@/lib/types";
import { explorerAddressUrl } from "@/lib/chain/mezoTestnet";
import { shortAddress } from "@/components/WalletButton";
import { Btc, Musd } from "@/components/ui";

const TRUNCATION_TEXT: Record<RedemptionPlan["truncation"], string | null> = {
  none: null,
  "min-net-debt":
    "Stops here: taking more would leave this trove below Mezo's 1,800 MUSD minimum debt, which TroveManager refuses.",
  "max-iterations": "Stops here: PegPath limits a redemption to 10 troves to keep gas bounded.",
  "no-more-troves": "Stops here: no further troves are eligible for redemption.",
};

function StepMarker({ step }: { step: PlanStep }) {
  const fill =
    step.kind === "close" ? "var(--musd)" : step.kind === "partial" ? "var(--sheet)" : "var(--fog)";
  const stroke = step.kind === "skip-undercollateralized" ? "var(--ink-faint)" : "var(--musd)";
  return (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="7" fill={fill} stroke={stroke} strokeWidth="2" strokeDasharray={step.kind === "skip-undercollateralized" ? "3 3" : undefined} />
      {step.kind === "partial" && <path d="M10 3 A7 7 0 0 1 10 17 Z" fill="var(--musd)" />}
    </svg>
  );
}

function stepLabel(step: PlanStep) {
  switch (step.kind) {
    case "close":
      return "Trove repaid in full and closed";
    case "partial":
      return "Partial redemption from this trove";
    case "skip-undercollateralized":
      return `Skipped: collateral ratio ${formatRatioPercent(step.icr)} is under 110%`;
  }
}

/** Visual gauge: how far the oracle may move vs. how far it just moved. */
function ToleranceGauge({ tolerancePpm, movement }: { tolerancePpm: bigint; movement: OracleMovement | null }) {
  const scale = [tolerancePpm, RELIABLE_TOLERANCE_PPM * 2n, movement?.movePpm ?? 0n].reduce((a, b) => (a > b ? a : b));
  const pct = (v: bigint) => `${Math.max(1.5, Number((v * 1000n) / scale) / 10)}%`;
  const exceeded = movement !== null && movement.movePpm > tolerancePpm;
  return (
    <div className="mt-3 space-y-2" aria-hidden>
      <div className="relative h-2 rounded-full bg-rule/60">
        <div className="absolute inset-y-0 left-0 rounded-full bg-musd" style={{ width: pct(tolerancePpm) }} />
        {movement && (
          <div
            className={`absolute -top-1 h-4 w-0.5 rounded ${exceeded ? "bg-stop" : "bg-ink"}`}
            style={{ left: pct(movement.movePpm) }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-ink-faint">
        <span>Tolerance {formatTolerance(tolerancePpm)}</span>
        {movement && <span className={exceeded ? "text-stop" : undefined}>Oracle moved {formatPpmPercent(movement.movePpm)}</span>}
      </div>
    </div>
  );
}

/**
 * The trove walk TroveManager will perform, lowest collateral ratio first. This is the signature
 * view of PegPath: where the MUSD goes, where it stops, and why.
 */
export function RedemptionPath({
  plan,
  blockNumber,
  reliability,
  oracleMovement,
}: {
  plan: RedemptionPlan;
  blockNumber: bigint;
  reliability: Reliability | null;
  oracleMovement: OracleMovement | null;
}) {
  const truncation = TRUNCATION_TEXT[plan.truncation];
  const tolerance = reliability ? toleranceOf(reliability) : null;

  return (
    <section aria-labelledby="path-heading" className="rounded-2xl bg-sheet p-5 ring-1 ring-rule sm:p-6">
      <h2 id="path-heading" className="font-display text-lg font-bold tracking-tight">
        Redemption path
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        TroveManager takes MUSD from the lowest-ratio troves first. This is the walk it would make with
        trove state at block {blockNumber.toString()}.
      </p>

      {plan.steps.length === 0 ? (
        <p className="mt-5 text-sm text-ink-soft">No eligible troves were reached.</p>
      ) : (
        <ol className="path-draw relative mt-5 space-y-4 before:absolute before:top-3 before:bottom-3 before:left-[9px] before:w-0.5 before:bg-rule">
          {plan.steps.map((step) => (
            <li key={step.owner} className="relative flex gap-3">
              <StepMarker step={step} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{stepLabel(step)}</p>
                <p className="text-xs text-ink-faint">
                  Trove{" "}
                  <a className="font-mono hover:text-musd" href={explorerAddressUrl(step.owner)} target="_blank" rel="noreferrer">
                    {shortAddress(step.owner)}
                  </a>
                </p>
                {step.kind !== "skip-undercollateralized" && (
                  <p className="mt-1 text-sm tabular-nums">
                    <Musd wei={step.musd} /> <span className="text-ink-faint">for</span> <Btc wei={step.collateral} />
                    {step.kind === "partial" && (
                      <span className="block text-xs text-ink-faint">
                        Leaves <Musd wei={step.netDebtAfter} /> net debt in the trove
                      </span>
                    )}
                  </p>
                )}
                {step.kind === "partial" && tolerance !== null && (
                  <ToleranceGauge tolerancePpm={tolerance} movement={oracleMovement} />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {truncation && <p className="mt-5 border-t border-rule pt-4 text-sm text-ink-soft">{truncation}</p>}
    </section>
  );
}
