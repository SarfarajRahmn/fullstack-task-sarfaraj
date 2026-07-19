"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { comments, likes, posts, replies, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  createPostSchema,
  commentSchema,
  replySchema,
  updateProfileSchema,
} from "@/lib/validations";
import { saveUploadedFile } from "@/lib/upload.server";

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
      parsed.error.flatten().fieldErrors.content?.[0] ??
        "Invalid post data.",
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
    throw new Error(
      parsed.error.flatten().fieldErrors.content?.[0] ??
        "Invalid comment content.",
    );
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
    throw new Error(
      parsed.error.flatten().fieldErrors.content?.[0] ?? "Invalid reply content.",
    );
  }

  await db.insert(replies).values({
    id: randomUUID(),
    commentId: parsed.data.commentId,
    userId: session.user.id,
    content: parsed.data.content,
  });

  revalidatePath("/feed");
}

export async function deleteComment(commentId: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to delete a comment.");
  }

  const commentRecord = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });

  if (!commentRecord) {
    throw new Error("Comment not found.");
  }

  if (commentRecord.userId !== session.user.id) {
    throw new Error("You are not authorized to delete this comment.");
  }

  await db.delete(comments).where(eq(comments.id, commentId));
  revalidatePath("/feed");
}

export async function deleteReply(replyId: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to delete a reply.");
  }

  const replyRecord = await db.query.replies.findFirst({
    where: eq(replies.id, replyId),
  });

  if (!replyRecord) {
    throw new Error("Reply not found.");
  }

  if (replyRecord.userId !== session.user.id) {
    throw new Error("You are not authorized to delete this reply.");
  }

  await db.delete(replies).where(eq(replies.id, replyId));
  revalidatePath("/feed");
}

export async function searchPosts(query: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to search.");
  }

  const response = await fetch(
    `/api/search?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Cookie: (await headers()).get("cookie") ?? "",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Search failed.");
  }

  const data = await response.json();
  return data.posts ?? [];
}

export async function updateProfile(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("You must be signed in to update your profile.");
  }

  const payload = {
    firstName: String(formData.get("firstName") ?? "").trim() || undefined,
    lastName: String(formData.get("lastName") ?? "").trim() || undefined,
    image: formData.get("image"),
  };

  const parsed = updateProfileSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error(
      parsed.error.flatten().fieldErrors.firstName?.[0] ??
        parsed.error.flatten().fieldErrors.lastName?.[0] ??
        "Invalid profile data.",
    );
  }

  let imageUrl: string | null | undefined = session.user.image;

  const imageField = formData.get("image");
  if (imageField instanceof File && imageField.size > 0) {
    imageUrl = await saveUploadedFile(imageField);
  }

  const name = `${parsed.data.firstName || ""} ${parsed.data.lastName || ""}`.trim() || session.user.name;

  await db
    .update(users)
    .set({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      name,
      image: imageUrl,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  const updatedUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!updatedUser) {
    throw new Error("Failed to update profile.");
  }

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    image: updatedUser.image,
  };
}
