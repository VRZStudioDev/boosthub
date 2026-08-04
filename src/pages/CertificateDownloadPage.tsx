import { useState } from "react";
import { PageLayout } from "../components/layout/PageLayout";

export default function CertificateDownloadPage() {
  const [copied, setCopied] = useState(false);

  const downloadCert = () => {
    const a = document.createElement("a");
    a.href = "/boosthub-ca-cert.pem";
    a.download = "boosthub-ca-cert.pem";
    a.click();
  };

  const copyIOSSteps = () => {
    navigator.clipboard.writeText(
      "1. Download the certificate by tapping the button above.\n" +
      "2. Go to Settings > General > About > Certificate Trust Settings.\n" +
      "3. Enable full trust for \"boosthub.solutions\".\n" +
      "4. Configure your VPN/proxy to use BoostHub as the MITM proxy.\n" +
      "5. Open DoorDash — offers will now show ✅/❌ indicators."
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageLayout>
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-24">
        <div className="max-w-2xl w-full bg-[#0D1117] border border-blue-500/20 rounded-2xl p-8 md:p-12 text-center">
          <span className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 text-xs font-bold px-3 py-1 rounded-full mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            SSL Certificate
          </span>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Install BoostHub Certificate
          </h1>
          <p className="text-blue-100/60 mb-8 leading-relaxed">
            This certificate enables BoostHub to inspect DoorDash HTTPS traffic on your device,
            showing you <span className="text-green-400">✅</span>/<span className="text-red-400">❌</span> indicators
            for each order. Your data is never stored or shared.
          </p>

          <button
            onClick={downloadCert}
            className="w-full md:w-auto px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors mb-6"
          >
            Download Certificate (.pem)
          </button>

          <div className="bg-[#161B22] border border-white/5 rounded-xl p-6 text-left">
            <h3 className="text-white font-bold mb-4">Installation Steps</h3>
            <ol className="space-y-3 text-blue-100/70 text-sm">
              <li className="flex gap-3">
                <span className="text-blue-400 font-mono">1.</span>
                Download the certificate using the button above
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 font-mono">2.</span>
                Open <code className="bg-white/5 px-2 py-0.5 rounded text-xs">Settings → General → About</code>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 font-mono">3.</span>
                Scroll to <strong>Certificate Trust Settings</strong>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 font-mono">4.</span>
                Enable full trust for <code className="bg-white/5 px-2 py-0.5 rounded text-xs text-green-400">boosthub.solutions</code>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 font-mono">5.</span>
                Your proxy will now inspect DoorDash traffic and show offer
                indicators
              </li>
            </ol>
          </div>

          <button
            onClick={copyIOSSteps}
            className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            {copied ? "Copied!" : "Copy instructions"}
          </button>
        </div>
      </div>
    </PageLayout>
  );
}

