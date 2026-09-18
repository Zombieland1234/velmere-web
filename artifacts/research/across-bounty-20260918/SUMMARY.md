# Velmère × Across — bounty research pass

- Across SHA: `7445f72de17900544605c7e6706c5fb3b3784738`
- Velmère SHA: `318b120932b8af4fc725792a2cbeb30c60733d55`
- Bounty scope verified: 2026-09-19 — https://docs.across.to/introduction/bug-bounty
- Targets analyzed: 22/22
- High/Critical detector candidates requiring manual validation: 0

## Safety / evidence boundary

This run performs local compilation and static/CFG/source analysis only.
It does not send transactions, call production RPC endpoints, move funds, access user data, or attempt live exploitation.
Velmère's current V2 fuzz campaign is a synthetic balance model and does not execute target bytecode; therefore no finding is treated as bounty-ready without independent reproduction.

## Target summary

| Target | Status | Critical | High | Medium | Low | Informational | Priority candidates |
|---|---:|---:|---:|---:|---:|---:|---:|
| HubPool | ANALYZED | 0 | 3 | 0 | 1 | 0 | 0 |
| AcrossConfigStore | ANALYZED | 0 | 0 | 0 | 1 | 0 | 0 |
| Arbitrum_SpokePool | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| OP_SpokePool | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| SpokePoolPeriphery | ANALYZED | 0 | 2 | 1 | 0 | 0 | 0 |
| PermissionedMulticallHandler | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| Router_Adapter | ANALYZED | 0 | 1 | 1 | 0 | 0 | 0 |
| AdminWithdrawManager | ANALYZED | 0 | 0 | 0 | 1 | 0 | 0 |
| CounterfactualBeacon | ANALYZED | 0 | 0 | 1 | 0 | 0 | 0 |
| CounterfactualDeposit | ANALYZED | 0 | 1 | 0 | 0 | 0 | 0 |
| CounterfactualDepositCCTP | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| CounterfactualDepositFactory | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| CounterfactualDepositOFT | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| CounterfactualDepositSpokePool | ANALYZED | 0 | 0 | 1 | 0 | 0 | 0 |
| CounterfactualDepositVanillaCCTP | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| HyperCoreFlowExecutor | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| SwapHandler | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| Tron_SpokePoolPeriphery | ANALYZED | 0 | 1 | 0 | 0 | 0 | 0 |
| Ethereum_SpokePool | ANALYZED | 0 | 0 | 1 | 1 | 0 | 0 |
| Lens_SpokePool | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| ZkSync_SpokePool | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |
| Cher_SpokePool | ANALYZED | 0 | 0 | 0 | 0 | 0 | 0 |

## Next triage rule

Only High/Critical detector findings with high/certain confidence advance to manual source review and a local Foundry reproduction. Heuristic-only findings remain leads, not vulnerability claims.
