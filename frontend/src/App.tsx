import "./App.css"
// Section and purpose styles, kept apart from the component styles in App.css.
import "./AppSections.css"
import type { ReactNode } from "react"
import { BatchRiskCard } from "./components/BatchRiskCard.js"
import { AuthorizationCard } from "./components/AuthorizationCard.js"
import { AuditCard } from "./components/AuditCard.js"
import { ConnectWallet } from "./components/ConnectWallet.js"
import { GuardCard } from "./components/GuardCard.js"
import { NonceConflictCard } from "./components/NonceConflictCard.js"
import { RiskDecisionCard } from "./components/RiskDecisionCard.js"
import { PolicyChat } from "./components/PolicyChat.js"
import { PolicyPanel } from "./components/PolicyPanel.js"
import { RiskFeedCard } from "./components/RiskFeedCard.js"
import { SafeCard } from "./components/SafeCard.js"
import { SimulateAttackCard } from "./components/SimulateAttackCard.js"
import { SimulationIntegrityCard } from "./components/SimulationIntegrityCard.js"
import { SimulationCard } from "./components/SimulationCard.js"
import { VerificationStatusCard } from "./components/VerificationStatusCard.js"
import { activeChain } from "./config.js"

/**
 * A labelled group of cards. The `source` line is the important part: a reader
 * should never have to guess whether a number in front of them came off the
 * chain, out of the backend, or out of a sample fixture.
 */
function Section({
  title,
  source,
  tone = "live",
  children,
}: {
  title: string
  source: string
  tone?: "live" | "sample"
  children: ReactNode
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        <span className={`section-source section-source-${tone}`}>{source}</span>
      </div>
      <div className="grid">{children}</div>
    </section>
  )
}

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div>
          <span className="brand">Tripwire</span>
          <span className="chain-pill">{activeChain.name}</span>
        </div>
        <ConnectWallet />
      </header>

      <div className="purpose">
        <h1 className="purpose-title">
          Every transaction from this wallet, scored before it can execute.
        </h1>
        <p className="purpose-body">
          Tripwire watches this Safe while a transaction is still pending, scores
          it, and writes a verdict the Guard reads on-chain. Below: what is
          currently protected, what has been decided, and why.
        </p>
      </div>

      <Section
        title="Live monitoring"
        source="Live — this wallet and the risk engine"
      >
        <RiskFeedCard />
        <SafeCard />
        <GuardCard />
        <VerificationStatusCard />
      </Section>

      <Section
        title="Decision trail"
        source="Live — recorded verdicts and simulations"
      >
        <AuditCard />
        <SimulationCard />
      </Section>

      <Section title="Policy" source="Live — the Guard's on-chain configuration">
        <PolicyPanel />
      </Section>

      <Section
        title="Investigation tools"
        source="Sample data — not reading live transactions yet"
        tone="sample"
      >
        <RiskDecisionCard />
        <BatchRiskCard />
        <SimulationIntegrityCard />
        <AuthorizationCard />
        <NonceConflictCard />
      </Section>

      <Section
        title="Demo controls"
        source="Sends a real transaction into the pipeline"
        tone="sample"
      >
        <SimulateAttackCard />
      </Section>

      <PolicyChat />
    </div>
  )
}

export default App
