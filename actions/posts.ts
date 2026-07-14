"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq, desc, and, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, likes, posts, replies, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createPostSchema } from "@/lib/validations";
import { saveUploadedFile } from "@/lib/upload";

export async function createPost(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to create a post.");
  }

  const payload = {
    content: String(formData.get("content") ?? ""),
    visibility: String(formData.get("visibility") ?? "PUBLIC"),
    image: formData.get("image"),
  };

  const parsed = createPostSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error(
      parsed.error.flatten().fieldErrors.content?.[0] ?? "Invalid post data.",
    );
  }

  let imageUrl: string | null = null;
  const imageField = formData.get("image");

  if (imageField instanceof File && imageField.size > 0) {
    imageUrl = await saveUploadedFile(imageField);
  }

  await db.insert(posts).values({
    id: randomUUID(),
    userId: session.user.id,
    content: parsed.data.content ?? null,
    imageUrl,
    visibility: parsed.data.visibility,
  });

  revalidatePath("/feed");
  redirect("/feed");
}

export async function getFeedPosts() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return [];
  }

  const results = await db
    .select({
      post: posts,
      author: {
        id: users.id,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(
      or(eq(posts.visibility, "PUBLIC"), eq(posts.userId, session.user.id)),
    )
    .orderBy(desc(posts.createdAt));

  const postIds = results.map((row) => row.post.id);

  if (postIds.length === 0) {
    return [];
  }

  const [likesResult, commentsResult] = await Promise.all([
    db
      .select({
        postId: likes.postId,
        id: likes.id,
        userId: likes.userId,
      })
      .from(likes)
      .where(sql`${likes.postId} IN ${postIds}`),
    db
      .select({
        postId: comments.postId,
        id: comments.id,
      })
      .from(comments)
      .where(sql`${comments.postId} IN ${postIds}`),
  ]);

  return results.map((row) => ({
    ...row.post,
    author: row.author,
    likes: likesResult.filter((like) => like.postId === row.post.id),
    comments: commentsResult.filter(
      (comment) => comment.postId === row.post.id,
    ),
  }));
}

export async function toggleLike(postId: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to like posts.");
  }

  const existing = await db.query.likes.findFirst({
    where: and(
      eq(likes.postId, postId),
      eq(likes.userId, session.user.id),
      isNull(likes.commentId),
      isNull(likes.replyId),
    ),
  });

  if (existing) {
    await db.delete(likes).where(eq(likes.id, existing.id));
  } else {
    await db.insert(likes).values({
      id: randomUUID(),
      userId: session.user.id,
      postId,
    });
  }

  revalidatePath("/feed");
}
