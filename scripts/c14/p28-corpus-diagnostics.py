from __future__ import annotations
from pathlib import Path
from collections import Counter
import json, re, sys

corpus = Path(sys.argv[1])
out = Path(sys.argv[2])
rows = json.loads((corpus / "private-inputs.json").read_text())

def decode(path: str):
    text = "".join(Path(path).read_text().split()).lower()
    if text.startswith("0x"):
        text = text[2:]
    raw = bytes.fromhex(text)
    ins = []
    pc = 0
    while pc < len(raw):
        op = raw[pc]
        imm = b""
        size = 1
        if 0x60 <= op <= 0x7f:
            width = op - 0x5f
            imm = raw[pc + 1:min(len(raw), pc + 1 + width)]
            size += width
        ins.append((pc, op, imm))
        pc += size
    return ins, text

def source_observation(path):
    if not path or not Path(path).is_file():
        return {"available": False}
    source = Path(path).read_text(errors="replace")
    match = re.search(r"pragma\s+solidity\s+([^;]+);", source, re.I)
    pragma = match.group(1).strip() if match else None
    version = re.search(r"(\d+)\.(\d+)", pragma or "")
    family = "UNKNOWN"
    if version:
        major, minor = map(int, version.groups())
        if major == 0 and minor < 5: family = "PRE_0_5"
        elif major == 0 and minor == 5: family = "0_5_X"
        elif major == 0 and minor == 6: family = "0_6_X"
        elif major == 0 and minor == 7: family = "0_7_X"
        elif major > 0 or minor >= 8: family = "0_8_PLUS"
    return {
        "available": True,
        "pragma": pragma,
        "pragmaFamily": family,
        "floatingPragma": bool(pragma and re.search(r"\^|>=|>|\*|\bx\b", pragma, re.I)),
        "declaresLibrary": bool(re.search(r"\blibrary\s+[A-Za-z_]\w*", source)),
        "usesLibrary": bool(re.search(r"\busing\s+[^;]+\s+for\s+", source)),
    }

def runtime_observation(path):
    ins, text = decode(path)
    ops = [op for _, op, _ in ins]
    calls = [i for i, (_, op, _) in enumerate(ins) if op in (0xf1, 0xf2, 0xf4)]
    stipend = 0
    for index in calls:
        for _, op, imm in ins[max(0, index - 14):index]:
            if imm and op in (0x60, 0x61) and int.from_bytes(imm, "big") == 2300:
                stipend += 1
                break
    return {
        "instructionCount": len(ins),
        "call": len(calls),
        "callPop": sum(index + 1 < len(ins) and ins[index + 1][1] == 0x50 for index in calls),
        "callThenSstore": sum(any(op == 0x55 for _, op, _ in ins[index + 1:]) for index in calls),
        "stipend2300NearCall": stipend,
        "jump": ops.count(0x56),
        "jumpi": ops.count(0x57),
        "jumpdest": ops.count(0x5b),
        "delegatecall": ops.count(0xf4),
        "selfdestruct": ops.count(0xff),
        "origin": ops.count(0x32),
        "blockhash": ops.count(0x40),
        "timestamp": ops.count(0x42),
        "number": ops.count(0x43),
        "arithmetic": sum(ops.count(op) for op in (0x01, 0x02, 0x03)),
        "minimalProxy": bool(re.search(r"363d3d373d3d3d363d73[0-9a-f]{40}5af43d82803e903d91602b57fd5bf3", text)),
        "eip1967Literal": "360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" in text,
    }

cases = []
for row in rows:
    cases.append({
        "source": source_observation(row.get("sourceFile")),
        "runtime": runtime_observation(row["runtimeFile"]),
        "labels": [x for x in row["consensusLabels"] if not x["ambiguous"]],
    })

features = ["call", "callPop", "callThenSstore", "stipend2300NearCall", "jumpi", "delegatecall", "selfdestruct", "origin", "blockhash", "timestamp", "number", "arithmetic"]
classes = {}
for swc in ("101", "103", "104", "107", "113", "114", "115", "120"):
    positive, negative = [], []
    for row in cases:
        label = next((x for x in row["labels"] if x["swc"] == swc), None)
        if label:
            (positive if label["expected"] else negative).append(row)
    def rate(group, feature):
        return round(sum(x["runtime"][feature] > 0 for x in group) / len(group), 4) if group else None
    classes[swc] = {
        "positivePairs": len(positive),
        "negativePairs": len(negative),
        "sourceAvailablePositive": round(sum(x["source"]["available"] for x in positive) / len(positive), 4) if positive else None,
        "sourceAvailableNegative": round(sum(x["source"]["available"] for x in negative) / len(negative), 4) if negative else None,
        "featurePresence": {feature: {"positive": rate(positive, feature), "negative": rate(negative, feature)} for feature in features},
    }

sources = [x["source"] for x in cases if x["source"]["available"]]
payload = {
    "schema": "velmere.c14.p28.corpus-diagnostics.v1",
    "uniqueRuntimeCases": len(cases),
    "sourceAvailable": len(sources),
    "sourceUnavailable": len(cases) - len(sources),
    "sourceBinding": "CGT_ASSOCIATION_NOT_RECOMPILED_OR_VERIFIED",
    "pragmaFamilies": dict(Counter(x["pragmaFamily"] for x in sources)),
    "pragmaTop": Counter(x["pragma"] or "NONE" for x in sources).most_common(25),
    "floatingPragmaSources": sum(x["floatingPragma"] for x in sources),
    "sourcesDeclaringLibrary": sum(x["declaresLibrary"] for x in sources),
    "sourcesUsingLibrary": sum(x["usesLibrary"] for x in sources),
    "proxySignals": {
        "minimalProxy": sum(x["runtime"]["minimalProxy"] for x in cases),
        "eip1967Literal": sum(x["runtime"]["eip1967Literal"] for x in cases),
        "delegatecallPresent": sum(x["runtime"]["delegatecall"] > 0 for x in cases),
    },
    "classes": classes,
    "limitations": [
        "Pragma constraints are source-text observations, not authenticated compiler versions.",
        "CGT source/runtime association was not recompiled or independently verified here.",
        "Proxy/library indicators are structural observations, not complete semantic classification.",
        "These features are diagnostics only and are not used as address/hash/benchmark-name hardcodes."
    ],
}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(payload, indent=2, sort_keys=True))
print(json.dumps(payload, indent=2, sort_keys=True))
