// PASS36 A102R44P15
// Bounded structural Solidity analyzer used as a local pre-admission and review-surface layer.
// It strips comments and string literals, understands contract/function brace regions and
// distinguishes guarded controls from materially suspicious patterns. It is NOT a full solc AST.

export const ANALYZER_CLASS = "STRUCTURED_TOKEN_CONTROL_FLOW_V3_STATE_AWARE_NOT_COMPILER_AST";

export function stripCommentsAndStrings(source) {
  let out = "";
  let i = 0;
  let state = "code";
  let quote = "";
  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1] ?? "";
    if (state === "code") {
      if (c === "/" && n === "/") {
        out += "  ";
        i += 2;
        state = "line-comment";
        continue;
      }
      if (c === "/" && n === "*") {
        out += "  ";
        i += 2;
        state = "block-comment";
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        out += " ";
        i += 1;
        state = "string";
        continue;
      }
      out += c;
      i += 1;
      continue;
    }
    if (state === "line-comment") {
      if (c === "\n") {
        out += "\n";
        state = "code";
      } else {
        out += " ";
      }
      i += 1;
      continue;
    }
    if (state === "block-comment") {
      if (c === "*" && n === "/") {
        out += "  ";
        i += 2;
        state = "code";
      } else {
        out += c === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }
    if (state === "string") {
      if (c === "\\") {
        out += "  ";
        i += Math.min(2, source.length - i);
        continue;
      }
      if (c === quote) {
        out += " ";
        i += 1;
        state = "code";
      } else {
        out += c === "\n" ? "\n" : " ";
        i += 1;
      }
    }
  }
  return out;
}

function lineForOffset(value, offset) {
  return value.slice(0, Math.max(0, offset)).split("\n").length;
}

function compact(source) {
  return stripCommentsAndStrings(source)
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function matchingBrace(code, openIndex) {
  if (openIndex < 0 || code[openIndex] !== "{") return -1;
  let depth = 0;
  for (let i = openIndex; i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function versionTuple(source) {
  const match = stripCommentsAndStrings(source).match(/\bpragma\s+solidity\s+[^;]*?(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return null;
  return match.slice(1, 4).map((value) => Number(value));
}

function versionLessThan(tuple, major, minor, patch = 0) {
  if (!tuple) return false;
  const left = tuple[0] * 1_000_000 + tuple[1] * 1_000 + tuple[2];
  const right = major * 1_000_000 + minor * 1_000 + patch;
  return left < right;
}

function extractContracts(code) {
  const rows = [];
  const pattern = /\b(?:contract|library|interface)\s+([A-Za-z_][A-Za-z0-9_]*)[^;{]*\{/g;
  for (const match of code.matchAll(pattern)) {
    const start = match.index ?? 0;
    const open = start + match[0].lastIndexOf("{");
    const close = matchingBrace(code, open);
    if (close < 0) continue;
    rows.push({ name: match[1], start, open, close, code: code.slice(open + 1, close) });
  }
  return rows;
}

function extractFunctions(contract, code, legacyDefaultPublic) {
  const rows = [];
  const local = code.slice(contract.open + 1, contract.close);
  const pattern = /\b(function\s*([A-Za-z_][A-Za-z0-9_]*)?\s*\(([^)]*)\)|constructor\s*\(([^)]*)\))\s*([^;{]*)\{/g;
  for (const match of local.matchAll(pattern)) {
    const relative = match.index ?? 0;
    const absolute = contract.open + 1 + relative;
    const open = absolute + match[0].lastIndexOf("{");
    const close = matchingBrace(code, open);
    if (close < 0 || close > contract.close) continue;
    const isConstructorKeyword = match[1].trimStart().startsWith("constructor");
    const name = isConstructorKeyword ? "constructor" : (match[2] ?? "");
    const params = isConstructorKeyword ? (match[4] ?? "") : (match[3] ?? "");
    const tail = match[5] ?? "";
    const header = code.slice(absolute, open);
    const body = code.slice(open + 1, close);
    const visibility = /\bprivate\b/i.test(tail) ? "private"
      : /\binternal\b/i.test(tail) ? "internal"
        : /\bexternal\b/i.test(tail) ? "external"
          : /\bpublic\b/i.test(tail) ? "public"
            : legacyDefaultPublic ? "public-default" : "unspecified";
    rows.push({
      contractName: contract.name,
      name,
      params,
      tail,
      header,
      body,
      start: absolute,
      open,
      close,
      line: lineForOffset(code, absolute),
      visibility,
      isConstructorKeyword,
    });
  }
  return rows;
}

function extractModifiers(contract, code) {
  const rows = [];
  const local = code.slice(contract.open + 1, contract.close);
  const pattern = /\bmodifier\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*([^;{]*)\{/g;
  for (const match of local.matchAll(pattern)) {
    const relative = match.index ?? 0;
    const absolute = contract.open + 1 + relative;
    const open = absolute + match[0].lastIndexOf("{");
    const close = matchingBrace(code, open);
    if (close < 0 || close > contract.close) continue;
    rows.push({
      contractName: contract.name,
      name: match[1],
      params: match[2] ?? "",
      tail: match[3] ?? "",
      body: code.slice(open + 1, close),
      start: absolute,
      open,
      close,
      line: lineForOffset(code, absolute),
    });
  }
  return rows;
}

function extractStateVariables(contract) {
  const variables = new Set();
  const local = contract.code;
  let depth = 0;
  let start = 0;
  const declarations = [];
  for (let index = 0; index < local.length; index += 1) {
    const char = local[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth = Math.max(0, depth - 1);
      if (depth === 0) start = index + 1;
    } else if (char === ";" && depth === 0) {
      declarations.push(local.slice(start, index + 1));
      start = index + 1;
    }
  }

  const ignored = new Set([
    "address", "bool", "byte", "bytes", "constant", "error", "event", "external", "function",
    "immutable", "internal", "mapping", "memory", "payable", "private", "public", "storage", "string",
    "struct", "enum", "uint", "int", "using", "virtual", "override",
  ]);
  for (const rawDeclaration of declarations) {
    const declaration = rawDeclaration.trim();
    if (!declaration || /^(?:event|error|using|function|constructor|modifier|struct|enum)\b/i.test(declaration)) continue;
    const withoutInitializer = declaration.replace(/(?<![<>=!])=(?![=>])[\s\S]*$/u, "").replace(/;\s*$/u, "").trim();
    const tokens = [...withoutInitializer.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/gu)].map((match) => match[0]);
    const candidate = [...tokens].reverse().find((token) => !ignored.has(token) && !/^(?:u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|bytes(?:1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32)?)$/u.test(token));
    if (candidate) variables.add(candidate);
  }
  return variables;
}

function functionBody(code, name) {
  const start = code.search(new RegExp(`\\bfunction\\s+${name}\\b`, "i"));
  if (start < 0) return "";
  const brace = code.indexOf("{", start);
  if (brace < 0) return "";
  const close = matchingBrace(code, brace);
  return close < 0 ? "" : code.slice(brace + 1, close);
}

function isExternallyCallable(fn) {
  return fn.visibility === "public" || fn.visibility === "external" || fn.visibility === "public-default";
}

function hasAuthorization(fn) {
  const combined = `${fn.tail} ${fn.body}`;
  if (/\b(?:onlyowner|onlyOwner|onlyadmin|onlyAdmin|auth|authorized|requiresAuth|onlyRole|ownerOnly|adminOnly)\b/.test(fn.tail)) return true;
  if (/\b(?:require|assert)\s*\([^)]*msg\s*\.\s*sender[^)]*(?:owner|admin|creator|root|authority|messenger|authorized|role|guardian)/i.test(fn.body)) return true;
  if (/\b(?:owner|admin|creator|root|authority|messenger|authorized|role|guardian)[^;]{0,100}(?:==|!=)[^;]{0,100}msg\s*\.\s*sender/i.test(fn.body)) return true;
  if (/\bowners\s*\[\s*msg\s*\.\s*sender\s*\][^;]{0,80}(?:!=|==|>)/i.test(fn.body)) return true;
  if (/\b(?:allowed|roles?|minters?|operators?|guardians?)\s*\[\s*msg\s*\.\s*sender\s*\]/i.test(fn.body)) return true;
  return /\bmsg\s*\.\s*sender\s*==\s*address\s*\(\s*this\s*\)/i.test(combined);
}

function privilegeWrite(body) {
  const patterns = [
    /\b(?:owner|admin|creator|root|authority|guardian|messenger)\s*=\s*/i,
    /\b(?:owners|isOwner|roles|authorized|operators|minters|guardians)\s*\[[^\]]+\]\s*=\s*/i,
    /\bmap\s*\[[^\]]+\]\s*=\s*/i,
    /\b(?:m_owners|m_ownerIndex|m_numOwners)\s*\[[^\]]+\]\s*=\s*/i,
  ];
  return patterns.some((pattern) => pattern.test(body));
}

function addSignal(target, id, detail = {}) {
  if (!target.has(id)) target.set(id, { id, ...detail });
}

function hasCheckedLowLevelCall(body) {
  return /\(\s*bool\s+[A-Za-z_]\w*\s*,?[^)]*\)\s*=\s*[^;]*\.(?:call|delegatecall|staticcall)\b/i.test(body)
    && /\b(?:require|assert)\s*\(\s*[A-Za-z_]\w*/i.test(body);
}

function splitParams(params) {
  return params.split(",").map((value) => value.trim()).filter(Boolean);
}

function interactionRows(body, { includeTypedCallbacks = false } = {}) {
  const rows = [];
  const patterns = [
    ["legacy-call-value", /\.\s*(?:call|callcode)\s*\.\s*value\s*\([^)]*\)\s*\(/g],
    ["low-level-call", /\.\s*(?:call|callcode|delegatecall)\s*(?:\{[^{}]*\})?\s*\(/g],
    ["ether-transfer", /\.\s*(?:send|transfer)\s*\(/g],
    ["token-transfer", /\.\s*(?:safeTransfer|safeTransferFrom|transferFrom|transfer)\s*\(/g],
  ];
  if (includeTypedCallbacks) {
    patterns.push(["typed-callback", /\b[A-Z][A-Za-z0-9_]*\s*\([^;{}]*\)\s*\.\s*[A-Za-z_][A-Za-z0-9_]*\s*\(/g]);
  }
  for (const [kind, pattern] of patterns) {
    for (const match of body.matchAll(pattern)) {
      rows.push({ kind, index: match.index ?? -1, text: match[0] });
    }
  }
  return rows.filter((row) => row.index >= 0).sort((a, b) => a.index - b.index);
}

function stateEffectRows(body, stateVariables) {
  const rows = [];
  const patterns = [
    ["delete", /\bdelete\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*\[[^\]]+\])?(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_]*)*/g],
    ["state-write", /\b([A-Za-z_][A-Za-z0-9_]*)(?:(?:\s*\[[^\]]+\])|(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_]*))*\s*(?:=|\+=|-=|\*=|\/=|%=|\+\+|--)/g],
    ["storage-mutation", /\b([A-Za-z_][A-Za-z0-9_]*)(?:(?:\s*\[[^\]]+\])|(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_]*))*\s*\.\s*(?:push|pop)\s*\(/g],
  ];
  for (const [kind, pattern] of patterns) {
    for (const match of body.matchAll(pattern)) {
      const root = match[1] ?? "";
      const text = match[0];
      if (!stateVariables.has(root)) continue;
      if (/\b(?:locked|_locked|entered|_entered|_status)\b/iu.test(text)) continue;
      rows.push({ kind, index: match.index ?? -1, root, text });
    }
  }
  return rows.filter((row) => row.index >= 0).sort((a, b) => a.index - b.index);
}

function hasReentrancyGuard(fn) {
  if (/\b(?:nonReentrant|noReentrancy|reentrancyGuard|mutex|lockGuard)\b/i.test(fn.tail)) return true;
  const body = fn.body;
  const guardCheck = /\b(?:require|assert)\s*\([^)]*(?:locked|_locked|entered|_entered|_status)[^)]*\)/i.test(body);
  const guardEnter = /\b(?:locked|_locked|entered|_entered|_status)\s*=\s*(?:true|1|_ENTERED)\b/i.test(body);
  const guardExit = /\b(?:locked|_locked|entered|_entered|_status)\s*=\s*(?:false|0|_NOT_ENTERED)\b/i.test(body);
  return guardCheck && guardEnter && guardExit;
}

function modifierIsUsed(fn, modifierName) {
  return new RegExp(`(?:^|\\s)${modifierName}(?:\\s*\\([^)]*\\))?(?:\\s|$)`).test(fn.tail);
}

export function analyzeSolidityStructuredSignals(source) {
  const preserved = stripCommentsAndStrings(source).replace(/\r\n?/g, "\n");
  const code = compact(source);
  const version = versionTuple(source);
  const legacyDefaultPublic = versionLessThan(version, 0, 5, 0);
  const signals = new Map();
  const contracts = extractContracts(preserved);
  const functions = contracts.flatMap((contract) => extractFunctions(contract, preserved, legacyDefaultPublic));
  const modifiers = contracts.flatMap((contract) => extractModifiers(contract, preserved));
  const stateVariablesByContract = new Map(contracts.map((contract) => [contract.name, extractStateVariables(contract)]));

  if (/\btx\s*\.\s*origin\b/.test(code)) addSignal(signals, "tx_origin_auth", { category: "access_control" });
  if (/\.delegatecall\s*\(/.test(code)) addSignal(signals, "delegatecall", { category: "access_control" });
  if (/\bselfdestruct\s*\(/.test(code)) addSignal(signals, "selfdestruct", { category: "access_control" });
  if (/\bblockhash\s*\([^;]{0,160}%/.test(code)) addSignal(signals, "blockhash_random", { category: "bad_randomness" });
  if (/\bblock\s*\.\s*timestamp\b[^;]{0,160}(?:%|keccak256|sha3)/.test(code)) addSignal(signals, "timestamp_random", { category: "bad_randomness" });

  for (const fn of functions) {
    if (!isExternallyCallable(fn)) continue;
    const body = fn.body;
    const line = fn.line;

    if (/\.(?:call|callcode|delegatecall|send)\s*(?:\{|\()/.test(body) && !hasCheckedLowLevelCall(body)) {
      const sendChecked = /\b(?:require|assert)\s*\([^)]*\.send\s*\(/.test(body);
      if (!sendChecked) addSignal(signals, "unchecked_call", { category: "unchecked_low_level_calls", line });
    }

    const stateVariables = stateVariablesByContract.get(fn.contractName) ?? new Set();
    const interactions = interactionRows(body, { includeTypedCallbacks: true });
    const effects = stateEffectRows(body, stateVariables);
    const firstInteraction = interactions[0];
    const postInteractionEffect = firstInteraction
      ? effects.find((effect) => effect.index > firstInteraction.index)
      : null;
    if (firstInteraction && postInteractionEffect && !hasReentrancyGuard(fn)) {
      addSignal(signals, "reentrancy_order", {
        category: "reentrancy",
        line,
        interactionKind: firstInteraction.kind,
        effectKind: postInteractionEffect.kind,
      });
    }

    if (!hasReentrancyGuard(fn) && effects.length > 0) {
      const contractModifiers = modifiers.filter((modifier) => modifier.contractName === fn.contractName);
      for (const modifier of contractModifiers) {
        if (!modifierIsUsed(fn, modifier.name)) continue;
        const placeholderIndex = modifier.body.search(/(?:^|[;{}])\s*_\s*;/m);
        if (placeholderIndex < 0) continue;
        const callbackBeforeBody = interactionRows(modifier.body, { includeTypedCallbacks: true })
          .some((interaction) => interaction.index < placeholderIndex);
        if (callbackBeforeBody) {
          addSignal(signals, "reentrancy_modifier_callback", {
            category: "reentrancy",
            line: modifier.line,
            modifier: modifier.name,
          });
        }
      }
    }

    if (/^mint$/i.test(fn.name) && !hasAuthorization(fn)) {
      addSignal(signals, "open_mint", { category: "access_control", line });
    }

    if (/^(?:initialize|init)$/i.test(fn.name) && !/\b(?:initializer|reinitializer)\b/i.test(fn.tail)
      && !/require\s*\(\s*!\s*initialized|if\s*\(\s*initialized\s*\)|initialized\s*=\s*true/i.test(body)) {
      addSignal(signals, "unguarded_initialize", { category: "access_control", line });
    }

    const guardedInitializer = /^(?:initialize|init)$/i.test(fn.name)
      && (/require\s*\(\s*!\s*initialized/i.test(body) || /if\s*\(\s*initialized\s*\)/i.test(body))
      && /initialized\s*=\s*true/i.test(body);
    if (privilegeWrite(body) && !hasAuthorization(fn) && !guardedInitializer && !fn.isConstructorKeyword && fn.name !== fn.contractName) {
      addSignal(signals, "unprotected_privileged_write", { category: "access_control", line });
      if (versionLessThan(version, 0, 4, 22) && /\b(?:owner|creator|root|admin)\s*=\s*msg\s*\.\s*sender/i.test(body)) {
        addSignal(signals, "legacy_constructor_name_mismatch", { category: "access_control", line });
      }
    }

    if (/\b(?:require|assert)\s*\([^)]*\.send\s*\(/i.test(body)
      || /if\s*\(\s*!?\s*[^)]*\.send\s*\([^)]*\)\s*\)\s*(?:throw|revert)/i.test(body)) {
      addSignal(signals, "dos_failed_refund", { category: "denial_of_service", line });
    }

    if (/\b(?:for|while)\s*\([^)]*(?:\.length|true)[^)]*\)[\s\S]{0,600}\.(?:transfer|send|call)\s*(?:\{|\()/i.test(body)) {
      addSignal(signals, "unbounded_external_loop", { category: "denial_of_service", line });
    }

    if (/\b(?:for|while)\s*\([^)]*;[^)]*<\s*(?:[1-9]\d{2,}|[A-Za-z_]\w*\.length)[^)]*\)[\s\S]{0,500}\.push\s*\(/i.test(body)) {
      addSignal(signals, "dos_storage_growth_loop", { category: "denial_of_service", line });
    }

    if (/\b(?:approve|setAllowance)\b/i.test(fn.name)
      && /(?:allowed|allowance|_allowed)\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=\s*/i.test(body)
      && !/require\s*\([^)]*(?:==\s*0|value\s*==\s*0)/i.test(body)) {
      addSignal(signals, "erc20_approval_race", { category: "front_running", line });
    }

    if (/\b(?:solve|submit|claimReward|play)\b/i.test(fn.name)) {
      const directSecretComparison = /(?:hash|answer|secret|commitment)\s*(?:==|!=)\s*(?:sha3|keccak256)?\s*\(/i.test(body)
        || /(?:guess|solution|submission|number)\s*(?:==|!=)\s*(?:answer|secret|hash)/i.test(body);
      const callerPayout = /(?:msg\s*\.\s*sender|payable\s*\(\s*msg\s*\.\s*sender\s*\))\s*\.(?:transfer|send)\s*\(/i.test(body);
      if (directSecretComparison && callerPayout) addSignal(signals, "front_run_preimage", { category: "front_running", line });
      if (/players\s*\[[^\]]+\]\s*=\s*[^;]*(?:msg\s*\.\s*sender|number|guess)/i.test(body)) {
        addSignal(signals, "front_run_plaintext_game", { category: "front_running", line });
      }
      if (/\b(?:reward|prize)\b/i.test(body) && callerPayout && /claimed\s*=\s*true/i.test(body)) {
        addSignal(signals, "front_run_reward_race", { category: "front_running", line });
      }
    }

    if (legacyDefaultPublic) {
      const params = splitParams(fn.params);
      const hasAddressThenWide = params.some((param, index) => /\baddress\b/i.test(param)
        && params.slice(index + 1).some((later) => /\b(?:u?int(?:8|16|32|64|128|256)?|bytes32)\b/i.test(later)));
      if (hasAddressThenWide && /(?:balance|balances|allowance|allowed)\s*\[/i.test(body)) {
        addSignal(signals, "legacy_short_address_surface", { category: "short_addresses", line });
      }
    }
  }

  if (/\.spot\s*\(/.test(code) || /\bgetReserves\s*\(/.test(code)) addSignal(signals, "spot_oracle", { category: "other" });

  const deposit = functionBody(preserved, "deposit");
  if (deposit && /address\s*\(\s*this\s*\)\s*\.\s*balance/.test(deposit)
      && /msg\s*\.\s*value\s*\*\s*totalShares\s*\/\s*address/.test(deposit)) {
    addSignal(signals, "post_balance_share_accounting", { category: "other" });
  }
  if (deposit && /\/\s*rate/.test(deposit) && !/require\s*\(\s*\w+\s*>\s*0/.test(deposit)) {
    addSignal(signals, "rounding_zero", { category: "arithmetic" });
  }

  if (/\becrecover\s*\(/.test(code)
      && !/\bblock\s*\.\s*chainid\b/.test(code)
      && !/\bnonces?\s*\[/.test(code)
      && !/\bused\s*\[/.test(code)) {
    addSignal(signals, "signature_replay", { category: "access_control" });
  }

  const permit = functionBody(preserved, "permit");
  if (permit && !/\bdeadline\b/.test(permit)) addSignal(signals, "permit_no_deadline", { category: "front_running" });

  if (/contract\s+\w+\s*\{\s*address\s+\w+\s*;\s*uint/.test(code)
      && /contract\s+\w+\s*\{\s*uint\s+\w+\s*;\s*address/.test(code)) {
    addSignal(signals, "storage_collision", { category: "access_control" });
  }

  const sendBody = functionBody(preserved, "send");
  if (sendBody) {
    const hookIndex = sendBody.search(/tokensReceived\s*\(/);
    const creditIndex = sendBody.search(/balance\s*\[\s*to\s*\]\s*\+=/);
    if (hookIndex >= 0 && (creditIndex < 0 || hookIndex < creditIndex)) addSignal(signals, "hook_reentrancy", { category: "reentrancy" });
  }

  if (deposit && /transferFrom\s*\([^,]+,\s*address\s*\(\s*this\s*\)\s*,\s*amount\s*\)/.test(deposit)
      && /credit\s*\[[^\]]+\]\s*\+=\s*amount/.test(deposit)
      && !/balanceOf\s*\(\s*address\s*\(\s*this\s*\)\s*\)/.test(deposit)) {
    addSignal(signals, "fee_token_mismatch", { category: "other" });
  }

  const adminMove = functionBody(preserved, "adminMove");
  if (adminMove && !/blocked\s*\[/.test(adminMove)) addSignal(signals, "transfer_policy_bypass", { category: "access_control" });

  const borrow = functionBody(preserved, "borrow");
  if (borrow && !/paused/.test(borrow)) addSignal(signals, "missing_pause", { category: "access_control" });

  const withdraw = functionBody(preserved, "withdraw");
  const hasCollateralState = /(?:mapping\s*\([^)]*\)|uint(?:256)?)\s+(?:public\s+)?collateral\b/.test(code);
  const hasDebtState = /(?:mapping\s*\([^)]*\)|uint(?:256)?)\s+(?:public\s+)?debt\b/.test(code);
  const hasSolvencyGuard = /require\s*\([^;]{0,240}collateral[^;]{0,240}debt/.test(withdraw);
  if (withdraw && hasCollateralState && hasDebtState && /collateral\s*\[/.test(withdraw) && !hasSolvencyGuard) {
    addSignal(signals, "insolvent_withdraw", { category: "other" });
  }

  const passed = functionBody(preserved, "passed");
  if (passed && /votes\s*>=\s*1\b/.test(passed)) addSignal(signals, "low_quorum", { category: "access_control" });

  const submit = functionBody(preserved, "submit");
  if (submit && /\bguess\s*==\s*answer\b/.test(submit)) addSignal(signals, "front_run_reveal", { category: "front_running" });

  const execute = functionBody(preserved, "execute");
  if (execute && /keccak256\s*\(\s*message\s*\)/.test(execute)
      && !/block\s*\.\s*chainid|sourceChain|messenger/.test(execute)) {
    addSignal(signals, "cross_chain_replay", { category: "access_control" });
  }

  if (/\b[A-Za-z_]\w*\s*=\s*new\s+(?:address|uint(?:256)?|bytes32)\s*\[\s*\]\s*\(\s*0\s*\)/.test(code)) {
    addSignal(signals, "dos_storage_array_reset", { category: "denial_of_service" });
  }

  const ordered = [...signals.values()].sort((a, b) => a.id.localeCompare(b.id));
  return {
    analyzerClass: ANALYZER_CLASS,
    signals: ordered.map((row) => row.id),
    findings: ordered,
    compilerAstCredit: false,
    limitations: [
      "Structured-token and bounded control-flow heuristics; not a complete solc AST or path-feasibility proof.",
      "Signals are review surfaces and require tool correlation or human adjudication before customer-facing vulnerability claims.",
    ],
  };
}
