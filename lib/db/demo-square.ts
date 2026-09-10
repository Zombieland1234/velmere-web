import type { SquarePost } from "@/lib/square/types";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";
import de from "@/messages/de.json";

const seedPostKeys = ["official", "lookbook", "vlm", "community"] as const;
const messages = { en, pl, de } as const;

type Locale = keyof typeof messages;

function resolveLocale(locale?: string): Locale {
  if (locale === "pl" || locale === "de" || locale === "en") return locale;
  return "en";
}

export function getDemoSquarePosts(locale?: string): SquarePost[] {
  const resolvedLocale = resolveLocale(locale);
  const squareMessages = messages[resolvedLocale].Square.posts;

  return seedPostKeys.map((key, index) => {
    const post = squareMessages[key];
    return {
      id: key,
      slug: key,
      authorName: post.authorName,
      authorHandle: post.authorHandle,
      authorType: post.authorType as SquarePost["authorType"],
      locale: resolvedLocale,
      title: post.title,
      body: post.body,
      imageUrl:
        index === 1
          ? "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1800&q=80"
          : index === 3
            ? "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1800&q=80"
            : undefined,
      tags: post.tags,
      views: Number(post.views),
      likes: Number(post.likes),
      commentsCount: Number(post.commentsCount),
      createdAt: post.createdAt,
      moderationStatus: "approved",
      comments: [],
    } satisfies SquarePost;
  });
}
