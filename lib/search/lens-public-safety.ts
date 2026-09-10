import type { LensReport } from "@/lib/search/lens-report";

/**
 * Applies the existing no-confirmed-source customer-output brake before the
 * report is frozen. The returned report is the payload used by preview, token,
 * PDF, durable replay and account replay.
 */
export function applyPass4823LensPublicSafetyBoundary(args: {
  report: LensReport;
  customerOutput: string;
  confirmedSourceCount: number;
  confidence: number;
}): LensReport {
  if (args.confirmedSourceCount > 0 && args.confidence > 0) return args.report;
  return {
    ...args.report,
    pass2287: { ...args.report.pass2287, customerOutput: args.customerOutput },
    pass2289: { ...args.report.pass2289, customerOutput: args.customerOutput },
    pass2290: { ...args.report.pass2290, customerOutput: args.customerOutput },
    pass2291: { ...args.report.pass2291, customerOutput: args.customerOutput },
  };
}
