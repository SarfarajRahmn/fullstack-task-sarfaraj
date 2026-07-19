import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { posts, users } from "@/db/schema";
import { desc, eq, or, sql, and } from "drizzle-orm";
import { enrichPostsWithRelations, type PostRow } from "@/lib/feed-query";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ posts: [] });
  }

  const searchTerm = `%${query}%`;

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
    .where(
      and(
        or(eq(posts.visibility, "PUBLIC"), eq(posts.userId, session.user.id)),
        sql`${posts.content} ILIKE ${searchTerm}`,
      ),
    )
    .orderBy(desc(posts.createdAt))) as PostRow[];

  const enriched = await enrichPostsWithRelations(results);

  return NextResponse.json({ posts: enriched });
}
