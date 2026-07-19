import { eq, or, desc } from "drizzle-orm";
import { db } from "@/db";
import { comments, likes, replies, users } from "@/db/schema";
import { inArray } from "drizzle-orm";

export interface LikeRow {
  id: string;
  userId: string;
  postId?: string | null;
  commentId?: string | null;
  replyId?: string | null;
}

export interface CommentRow {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export interface ReplyRow {
  id: string;
  commentId: string;
  userId: string;
  content: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export interface PostRow {
  id: string;
  userId: string;
  content: string | null;
  imageUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export async function enrichPostsWithRelations(
  results: PostRow[],
): Promise<(PostRow & { likes: LikeRow[]; comments: (CommentRow & { likes: LikeRow[]; replies: (ReplyRow & { likes: LikeRow[] })[] })[] })[]> {
  const postIds = results.map((row) => row.id);

  if (postIds.length === 0) {
    return [];
  }

  const allLikes: LikeRow[] = await db
    .select({
      id: likes.id,
      userId: likes.userId,
      postId: likes.postId,
      commentId: likes.commentId,
      replyId: likes.replyId,
    })
    .from(likes)
    .where(inArray(likes.postId, postIds));

  const allComments: CommentRow[] = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      userId: comments.userId,
      content: comments.content,
      createdAt: comments.createdAt,
      user: {
        id: users.id,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(inArray(comments.postId, postIds))
    .orderBy(desc(comments.createdAt));

  const commentIds = allComments.map((c) => c.id);

  let allReplies: ReplyRow[] = [];
  let commentAndReplyLikes: LikeRow[] = [];

  if (commentIds.length > 0) {
    allReplies = await db
      .select({
        id: replies.id,
        commentId: replies.commentId,
        userId: replies.userId,
        content: replies.content,
        createdAt: replies.createdAt,
        user: {
          id: users.id,
          name: users.name,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(replies)
      .leftJoin(users, eq(replies.userId, users.id))
      .where(inArray(replies.commentId, commentIds))
      .orderBy(desc(replies.createdAt));

    const replyIds = allReplies.map((r) => r.id);

    const orConditions = [inArray(likes.commentId, commentIds)];
    if (replyIds.length > 0) {
      orConditions.push(inArray(likes.replyId, replyIds));
    }

    commentAndReplyLikes = await db
      .select({
        id: likes.id,
        userId: likes.userId,
        postId: likes.postId,
        commentId: likes.commentId,
        replyId: likes.replyId,
      })
      .from(likes)
      .where(or(...orConditions));
  }

  return results.map((post) => {
    const postLikes = allLikes.filter((l) => l.postId === post.id);
    const postComments = allComments
      .filter((c) => c.postId === post.id)
      .map((comment) => {
        const commentLikes = commentAndReplyLikes.filter(
          (l) => l.commentId === comment.id,
        );
        const commentReplies = allReplies
          .filter((r) => r.commentId === comment.id)
          .map((reply) => {
            const replyLikes = commentAndReplyLikes.filter(
              (l) => l.replyId === reply.id,
            );
            return {
              ...reply,
              likes: replyLikes,
            };
          });
        return {
          ...comment,
          likes: commentLikes,
          replies: commentReplies,
        };
      });

    return {
      ...post,
      likes: postLikes,
      comments: postComments,
    };
  });
}
