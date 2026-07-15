import { describe, expect, it } from 'vitest';
import { assessFraud, decideFraudPolicy, scoreFraudRisk } from './antifraudPolicy';

describe('antifraud policy', () => {
  it('allows low-risk signups', () => {
    expect(assessFraud({ ipWindowCount: 1 })).toEqual({
      riskScore: 0,
      decision: 'allow',
      reasonCode: 'low_risk',
    });
  });

  it('routes shared-IP/disposable signals to review before block', () => {
    const score = scoreFraudRisk({ disposableEmail: true, ipWindowCount: 12 });
    expect(score).toBe(60);
    expect(decideFraudPolicy(score, { disposableEmail: true, ipWindowCount: 12 }).decision).toBe('review');
  });

  it('blocks critical repeated-trial/payment risk', () => {
    const result = assessFraud({ trialAlreadyUsed: true, repeatedPaymentSignal: true });
    expect(result.decision).toBe('block');
    expect(result.reasonCode).toBe('critical_risk_score');
  });

  it('hard-blocks a rejected manual review', () => {
    const result = assessFraud({ priorReviewRejected: true });
    expect(result.decision).toBe('block');
    expect(result.reasonCode).toBe('prior_review_rejected');
  });
});