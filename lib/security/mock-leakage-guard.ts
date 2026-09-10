/**
 * Velmère Zero Mock Leakage Guard (V2 Directive Section 9)
 * Scans generated canonical reports and PDF lines before emission.
 * Blocks any unauthorized synthetic, fixture, or cross-contract mock strings.
 */

export interface MockScannerViolation {
  forbiddenPattern: string;
  location: string;
  contextSnippet: string;
}

const FORBIDDEN_MOCK_PATTERNS: Array<{ pattern: RegExp; id: string; allowedContracts?: string[] }> = [
  {
    pattern: /2-z-3/i,
    id: "MOCK_2_OF_3_QUORUM",
  },
  {
    pattern: /48h\b/i,
    id: "MOCK_48H_TIMELOCK",
    allowedContracts: ["0x1a9c8182c09f50c8318d769245bea52c32be35bc", "oz-timelock"],
  },
  {
    pattern: /1,420,000/i,
    id: "MOCK_1420000_LP",
  },
  {
    pattern: /Unicrypt/i,
    id: "MOCK_UNICRYPT_VAULT",
  },
  {
    pattern: /365 dni/i,
    id: "MOCK_365_DAYS_LOCK",
  },
  {
    pattern: /Chainlink Price Feeds/i,
    id: "MOCK_CHAINLINK_PRICE_FEEDS",
  },
  {
    pattern: /100\s?000\s?BNB/i,
    id: "MOCK_100K_BNB_FLASH_LOAN",
  },
  {
    pattern: /24\.8%/i,
    id: "MOCK_24_8_PERCENT_CONCENTRATION",
  },
  {
    pattern: /__gap\[50\]/i,
    id: "MOCK_GAP_50_BUFFER",
  },
  {
    pattern: /Gnosis Safe/i,
    id: "MOCK_GNOSIS_SAFE_LEAK",
    allowedContracts: ["0x3e5c63644e683549055b9be8653de26e0b4cd36e", "0xd9db270c1b5e3bd161e8c8503c55ceabee709552", "safe"],
  },
  {
    pattern: /TimelockController/i,
    id: "MOCK_TIMELOCK_CONTROLLER_LEAK",
    allowedContracts: ["0x1a9c8182c09f50c8318d769245bea52c32be35bc", "oz-timelock", "timelock"],
  },
  {
    pattern: /Principal Auditor/i,
    id: "FORBIDDEN_SYNTHETIC_PRINCIPAL_AUDITOR",
  },
  {
    pattern: /Lead Auditor/i,
    id: "FORBIDDEN_SYNTHETIC_LEAD_AUDITOR",
  },
  {
    pattern: /Level-3 Lead Cryptographic/i,
    id: "FORBIDDEN_SYNTHETIC_CLEARANCE_LEVEL",
  },
  {
    pattern: /Velm[èe]re Guard/i,
    id: "FORBIDDEN_FABRICATED_BRAND_GUARD",
  },
  {
    pattern: /Velm[èe]re Institutional Automation Council/i,
    id: "FORBIDDEN_SYNTHETIC_AUTOMATION_COUNCIL",
  },
];

export function scanStringForMockLeaks(
  text: string,
  contractAddress: string,
  location: string,
  contractName?: string,
): MockScannerViolation[] {
  const violations: MockScannerViolation[] = [];
  const normalizedAddr = contractAddress.toLowerCase();
  const normalizedName = (contractName ?? "").toLowerCase();

  for (const rule of FORBIDDEN_MOCK_PATTERNS) {
    if (rule.allowedContracts) {
      const isAllowed = rule.allowedContracts.some(
        (allowed) =>
          normalizedAddr.includes(allowed.toLowerCase()) ||
          normalizedName.includes(allowed.toLowerCase()),
      );
      if (isAllowed) continue;
    }

    if (rule.pattern.test(text)) {
      const match = text.match(rule.pattern);
      const matchIndex = match?.index ?? 0;
      const start = Math.max(0, matchIndex - 30);
      const end = Math.min(text.length, matchIndex + 50);
      violations.push({
        forbiddenPattern: rule.id,
        location,
        contextSnippet: text.slice(start, end),
      });
    }
  }

  return violations;
}

export function assertZeroMockLeakage(
  report: {
    target: { contractAddress: string; contractName: string };
    sections: Array<{
      id: string;
      sampleSummaryLines?: string[];
      data?: {
        keyValuePairs?: Array<{ label: string; value: string }>;
        metrics?: Array<{ label: string; value: string }>;
        paragraphs?: string[];
      } | null;
    }>;
  }
): void {
  const violations: MockScannerViolation[] = [];
  const addr = report.target.contractAddress;

  for (const section of report.sections) {
    if (section.sampleSummaryLines) {
      for (let i = 0; i < section.sampleSummaryLines.length; i++) {
        const line = section.sampleSummaryLines[i];
        violations.push(...scanStringForMockLeaks(line, addr, `section[${section.id}].sampleSummaryLines[${i}]`, report.target.contractName));
      }
    }

    if (section.data?.keyValuePairs) {
      for (const pair of section.data.keyValuePairs) {
        violations.push(...scanStringForMockLeaks(pair.value, addr, `section[${section.id}].kv[${pair.label}]`, report.target.contractName));
      }
    }

    if (section.data?.metrics) {
      for (const metric of section.data.metrics) {
        violations.push(...scanStringForMockLeaks(metric.value, addr, `section[${section.id}].metric[${metric.label}]`, report.target.contractName));
      }
    }

    if (section.data?.paragraphs) {
      for (let i = 0; i < section.data.paragraphs.length; i++) {
        violations.push(...scanStringForMockLeaks(section.data.paragraphs[i], addr, `section[${section.id}].paragraphs[${i}]`, report.target.contractName));
      }
    }
  }

  if (violations.length > 0) {
    const errorDetails = violations
      .map((v) => `[${v.forbiddenPattern}] at ${v.location}: "${v.contextSnippet}"`)
      .join("\n");
    throw new Error(
      `CRITICAL_INTEGRITY_VIOLATION: Zero Mock Leakage Gate triggered for contract ${report.target.contractName} (${addr}):\n${errorDetails}`
    );
  }
}
