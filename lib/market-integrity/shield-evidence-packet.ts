export type Pass528LaneInput = {
  id: string;
  label: string;
  score: number | null;
  status: string;
  body: string;
  nextStep: string;
};

export type Pass528EvidenceAttachment = {
  id: string;
  laneId: string;
  title: string;
  evidenceType: "signal" | "boundary" | "verification";
  status: "verified" | "review" | "missing" | "conflict";
  summary: string;
  sourceState: string;
};

export type Pass528ShieldEvidencePacket = {
  version: "shield-evidence-packet";
  activeLaneId: string | null;
  attachments: Pass528EvidenceAttachment[];
  verifiedCount: number;
  reviewCount: number;
  packetState: "ready" | "review" | "empty";
  boundary: string;
};

function normalizeStatus(status: string): Pass528EvidenceAttachment["status"] {
  if (status === "confirmed") return "verified";
  if (status === "red_flag") return "conflict";
  if (status === "unknown") return "missing";
  return "review";
}

export function buildPass528ShieldEvidencePacket(
  locale: "pl" | "de" | "en",
  lanes: Pass528LaneInput[],
  activeLaneId: string | null,
  sourceState: string,
): Pass528ShieldEvidencePacket {
  const lane = lanes.find((item) => item.id === activeLaneId) ?? lanes[0];
  if (!lane) {
    return {
      version: "shield-evidence-packet",
      activeLaneId: null,
      attachments: [],
      verifiedCount: 0,
      reviewCount: 0,
      packetState: "empty",
      boundary: "No source-bound lane is available, so the packet remains empty.",
    };
  }
  const copy = {
    pl: { signal: "Sygnał osi", boundary: "Granica dowodu", verify: "Następny test", note: "Kapsuły porządkują widoczne dane; nie są załącznikami prawnymi ani dowodem spoza bieżącej analizy." },
    de: { signal: "Achssignal", boundary: "Evidenzgrenze", verify: "Nächster Test", note: "Die Kapseln ordnen sichtbare Daten; sie sind keine rechtlichen Anlagen und kein Beweis außerhalb der aktuellen Analyse." },
    en: { signal: "Lane signal", boundary: "Evidence boundary", verify: "Next test", note: "Capsules organize visible data; they are not legal attachments or evidence beyond the current analysis." },
  }[locale];
  const status = normalizeStatus(lane.status);
  const attachments: Pass528EvidenceAttachment[] = [
    {
      id: `${lane.id}:signal`, laneId: lane.id, title: copy.signal, evidenceType: "signal", status,
      summary: lane.body, sourceState,
    },
    {
      id: `${lane.id}:boundary`, laneId: lane.id, title: copy.boundary, evidenceType: "boundary", status: status === "verified" ? "review" : status,
      summary: `${lane.score === null ? "Score unavailable — evidence is insufficient for this lane" : `Score ${lane.score}/100`} · status ${lane.status}. The score remains bounded by the attached source state.`, sourceState,
    },
    {
      id: `${lane.id}:verification`, laneId: lane.id, title: copy.verify, evidenceType: "verification", status: "review",
      summary: lane.nextStep, sourceState,
    },
  ];
  const verifiedCount = attachments.filter((item) => item.status === "verified").length;
  const reviewCount = attachments.filter((item) => item.status !== "verified").length;
  return {
    version: "shield-evidence-packet",
    activeLaneId: lane.id,
    attachments,
    verifiedCount,
    reviewCount,
    packetState: status === "verified" ? "ready" : "review",
    boundary: copy.note,
  };
}
