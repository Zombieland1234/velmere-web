"use client";

import { ChevronDown } from "lucide-react";

const questions = [
  ["What is VLM?", "VLM is a planned utility/access concept for the Velmère member layer. It is not presented as an investment, security, public offer or price claim."],
  ["Is VLM live?", "No public token sale is enabled in this build. Contract, chain, audit and legal status must be verified before activation."],
  ["Do I need VLM to buy clothing?", "No. Clothing commerce should remain separate from VLM. Public browsing and standard checkout should not require a token."],
  ["Can Velmère access my wallet?", "No. Wallet connection should be read-only unless your wallet clearly shows a transaction confirmation. Never enter a seed phrase or private key."],
  ["What utility is planned?", "Access checks for private drops, Square features, archive notes, rewards concepts and future participation mechanics, subject to legal and technical review."],
  ["Can features change?", "Yes. Features may change, be delayed or never launch. Future access, value, liquidity or listing must not be promised."],
];

export default function VlmFaq() {
  return (
    <section className="rounded-[2rem] border border-white/[0.10] bg-[#111113] p-6 shadow-velmere-card md:p-8">
      <p className="velmere-label text-velmere-gold">VLM FAQ</p>
      <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.04em] text-white md:text-5xl">Clear answers. No hype.</h2>
      <div className="mt-8 divide-y divide-white/[0.10]">
        {questions.map(([question, answer], index) => (
          <details key={question} className="group py-5" open={index === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left text-lg leading-tight text-white">
              {question}
              <ChevronDown className="h-5 w-5 shrink-0 text-white/[0.42] transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-open:grid-rows-[1fr]">
              <p className="mt-4 max-w-3xl overflow-hidden text-sm leading-7 text-white/[0.56]">{answer}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
