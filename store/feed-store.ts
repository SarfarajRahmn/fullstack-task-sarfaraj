import { create } from "zustand";

interface FeedPost {
  id: string;
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
  };
  likes: Array<{ id: string }>;
  comments: Array<{ id: string }>;
}

interface FeedState {
  posts: FeedPost[];
  loading: boolean;
  setPosts: (posts: FeedPost[]) => void;
  setLoading: (loading: boolean) => void;
  appendPost: (post: FeedPost) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  loading: true,
  setPosts: (posts) => set({ posts }),
  setLoading: (loading) => set({ loading }),
  appendPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
}));
