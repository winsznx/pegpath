"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useBlockNumber, usePublicClient, useWalletClient } from "wagmi";
import { useMezoAccount } from "@/hooks/useMezoAccount";
import { formatUnitsExact, parseTokenAmount } from "@/lib/amounts/units";
import { MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";
import { toUserMessage } from "@/lib/errors/toUserMessage";
import { checkFreshness } from "@/lib/redemption/quoteFreshness";
import { readOracleMovement, readProtocolSnapshot } from "@/lib/redemption/readPreflight";
import { verifyDeployment } from "@/lib/redemption/verifyDeployment";
import { useNow } from "@/hooks/useNow";
import { useRedemptionFlow } from "@/hooks/useRedemptionFlow";
import { AmountInput } from "@/components/AmountInput";
import { NativeQuoteCard, ReasonBlock } from "@/components/NativeQuoteCard";
import { ProtocolStrip } from "@/components/ProtocolStrip";
import { RedemptionPath } from "@/components/RedemptionPath";
import { ReviewDrawer } from "@/components/ReviewDrawer";
import { TransactionStatus } from "@/components/TransactionStatus";
import { OnboardingNudge } from "@/components/OnboardingNudge";
import { Button } from "@/components/ui";

export function RedeemWorkbench() {
  const publicClient = usePublicClient({ chainId: MEZO_TESTNET_ID });
  const account = useMezoAccount();
  const { data: walletClient } = useWalletClient();
  const { data: latestBlock } = useBlockNumber({ chainId: MEZO_TESTNET_ID, watch: true });
  const flow = useRedemptionFlow(publicClient);
  const { check: checkState, review, tx, walletError } = flow.state;

  const [amount, setAmount] = useState("");
  const [attempted, setAttempted] = useState(false);
  const parsed = useMemo(() => parseTokenAmount(amount), [amount]);
  const amountWei = parsed.ok ? parsed.wei : null;

  const wallet = account.address;
  const onMezo = account.onMezo;

  const deployment = useQuery({
    queryKey: ["deployment", MEZO_TESTNET_ID],
    queryFn: () => verifyDeployment(publicClient!),
    enabled: Boolean(publicClient),
    staleTime: Infinity,
  });
  const protocol = useQuery({
    queryKey: ["protocol-snapshot", MEZO_TESTNET_ID],
    queryFn: async () => {
      const snapshot = await readProtocolSnapshot(publicClient!);
      return { snapshot, oracleMovement: await readOracleMovement(publicClient!, snapshot) };
    },
    enabled: Boolean(publicClient) && deployment.isSuccess,
    staleTime: Infinity,
  });

  const result = checkState.status === "done" ? checkState.result : null;
  const resultIsCurrent =
    checkState.status === "done" && checkState.amountWei === amountWei && checkState.wallet === wallet;

  const readyQuote = result?.kind === "ready" ? result.quote : null;
  const reviewQuote = review.status === "ready" ? review.quote : null;
  const activeQuote = reviewQuote ?? readyQuote;
  const now = useNow(activeQuote !== null);
  const freshnessFor = (q: typeof activeQuote) =>
    q
      ? checkFreshness(q, {
          nowMs: now,
          latestBlock: latestBlock ?? null,
          chainId: account.chainId,
          wallet,
          amountWei,
        })
      : null;

  const reviewBlockedReason = !onMezo
    ? "Switch your wallet to Mezo Testnet to review."
    : null;
  const confirmDisabledReason = !onMezo
    ? "Switch your wallet to Mezo Testnet"
    : !walletClient
      ? "Wallet is not ready yet"
      : null;

  const deploymentError = deployment.error ? toUserMessage(deployment.error) : null;
  const checked = result !== null && resultIsCurrent;
  const snapshot = (checked && result.snapshot) || protocol.data?.snapshot || null;
  const plan = result?.kind === "ready" || result?.kind === "public" ? result.plan : result?.kind === "blocked" ? result.plan : null;
  const reliability =
    result?.kind === "ready" ? result.quote.reliability : result?.kind === "public" || result?.kind === "blocked" ? result.reliability : null;
  const checkedMovement =
    result?.kind === "ready" ? result.quote.oracleMovement : result?.kind === "public" || result?.kind === "blocked" ? result.oracleMovement : null;
  const oracleMovement = (checked && checkedMovement) || protocol.data?.oracleMovement || null;

  const runCheck = (wei: bigint | null = amountWei) => {
    setAttempted(true);
    if (wei === null || !deployment.isSuccess) return;
    void flow.check(wei, wallet);
  };

  const useAmount = (wei: bigint) => {
    flow.closeReview();
    setAmount(formatUnitsExact(wei));
    runCheck(wei);
  };

  const walletSnapshot = result && "wallet" in result && resultIsCurrent ? result.wallet : null;
  const walletMusd = walletSnapshot?.musdBalance ?? null;
  const walletBtc = walletSnapshot?.btcBalance ?? null;
  const checking = checkState.status === "checking";
  const txActive = tx.status !== "none" && tx.status !== "awaiting-wallet";

  return (
    <div className="grid grid-cols-1 gap-8 pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12 lg:pt-10">
      <div className="space-y-6">
        {txActive ? (
          <TransactionStatus
            tx={tx}
            onStartOver={() => {
              flow.resetTx();
              setAttempted(false);
            }}
          />
        ) : (
          <>
            <div className="max-w-xl">
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Redeem MUSD for BTC</h1>
              <p className="mt-2 text-ink-soft">
                Enter an amount. PegPath reads Mezo, simulates your exact transaction, and only then lets you sign.
              </p>
            </div>

            <OnboardingNudge account={account} musdBalance={walletMusd} btcBalance={walletBtc} />

            {deploymentError && <ReasonBlock reason={deploymentError} />}

            <AmountInput
              value={amount}
              onChange={setAmount}
              parsed={parsed}
              balanceWei={walletMusd}
              showError={attempted && amount.trim() !== ""}
              onSubmit={() => runCheck()}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => runCheck()} disabled={checking || !deployment.isSuccess || amount.trim() === ""}>
                {checking ? "Checking Mezo…" : "Check redemption"}
              </Button>
              <span className="text-sm text-ink-faint" aria-live="polite">
                {deployment.isPending
                  ? "Verifying Mezo contracts…"
                  : deployment.isSuccess
                    ? `${deployment.data.contracts.length} Mezo contracts verified against pinned implementations`
                    : null}
              </span>
            </div>

            {result && resultIsCurrent && !checking && (
              <NativeQuoteCard
                result={result}
                freshness={freshnessFor(readyQuote)}
                reviewBlockedReason={reviewBlockedReason}
                onReview={() => readyQuote && flow.recheck(readyQuote)}
                onRefresh={() => runCheck()}
                onUseAmount={useAmount}
              />
            )}
            {result && !resultIsCurrent && !checking && (
              <p className="text-sm text-ink-soft">The amount or wallet changed. Check again to get a new quote.</p>
            )}
          </>
        )}
      </div>

      <aside className="space-y-6 lg:pt-2">
        {snapshot ? (
          <ProtocolStrip snapshot={snapshot} oracleMovement={oracleMovement} />
        ) : protocol.error ? (
          <div className="space-y-3">
            <ReasonBlock reason={toUserMessage(protocol.error)} />
            <Button variant="secondary" onClick={() => protocol.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <p className="rounded-2xl bg-sheet p-5 text-sm text-ink-soft ring-1 ring-rule">Reading Mezo Testnet…</p>
        )}
        {plan && resultIsCurrent && snapshot && (
          <RedemptionPath plan={plan} blockNumber={snapshot.blockNumber} reliability={reliability} oracleMovement={oracleMovement} />
        )}
      </aside>

      <ReviewDrawer
        review={review}
        freshness={freshnessFor(reviewQuote)}
        walletError={walletError}
        awaitingWallet={tx.status === "awaiting-wallet"}
        confirmDisabledReason={confirmDisabledReason}
        onConfirm={() => {
          const quote = reviewQuote;
          const fresh = freshnessFor(quote);
          if (!quote || !walletClient || !fresh?.fresh) return;
          void flow.confirm(walletClient, quote);
        }}
        onAccept={flow.acceptChanges}
        approval={flow.state.approval}
        onApprove={() => {
          if (reviewQuote && walletClient) void flow.approve(walletClient, reviewQuote);
        }}
        onRecheck={() => review.status !== "closed" && flow.recheck(review.quote)}
        onClose={flow.closeReview}
        onUseAmount={useAmount}
      />
    </div>
  );
}
