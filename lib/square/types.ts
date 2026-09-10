export type SquareAuthorType = "official" | "community" | "moderator";

export type ModerationStatus = "draft" | "pending" | "approved" | "hidden" | "reported";

export type SquareComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  moderationStatus: ModerationStatus;
  likes?: number;
  replies?: SquareComment[];
};

export type SquarePost = {
  id: string;
  slug: string;
  authorName: string;
  authorHandle: string;
  authorType: SquareAuthorType;
  locale: string;
  title: string;
  body: string;
  imageUrl?: string;
  tags: string[];
  views: number;
  likes: number;
  commentsCount: number;
  createdAt: string;
  moderationStatus: ModerationStatus;
  comments?: SquareComment[];
};

export type SquareReaction = {
  postId: string;
  liked: boolean;
};
