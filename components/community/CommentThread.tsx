"use client";

import { useEffect, useRef, useState } from "react";
import LiveTimestamp from "@/components/ui/LiveTimestamp";
import { ChevronDown, MoreVertical, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import type { SquareComment } from "@/lib/square/types";
import { copyPublicCommunityText } from "@/lib/security/browser-system-clipboard";

type CommentThreadProps = {
  comments: SquareComment[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  labels: {
    title: string;
    placeholder: string;
    post: string;
    reply: string;
    replies: string;
    empty: string;
  };
};

export default function CommentThread({ comments, draft, onDraftChange, onSubmit, labels }: CommentThreadProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike" | null>>({});
  const visibleComments = comments;

  const setReaction = (commentId: string, reaction: "like" | "dislike") => {
    setReactions((current) => ({
      ...current,
      [commentId]: current[commentId] === reaction ? null : reaction,
    }));
  };

  const requestReply = (authorName: string) => {
    onDraftChange(`@${authorName} `);
  };

  useEffect(() => {
    if (!openMenuId) return;
    const closeFromPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpenMenuId(null);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("pointerdown", closeFromPointer, true);
    document.addEventListener("keydown", closeFromKeyboard, true);
    return () => {
      document.removeEventListener("pointerdown", closeFromPointer, true);
      document.removeEventListener("keydown", closeFromKeyboard, true);
    };
  }, [openMenuId]);

  return (
    <section
      ref={rootRef}
      className="velmere-square-comments flex h-full min-h-0 flex-col border-t border-white/[0.10] pt-5"
      data-pass2001-square-comments="outside-click-menu-solid-no-blur"
    >
      <div className="velmere-square-comments-head sticky top-0 z-20 mb-4 flex items-center justify-between gap-4 bg-[#0b0c0f]/[0.98] pb-3">
        <p className="font-sans text-[10px] font-black uppercase tracking-[0.24em] text-white/[0.36]">{labels.title}</p>
        <span className="rounded-full border border-white/[0.10] px-3 py-1 text-[10px] text-white/[0.36]">
          {visibleComments.length}
        </span>
      </div>

      <div className="velmere-square-comment-form sticky top-12 z-20 mb-5 flex gap-2 rounded-2xl border border-white/[0.075] bg-[#0b0c10]/[0.98] p-3 shadow-[0_12px_42px_rgba(0,0,0,0.34)]">
        <input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={labels.placeholder}
          className="min-h-11 min-w-0 flex-1 rounded-full border border-white/[0.10] bg-white/[0.045] px-4 text-[16px] text-white outline-none placeholder:text-white/[0.30] focus:border-cyan-200/[0.34]"
        />
        <button type="button" onClick={onSubmit} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-velmere-gold/[0.30] px-4 text-velmere-gold luxury-hover hover:bg-velmere-gold/[0.10]" aria-label={labels.post}>
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="velmere-square-comments-list min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 luxury-scrollbar">
        {visibleComments.map((comment) => {
          const replies = comment.replies ?? [];
          const repliesOpen = Boolean(openReplies[comment.id]);
          const replyCount = replies.length;
          return (
            <article key={comment.id} className="relative grid grid-cols-[2.5rem_1fr] gap-3">
              <div className="relative flex justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.035] font-serif text-lg text-white/[0.86]">
                  {comment.authorName.slice(0, 1)}
                </span>
                {replyCount > 0 ? <span className="absolute bottom-[-2.25rem] top-11 w-px bg-white/[0.10]" aria-hidden="true" /> : null}
              </div>
              <div className="min-w-0">
                <div className="relative flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-white/[0.82]">{comment.authorName}</p>
                  <LiveTimestamp seed={`${comment.id}-${comment.createdAt}`} className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.34]" />
                  <button
                    type="button"
                    onClick={() => setOpenMenuId((current) => current === comment.id ? null : comment.id)}
                    className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-white/[0.35] luxury-hover hover:bg-white/[0.04] hover:text-white"
                    aria-label="Comment menu"
                    aria-expanded={openMenuId === comment.id}
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {openMenuId === comment.id ? (
                    <div className="absolute right-0 top-9 z-30 grid min-w-36 gap-1 rounded-2xl border border-white/[0.10] bg-[#07090d]/[0.99] p-2 shadow-[0_18px_70px_rgba(0,0,0,0.55)]" data-pass2001-comment-menu="outside-click-solid">
                      <button
                        type="button"
                        onClick={() => {
                          void copyPublicCommunityText(comment.body).catch(() => undefined);
                          setOpenMenuId(null);
                        }}
                        className="rounded-xl px-3 py-2 text-left text-[11px] uppercase tracking-[0.12em] text-white/[0.62] hover:bg-white/[0.06] hover:text-white"
                      >
                        Copy text
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(null)}
                        className="rounded-xl px-3 py-2 text-left text-[11px] uppercase tracking-[0.12em] text-white/[0.62] hover:bg-white/[0.06] hover:text-white"
                      >
                        Hide menu
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-7 text-white/[0.68]">{comment.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/[0.42]">
                  <button
                    type="button"
                    onClick={() => setReaction(comment.id, "like")}
                    aria-pressed={reactions[comment.id] === "like"}
                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 luxury-hover hover:bg-white/[0.04] hover:text-white ${reactions[comment.id] === "like" ? "bg-velmere-gold/[0.10] text-velmere-gold" : ""}`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                    {typeof comment.likes === "number" ? comment.likes.toLocaleString() : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaction(comment.id, "dislike")}
                    aria-pressed={reactions[comment.id] === "dislike"}
                    className={`inline-flex min-h-8 items-center rounded-full px-2 luxury-hover hover:bg-white/[0.04] hover:text-white ${reactions[comment.id] === "dislike" ? "bg-white/[0.06] text-white" : ""}`}
                    aria-label="Dislike comment"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => requestReply(comment.authorName)}
                    className="inline-flex min-h-8 items-center rounded-full px-3 font-semibold luxury-hover hover:bg-white/[0.04] hover:text-white"
                  >
                    {labels.reply}
                  </button>
                </div>
                {replyCount > 0 ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setOpenReplies((current) => ({ ...current, [comment.id]: !current[comment.id] }))}
                      className="inline-flex min-h-9 items-center gap-2 rounded-full px-2 text-xs font-semibold text-velmere-gold luxury-hover hover:bg-velmere-gold/[0.10]"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform duration-500 ${repliesOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                      {replyCount} {labels.replies}
                    </button>
                    {repliesOpen ? (
                      <div className="mt-3 space-y-3 pl-2">
                        {replies.map((reply) => (
                          <div key={reply.id} className="grid grid-cols-[2rem_1fr] gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.025] text-xs text-white/[0.72]">{reply.authorName.slice(0, 1)}</span>
                            <div>
                              <p className="text-xs font-semibold text-white/[0.70]">{reply.authorName} <span className="ml-2 font-mono text-[10px] text-white/[0.34]">{reply.createdAt}</span></p>
                              <p className="mt-1 text-xs leading-6 text-white/[0.58]">{reply.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {comments.length === 0 ? <p className="mt-3 text-xs leading-6 text-white/[0.34]">{labels.empty}</p> : null}
    </section>
  );
}
