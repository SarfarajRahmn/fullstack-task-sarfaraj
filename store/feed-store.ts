import { create } from "zustand";

export interface Like {
  id: string;
  userId: string;
  postId?: string | null;
  commentId?: string | null;
  replyId?: string | null;
}

export interface Reply {
  id: string;
  commentId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
  };
  likes: Like[];
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
  };
  likes: Like[];
  replies: Reply[];
}

export interface FeedPost {
  id: string;
  userId: string;
  content: string | null;
  imageUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  likes: Like[];
  comments: Comment[];
}

interface FeedState {
  posts: FeedPost[];
  loading: boolean;
  setPosts: (posts: FeedPost[]) => void;
  setLoading: (loading: boolean) => void;
  appendPost: (post: FeedPost) => void;
  deletePostFromStore: (postId: string) => void;
  togglePostLikeOptimistic: (postId: string, userId: string) => void;
  toggleCommentLikeOptimistic: (
    postId: string,
    commentId: string,
    userId: string,
  ) => void;
  toggleReplyLikeOptimistic: (
    postId: string,
    commentId: string,
    replyId: string,
    userId: string,
  ) => void;
  hasMore: boolean;
  nextCursor: string | null;
  loadingMore: boolean;
  mergeNewPosts: (newPosts: FeedPost[]) => void;
  setHasMore: (hasMore: boolean) => void;
  setNextCursor: (cursor: string | null) => void;
  setLoadingMore: (loading: boolean) => void;
  appendPosts: (newPosts: FeedPost[]) => void;
  resetPagination: () => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  loading: true,
  setPosts: (posts) => set({ posts }),
  setLoading: (loading) => set({ loading }),
  appendPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  mergeNewPosts: (newPosts) =>
    set((state) => {
      const existingIds = new Set(state.posts.map((p) => p.id));
      const fresh = newPosts.filter((p) => !existingIds.has(p.id));
      if (fresh.length === 0) return state;
      return { posts: [...fresh, ...state.posts] };
    }),
  deletePostFromStore: (postId) =>
    set((state) => ({ posts: state.posts.filter((p) => p.id !== postId) })),
  togglePostLikeOptimistic: (postId, userId) =>
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;
        const exists = post.likes.some((l) => l.userId === userId);
        const newLikes = exists
          ? post.likes.filter((l) => l.userId !== userId)
          : [
              ...post.likes,
              { id: Math.random().toString(), userId, postId },
            ];
        return { ...post, likes: newLikes };
      }),
    })),
  toggleCommentLikeOptimistic: (postId, commentId, userId) =>
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: post.comments.map((comment) => {
            if (comment.id !== commentId) return comment;
            const exists = comment.likes.some((l) => l.userId === userId);
            const newLikes = exists
              ? comment.likes.filter((l) => l.userId !== userId)
              : [
                  ...comment.likes,
                  { id: Math.random().toString(), userId, commentId },
                ];
            return { ...comment, likes: newLikes };
          }),
        };
      }),
    })),
  toggleReplyLikeOptimistic: (postId, commentId, replyId, userId) =>
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: post.comments.map((comment) => {
            if (comment.id !== commentId) return comment;
            return {
              ...comment,
              replies: comment.replies.map((reply) => {
                if (reply.id !== replyId) return reply;
                const exists = reply.likes.some((l) => l.userId === userId);
                const newLikes = exists
                  ? reply.likes.filter((l) => l.userId !== userId)
                  : [
                      ...reply.likes,
                      { id: Math.random().toString(), userId, replyId },
                    ];
                return { ...reply, likes: newLikes };
              }),
            };
          }),
        };
      }),
    })),
  hasMore: false,
  nextCursor: null,
  loadingMore: false,
  setHasMore: (hasMore) => set({ hasMore }),
  setNextCursor: (nextCursor) => set({ nextCursor }),
  setLoadingMore: (loadingMore) => set({ loadingMore }),
  appendPosts: (newPosts) =>
    set((state) => ({ posts: [...state.posts, ...newPosts] })),
  resetPagination: () =>
    set({ hasMore: false, nextCursor: null, loadingMore: false }),
}));
