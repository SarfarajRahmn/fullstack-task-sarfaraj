"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { comments, likes, posts, replies } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createPostSchema, commentSchema, replySchema } from "@/lib/validations";
import { saveUploadedFile } from "@/lib/upload";

export async function createPost(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to create a post.");
  }

  const payload = {
    content: String(formData.get("content") ?? "").trim() || undefined,
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

  const newPostId = randomUUID();
  await db.insert(posts).values({
    id: newPostId,
    userId: session.user.id,
    content: parsed.data.content ?? null,
    imageUrl,
    visibility: parsed.data.visibility,
  });

  revalidatePath("/feed");
}

export async function deletePost(postId: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to delete a post.");
  }

  const postRecord = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!postRecord) {
    throw new Error("Post not found.");
  }

  if (postRecord.userId !== session.user.id) {
    throw new Error("You are not authorized to delete this post.");
  }

  await db.delete(posts).where(eq(posts.id, postId));
  revalidatePath("/feed");
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

export async function toggleLikeComment(commentId: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to like comments.");
  }

  const existing = await db.query.likes.findFirst({
    where: and(
      eq(likes.commentId, commentId),
      eq(likes.userId, session.user.id),
      isNull(likes.replyId),
    ),
  });

  if (existing) {
    await db.delete(likes).where(eq(likes.id, existing.id));
  } else {
    await db.insert(likes).values({
      id: randomUUID(),
      userId: session.user.id,
      commentId,
    });
  }

  revalidatePath("/feed");
}

export async function toggleLikeReply(replyId: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to like replies.");
  }

  const existing = await db.query.likes.findFirst({
    where: and(
      eq(likes.replyId, replyId),
      eq(likes.userId, session.user.id),
    ),
  });

  if (existing) {
    await db.delete(likes).where(eq(likes.id, existing.id));
  } else {
    await db.insert(likes).values({
      id: randomUUID(),
      userId: session.user.id,
      replyId,
    });
  }

  revalidatePath("/feed");
}

export async function commentPost(postId: string, content: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to comment.");
  }

  const parsed = commentSchema.safeParse({ postId, content });
  if (!parsed.success) {
    throw new Error(parsed.error.flatten().fieldErrors.content?.[0] ?? "Invalid comment content.");
  }

  await db.insert(comments).values({
    id: randomUUID(),
    postId: parsed.data.postId,
    userId: session.user.id,
    content: parsed.data.content,
  });

  revalidatePath("/feed");
}

export async function replyPost(commentId: string, content: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to reply.");
  }

  const parsed = replySchema.safeParse({ commentId, content });
  if (!parsed.success) {
    throw new Error(parsed.error.flatten().fieldErrors.content?.[0] ?? "Invalid reply content.");
  }

  await db.insert(replies).values({
    id: randomUUID(),
    commentId: parsed.data.commentId,
    userId: session.user.id,
    content: parsed.data.content,
  });

  revalidatePath("/feed");
}
