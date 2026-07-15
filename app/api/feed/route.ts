import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { posts, users, likes, comments, replies } from "@/db/schema";
import { desc, eq, inArray, or } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch posts visible to user (public OR owned by user)
  const results = await db
    .select({
      id: posts.id,
      userId: posts.userId,
      content: posts.content,
      imageUrl: posts.imageUrl,
      visibility: posts.visibility,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      user: {
        id: users.id,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(
      or(eq(posts.visibility, "PUBLIC"), eq(posts.userId, session.user.id))
    )
    .orderBy(desc(posts.createdAt));

  const postIds = results.map((row) => row.id);

  if (postIds.length === 0) {
    return NextResponse.json({ posts: [] });
  }

  // 2. Fetch all likes for these posts
  const allLikes = await db
    .select({
      id: likes.id,
      userId: likes.userId,
      postId: likes.postId,
      commentId: likes.commentId,
      replyId: likes.replyId,
    })
    .from(likes)
    .where(inArray(likes.postId, postIds));

  // 3. Fetch all comments for these posts
  const allComments = await db
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

  let allReplies: any[] = [];
  let commentAndReplyLikes: any[] = [];

  if (commentIds.length > 0) {
    // 4. Fetch all replies for these comments
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

    // 5. Fetch likes for comments and replies
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

  // Combine posts, likes, comments, and replies
  const postsWithRelations = results.map((post) => {
    const postLikes = allLikes.filter((l) => l.postId === post.id);
    const postComments = allComments
      .filter((c) => c.postId === post.id)
      .map((comment) => {
        const commentLikes = commentAndReplyLikes.filter(
          (l) => l.commentId === comment.id
        );
        const commentReplies = allReplies
          .filter((r) => r.commentId === comment.id)
          .map((reply) => {
            const replyLikes = commentAndReplyLikes.filter(
              (l) => l.replyId === reply.id
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

  return NextResponse.json({ posts: postsWithRelations });
}
