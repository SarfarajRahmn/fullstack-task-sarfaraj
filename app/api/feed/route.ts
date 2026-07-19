import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { posts, users } from "@/db/schema";
import { desc, eq, lt, gt, or, and } from "drizzle-orm";
import { enrichPostsWithRelations, type PostRow } from "@/lib/feed-query";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const since = searchParams.get("since");
  const limit = Math.min(
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    MAX_LIMIT,
  );

  let whereCondition = or(
    eq(posts.visibility, "PUBLIC"),
    eq(posts.userId, session.user.id),
  );

  if (since) {
    // Live-feed polling: only posts strictly newer than the given timestamp.
    whereCondition = and(
      whereCondition,
      gt(posts.createdAt, new Date(since)),
    );
  } else if (cursor) {
    const cursorPost = await db
      .select({ createdAt: posts.createdAt })
      .from(posts)
      .where(eq(posts.id, cursor))
      .limit(1);

    if (cursorPost.length > 0) {
      whereCondition = and(
        whereCondition,
        lt(posts.createdAt, cursorPost[0].createdAt),
      );
    }
  }

  const results = (await db
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
    .where(whereCondition)
    .orderBy(desc(posts.createdAt))
    .limit(limit + 1)) as PostRow[];

  const hasMore = results.length > limit;
  const pagePosts = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? pagePosts[pagePosts.length - 1]?.id ?? null : null;

  const enriched = await enrichPostsWithRelations(pagePosts);

  return NextResponse.json({
    posts: enriched,
    nextCursor,
    hasMore,
  });
}
