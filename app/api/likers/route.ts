import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  if (!type || !id) {
    return NextResponse.json(
      { error: "Missing type or id" },
      { status: 400 },
    );
  }

  let likeRecords = await db
    .select({ userId: likes.userId })
    .from(likes)
    .where(eq(likes.postId, ""));

  if (type === "post") {
    likeRecords = await db
      .select({ userId: likes.userId })
      .from(likes)
      .where(eq(likes.postId, id));
  } else if (type === "comment") {
    likeRecords = await db
      .select({ userId: likes.userId })
      .from(likes)
      .where(eq(likes.commentId, id));
  } else if (type === "reply") {
    likeRecords = await db
      .select({ userId: likes.userId })
      .from(likes)
      .where(eq(likes.replyId, id));
  } else {
    return NextResponse.json(
      { error: "Invalid type" },
      { status: 400 },
    );
  }

  const userIds = likeRecords.map((l) => l.userId);

  if (userIds.length === 0) {
    return NextResponse.json({ likers: [] });
  }

  const likers = await db
    .select({
      id: users.id,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      image: users.image,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  return NextResponse.json({ likers });
}
