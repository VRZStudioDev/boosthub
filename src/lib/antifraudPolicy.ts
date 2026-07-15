export type FraudDecision = 'allow' | 'review' | 'block';

export interface FraudSignals {
  disposableEmail?: boolean;
  trialAlreadyUsed?: boolean;
  repeatedPaymentSignal?: boolean;
  ipWindowCount?: number;
  priorReviewRejected?: boolean;
}

export interface FraudAssessment {
  riskScore: number;
  decision: FraudDecision;
  reasonCode: string;
}

export function scoreFraudRisk(signals: FraudSignals): number {
  let score = 0;
  if (signals.disposableEmail) score += 35;
  if (signals.trialAlreadyUsed) score += 45;
  if (signals.repeatedPaymentSignal) score += 45;
  if (signals.priorReviewRejected) score += 70;

  const count = signals.ipWindowCount ?? 0;
  if (count >= 30) score += 55;
  else if (count >= 12) score += 25;
  else if (count >= 6) score += 10;

  return Math.min(score, 100);
}

export function decideFraudPolicy(score: number, signals: FraudSignals): FraudAssessment {
  if (signals.priorReviewRejected) {
    return { riskScore: Math.max(score, 90), decision: 'block', reasonCode: 'prior_review_rejected' };
  }
  if (score >= 80) return { riskScore: score, decision: 'block', reasonCode: 'critical_risk_score' };
  if (score >= 45) return { riskScore: score, decision: 'review', reasonCode: 'elevated_risk_score' };
  return { riskScore: score, decision: 'allow', reasonCode: 'low_risk' };
}

export function assessFraud(signals: FraudSignals): FraudAssessment {
  return decideFraudPolicy(scoreFraudRisk(signals), signals);
}