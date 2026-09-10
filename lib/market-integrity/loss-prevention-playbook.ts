import type { InvestigatorEvidenceStatus } from "./market-data-contract";

export type LossPreventionCaseStudy = {
  id: string;
  title: string;
  pattern: string;
  lesson: string;
  botQuestion: string;
};

export type BehavioralTrap = {
  id: string;
  label: string;
  trigger: string;
  risk: string;
  counterMove: string;
};

export type RiskHabit = {
  id: string;
  label: string;
  body: string;
};

export type LossPreventionPlaybook = {
  title: string;
  subtitle: string;
  thesis: string;
  caseStudies: LossPreventionCaseStudy[];
  behavioralTraps: BehavioralTrap[];
  riskHabits: RiskHabit[];
  answerRules: string[];
  disclaimer: string;
};

export const lossPreventionPlaybook: LossPreventionPlaybook = {
  title: "VLM Loss-Prevention Layer",
  subtitle: "Investor protection / anti-hype / behavioral risk",
  thesis:
    "The purpose of Shield is not to predict the future perfectly. The purpose is to slow the user down before a hype-driven entry, expose missing data and stop a weak thesis from becoming a catastrophic position.",
  caseStudies: [
    {
      id: "luna-reflexive-collapse",
      title: "Reflexive collapse lesson",
      pattern:
        "A token can look liquid and unstoppable while the underlying mechanism depends on confidence, incentives and fragile exit liquidity.",
      lesson:
        "If the system breaks when everyone exits at once, the chart can turn from opportunity into liquidity trap. Shield must ask how the price is supported, not only how fast it is rising.",
      botQuestion:
        "What mechanism supports demand, and what happens if incentives, peg logic, yield narrative or liquidity support disappears?",
    },
    {
      id: "low-float-rebrand",
      title: "Low-float / rebrand lesson",
      pattern:
        "A project can pump after a narrative reset, ticker attention or supply-controlled market, while most supply is still locked or poorly explained.",
      lesson:
        "A strong chart does not erase float risk, unlock risk or insider concentration. Shield treats missing vesting and unclear allocations as danger, not as neutral.",
      botQuestion:
        "How much supply is really circulating, who owns the rest, and when can it hit the market?",
    },
    {
      id: "parabolic-ai-gaming",
      title: "Parabolic social hype lesson",
      pattern:
        "Influencer attention, trending tags and exchange momentum can create a price move that feels inevitable.",
      lesson:
        "A user often buys the story after the move already happened. Shield must separate organic demand from coordinated hype, KOL incentives and thin order books.",
      botQuestion:
        "Who is promoting this, are incentives disclosed, and can the order book absorb exits without collapsing?",
    },
  ],
  behavioralTraps: [
    {
      id: "fomo",
      label: "FOMO",
      trigger: "Price is already vertical and social media says this is the next big thing.",
      risk: "The user buys someone else's exit liquidity.",
      counterMove: "Wait for source checks: float, unlocks, liquidity depth and KOL disclosures.",
    },
    {
      id: "lottery-thinking",
      label: "Lottery thinking",
      trigger: "The user focuses on 10x upside and ignores the probability of a full loss.",
      risk: "One oversized gamble can destroy months of stable progress.",
      counterMove: "Prefer risk-capped plans, position limits and boring compounding over all-in exposure.",
    },
    {
      id: "authority-bias",
      label: "Authority bias",
      trigger: "A big influencer, exchange listing or polished website creates trust.",
      risk: "Marketing quality is mistaken for source quality.",
      counterMove: "Demand evidence: contract controls, vesting, holders, liquidity and independent sources.",
    },
    {
      id: "revenge-entry",
      label: "Revenge entry",
      trigger: "The user missed the move and wants to catch up immediately.",
      risk: "Late entries often happen when early holders are ready to distribute.",
      counterMove: "Use a cooling-off rule and force the bot to show missing-data blockers first.",
    },
  ],
  riskHabits: [
    {
      id: "boring-before-gamble",
      label: "Stable base before speculation",
      body:
        "Speculation should not replace a stable financial base. A slower plan with controlled risk is usually more durable than chasing one explosive token.",
    },
    {
      id: "small-risk-until-proven",
      label: "Small risk until proven",
      body:
        "If vesting, holders, contract or liquidity are unclear, the default position is not confidence. The default is caution.",
    },
    {
      id: "evidence-over-story",
      label: "Evidence over story",
      body:
        "A good story can move price, but evidence decides whether the move is structurally healthy or just engineered pressure.",
    },
    {
      id: "no-single-shot",
      label: "No single-shot future",
      body:
        "A user should not let one token decide their financial future. Concentrated gambles feel exciting because the downside is psychologically minimized.",
    },
  ],
  answerRules: [
    "Always explain why the check matters for loss prevention.",
    "Always separate upside narrative from downside mechanics.",
    "Always show at least one behavioral trap when the token is pumping.",
    "Always end with one risk-control next action, not a buy/sell instruction.",
    "Never say a token is safe. Say what is verified, missing or still uncertain.",
  ],
  disclaimer:
    "VLM Shield is an educational risk and transparency tool. It does not provide financial advice and does not tell users to buy or sell.",
};

export function statusLabel(status: InvestigatorEvidenceStatus) {
  if (status === "red_flag") return "red flag";
  if (status === "confirmed") return "confirmed";
  if (status === "likely") return "likely";
  if (status === "unverified") return "unverified";
  return "unknown";
}
