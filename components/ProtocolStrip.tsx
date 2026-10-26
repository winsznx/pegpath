import { formatPpmPercent, formatRatioPercent, formatUsdPrice } from "@/lib/amounts/units";
import { explorerBlockUrl } from "@/lib/chain/mezoTestnet";
import type { OracleMovement, ProtocolSnapshot } from "@/lib/types";

/** The protocol readings a quote depends on, all from one block. */
export function ProtocolStrip({ snapshot, oracleMovement }: { snapshot: ProtocolSnapshot; oracleMovement: OracleMovement | null }) {
  const tcrOk = snapshot.tcr >= snapshot.mcr;
  const checkedAt = new Date(Number(snapshot.blockTimestamp) * 1000);
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-rule ring-1 ring-rule">
      <Cell label="BTC price (Mezo oracle)">${formatUsdPrice(snapshot.price)}</Cell>
      <Cell label="System collateral ratio">
        <span className={tcrOk ? undefined : "text-stop"}>{formatRatioPercent(snapshot.tcr, 1)}</span>
        <span className="block text-xs font-normal text-ink-faint">
          {tcrOk ? "Above the 110% redemption floor" : "Below 110%: redemptions blocked"}
        </span>
      </Cell>
      <Cell label="Redemption fee">
        {formatRatioPercent(snapshot.redemptionRate, 2)}
        <span className="block text-xs font-normal text-ink-faint">of BTC drawn, read on-chain</span>
      </Cell>
      <Cell label="Oracle movement">
        {oracleMovement ? `${formatPpmPercent(oracleMovement.movePpm)}` : "Unavailable"}
        {oracleMovement && (
          <span className="block text-xs font-normal text-ink-faint">
            over the last {oracleMovement.blocks.toString()} blocks ({oracleMovement.seconds.toString()} s)
          </span>
        )}
      </Cell>
      <p className="col-span-2 bg-sheet px-4 py-2.5 text-xs text-ink-faint">
        Mezo contract data last checked at block{" "}
        <a className="text-musd hover:underline" href={explorerBlockUrl(snapshot.blockNumber)} target="_blank" rel="noreferrer">
          {snapshot.blockNumber.toString()}
        </a>{" "}
        ({checkedAt.toLocaleTimeString()}), {snapshot.troveCount.toString()} troves open.
      </p>
    </dl>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-sheet px-4 py-3">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums">{children}</dd>
    </div>
  );
}
