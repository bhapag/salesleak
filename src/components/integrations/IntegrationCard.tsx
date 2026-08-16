"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ConnectorView } from "@/server/data/ingestion";
import { generateWebhookConfig, regenerateSigningSecret, toggleIntegrationEnabled, sendTestPayload, type TestPayloadResult } from "@/server/actions/integrations";
import { IntegrationStatusBadge, ConnectorHealthDot } from "@/components/badges";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export function IntegrationCard({ connector }: { connector: ConnectorView }) {
  const [pending, startTransition] = useTransition();
  const [webhookUrl, setWebhookUrl] = useState(connector.webhookUrl);
  const [hasSecret, setHasSecret] = useState(connector.hasSigningSecret);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestPayloadResult | null>(null);
  const [copied, setCopied] = useState(false);

  function absoluteUrl(path: string) {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleSetup() {
    startTransition(async () => {
      const result = await generateWebhookConfig(connector.type);
      setWebhookUrl(result.webhookUrl);
    });
  }

  function handleToggle() {
    startTransition(async () => {
      await toggleIntegrationEnabled(connector.type, !connector.enabled);
    });
  }

  function handleRegenerateSecret() {
    startTransition(async () => {
      const result = await regenerateSigningSecret(connector.type);
      setRevealedSecret(result.signingSecret);
      setHasSecret(true);
    });
  }

  function handleTest() {
    setTestResult(null);
    startTransition(async () => {
      const result = await sendTestPayload(connector.type);
      setTestResult(result);
    });
  }

  const isSetUp = !!webhookUrl;

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {connector.webhookCapable && <ConnectorHealthDot health={connector.health} title={`Health: ${connector.health}`} />}
            <h3 className="text-sm font-semibold text-slate-900">{connector.label}</h3>
          </div>
          <IntegrationStatusBadge status={connector.status} enabled={isSetUp ? connector.enabled : true} />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">{connector.description}</p>

        {connector.type === "INDIAMART" && (
          <p className="mt-2 text-xs font-medium text-sky-700">Test Mode / Credentials Required — no live IndiaMART account is connected.</p>
        )}

        {connector.webhookCapable && (
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <div>
              <dt className="text-slate-400">Records received</dt>
              <dd className="text-slate-700">{connector.totalReceived}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Last success</dt>
              <dd className="text-slate-700">{connector.lastSuccessAt ? formatDateTime(connector.lastSuccessAt) : "Never"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">Last attempt</dt>
              <dd className="text-slate-700">{connector.lastSyncAt ? formatDateTime(connector.lastSyncAt) : "Never"}</dd>
            </div>
            {connector.lastError && (
              <div className="col-span-2">
                <dt className="text-slate-400">Last error</dt>
                <dd className="font-medium text-red-600">{connector.lastError}</dd>
              </div>
            )}
          </dl>
        )}

        {isSetUp && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg bg-slate-50 p-2.5">
            <div>
              <p className="text-xs font-medium text-slate-500">Webhook URL</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-[11px] text-slate-700 ring-1 ring-slate-200">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copy(absoluteUrl(webhookUrl!))}
                  className="shrink-0 rounded px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            {connector.type === "WEBSITE" && (
              <div>
                <p className="text-xs font-medium text-slate-500">Test form page</p>
                <a
                  href={webhookUrl!.replace("/api/webhooks/website/", "/website-form/")}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block truncate text-xs font-medium text-slate-900 hover:underline"
                >
                  Open the demo enquiry form →
                </a>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-slate-500">Signing secret (optional)</p>
              {revealedSecret ? (
                <div className="mt-0.5 rounded bg-amber-50 px-2 py-1.5">
                  <p className="text-[11px] font-medium text-amber-800">Copy this now — it won&apos;t be shown again:</p>
                  <code className="mt-0.5 block break-all text-[11px] text-amber-900">{revealedSecret}</code>
                </div>
              ) : (
                <p className="mt-0.5 text-[11px] text-slate-500">{hasSecret ? "•••••••••••••••• (configured)" : "Not set — signature verification is skipped"}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!isSetUp && connector.webhookCapable && (
          <PrimaryButton onClick={handleSetup} disabled={pending} className="!py-1.5 !text-xs">
            Set Up Webhook
          </PrimaryButton>
        )}
        {isSetUp && (
          <>
            <SecondaryButton onClick={handleTest} disabled={pending} className="!py-1.5 !text-xs">
              Send Test Payload
            </SecondaryButton>
            <SecondaryButton onClick={handleRegenerateSecret} disabled={pending} className="!py-1.5 !text-xs">
              {hasSecret ? "Regenerate Secret" : "Generate Secret"}
            </SecondaryButton>
            <button
              type="button"
              onClick={handleToggle}
              disabled={pending}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
            >
              {connector.enabled ? "Disable" : "Enable"}
            </button>
          </>
        )}
        {connector.type === "CSV_IMPORT" && (
          <Link href="/leads/import" className="text-sm font-medium text-slate-900 hover:underline">
            Import a CSV →
          </Link>
        )}
        {connector.type === "MANUAL" && (
          <Link href="/leads" className="text-sm font-medium text-slate-900 hover:underline">
            Add a lead →
          </Link>
        )}
        {!connector.functional && <p className="text-xs text-slate-400">Not available yet in this local build.</p>}
      </div>

      {testResult && <TestResultPanel result={testResult} />}
    </Card>
  );
}

function TestResultPanel({ result }: { result: TestPayloadResult }) {
  const success = result.outcome && result.outcome.httpStatus < 400;
  const reason = typeof result.outcome?.body.reason === "string" ? result.outcome.body.reason : null;
  return (
    <div className={`mt-3 rounded-lg border p-3 ${success ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <p className={`text-xs font-semibold ${success ? "text-emerald-800" : "text-amber-800"}`}>
        {result.parseError
          ? "Parse failed"
          : result.outcome?.body.status === "created"
            ? "Test lead created"
            : result.outcome?.body.status === "duplicate"
              ? "Detected as a possible duplicate"
              : "Ingestion failed"}
      </p>
      {result.parseError && <p className="mt-1 text-xs text-amber-700">{result.parseError}</p>}
      {result.normalized && (
        <div className="mt-2">
          <p className="text-[11px] font-medium text-slate-600">Normalized data</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-700">
            <div>Customer: {result.normalized.customerName}</div>
            <div>Phone: {result.normalized.phone ?? "—"}</div>
            <div>Product: {result.normalized.product ?? "—"}</div>
            <div>Value: {result.normalized.estimatedValue ?? "—"}</div>
          </dl>
        </div>
      )}
      {reason && <p className="mt-1 text-xs text-slate-600">{reason}</p>}
    </div>
  );
}
