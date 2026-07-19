"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createPost,
  deletePost,
  toggleLike,
  toggleLikeComment,
  toggleLikeReply,
  commentPost,
  replyPost,
  deleteComment,
  deleteReply,
  searchPosts,
  updateProfile,
} from "@/actions/posts";
import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/store/auth-store";
import { useFeedStore } from "@/store/feed-store";
import { useUser } from "./user-context";
import LikersModal from "@/components/likers-modal";
import TopNav from "@/components/topnav";
import type { FeedPost } from "@/store/feed-store";

function formatUserName(
  u?: { firstName?: string | null; lastName?: string | null } | null,
) {
  if (!u) return "User";
  return `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User";
}

export default function FeedPage() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();
  const toggleProfile = useCallback(() => setIsProfileOpen((prev) => !prev), []);
  const user = useUser();
  const userName = formatUserName(user);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const posts = useFeedStore((state) => state.posts);
  const loading = useFeedStore((state) => state.loading);
  const setFeedPosts = useFeedStore((state) => state.setPosts);
  const setFeedLoading = useFeedStore((state) => state.setLoading);
  const togglePostLikeOptimistic = useFeedStore(
    (state) => state.togglePostLikeOptimistic,
  );
  const toggleCommentLikeOptimistic = useFeedStore(
    (state) => state.toggleCommentLikeOptimistic,
  );
  const toggleReplyLikeOptimistic = useFeedStore(
    (state) => state.toggleReplyLikeOptimistic,
  );

  // Post form state
  const [postText, setPostText] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedImagePreview = useMemo(
    () => (selectedImage ? URL.createObjectURL(selectedImage) : null),
    [selectedImage],
  );

  // Comment and reply inputs
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {},
  );
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<
    string | null
  >(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FeedPost[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [likersModal, setLikersModal] = useState<{
    isOpen: boolean;
    type: "post" | "comment" | "reply";
    entityId: string;
  }>({
    isOpen: false,
    type: "post",
    entityId: "",
  });

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const hasMore = useFeedStore((state) => state.hasMore);
  const nextCursor = useFeedStore((state) => state.nextCursor);
  const loadingMore = useFeedStore((state) => state.loadingMore);
  const setHasMore = useFeedStore((state) => state.setHasMore);
  const setNextCursor = useFeedStore((state) => state.setNextCursor);
  const setLoadingMore = useFeedStore((state) => state.setLoadingMore);
  const appendPosts = useFeedStore((state) => state.appendPosts);
  const resetPagination = useFeedStore((state) => state.resetPagination);
  const mergeNewPosts = useFeedStore((state) => state.mergeNewPosts);

  const loadFeed = async () => {
    try {
      const response = await fetch("/api/feed?limit=10");
      if (!response.ok) {
        throw new Error("Failed to load feed");
      }
      const data = await response.json();
      setFeedPosts(data.posts ?? []);
      setHasMore(data.hasMore ?? false);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      setFeedPosts([]);
      setHasMore(false);
      setNextCursor(null);
    } finally {
      setFeedLoading(false);
      resetPagination();
    }
  };

  useEffect(() => {
    setAuthUser(user ?? null);
  }, [setAuthUser, user]);

  useEffect(() => {
    setFeedLoading(true);
    loadFeed();
  }, [setFeedLoading, setFeedPosts]);

  // Live feed: poll for posts newer than the current newest post.
  useEffect(() => {
    const POLL_INTERVAL_MS = 15000;

    const poll = async () => {
      try {
        const current = useFeedStore.getState().posts;
        if (current.length === 0) return;
        const newest = current[0]?.createdAt;
        const url = newest
          ? `/api/feed?since=${encodeURIComponent(newest)}`
          : "/api/feed?limit=10";
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        const incoming: FeedPost[] = data.posts ?? [];
        if (incoming.length > 0) mergeNewPosts(incoming);
      } catch {
        // ignore transient network errors during polling
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mergeNewPosts]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() && !selectedImage) return;

    const formData = new FormData();
    formData.append("content", postText);
    formData.append("visibility", visibility);
    if (selectedImage) {
      formData.append("image", selectedImage);
    }

    try {
      await createPost(formData);
      setPostText("");
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadFeed();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await deletePost(postId);
      await loadFeed();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete post.");
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) return;
    togglePostLikeOptimistic(postId, user.id);
    try {
      await toggleLike(postId);
    } catch {
      // Revert/Reload feed on error
      await loadFeed();
    }
  };

  const handleLikeComment = async (postId: string, commentId: string) => {
    if (!user) return;
    toggleCommentLikeOptimistic(postId, commentId, user.id);
    try {
      await toggleLikeComment(commentId);
    } catch {
      await loadFeed();
    }
  };

  const handleLikeReply = async (
    postId: string,
    commentId: string,
    replyId: string,
  ) => {
    if (!user) return;
    toggleReplyLikeOptimistic(postId, commentId, replyId, user.id);
    try {
      await toggleLikeReply(replyId);
    } catch {
      await loadFeed();
    }
  };

  const handleCommentSubmit = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const content = commentInputs[postId] || "";
    if (!content.trim()) return;

    try {
      await commentPost(postId, content);
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      await loadFeed();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not post comment.");
    }
  };

  const handleReplySubmit = async (commentId: string, e: React.FormEvent) => {
    e.preventDefault();
    const content = replyInputs[commentId] || "";
    if (!content.trim()) return;

    try {
      await replyPost(commentId, content);
      setReplyInputs((prev) => ({ ...prev, [commentId]: "" }));
      setActiveReplyCommentId(null);
      await loadFeed();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not reply.");
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/feed?cursor=${encodeURIComponent(nextCursor)}&limit=10`,
      );
      if (!response.ok) throw new Error("Failed to load more");
      const data = await response.json();
      appendPosts(data.posts ?? []);
      setHasMore(data.hasMore ?? false);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      // silently fail for now
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchPosts(searchQuery);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch {
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      await deleteComment(commentId);
      await loadFeed();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete comment.");
    }
  };

  const handleDeleteReply = async (
    postId: string,
    commentId: string,
    replyId: string,
  ) => {
    if (!confirm("Are you sure you want to delete this reply?")) return;
    try {
      await deleteReply(replyId);
      await loadFeed();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete reply.");
    }
  };

  const handleShowLikers = (
    type: "post" | "comment" | "reply",
    entityId: string,
  ) => {
    setLikersModal({ isOpen: true, type, entityId });
  };

  const handleCloseLikers = () => {
    setLikersModal({ isOpen: false, type: "post", entityId: "" });
  };

  const handleToggleDarkMode = () => {
    document.documentElement.classList.toggle("dark");
  };

  const handleOpenEditProfile = () => {
    if (user) {
      setEditFirstName(user.firstName || "");
      setEditLastName(user.lastName || "");
      setEditImage(null);
    }
    setShowEditProfile(true);
  };

  const handleCloseEditProfile = () => {
    setShowEditProfile(false);
    setEditFirstName("");
    setEditLastName("");
    setEditImage(null);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFirstName.trim() && !editLastName.trim() && !editImage) {
      handleCloseEditProfile();
      return;
    }

    const formData = new FormData();
    formData.append("firstName", editFirstName);
    formData.append("lastName", editLastName);
    if (editImage) {
      formData.append("image", editImage);
    }

    try {
      const updated = await updateProfile(formData);
      setAuthUser(updated);
      handleCloseEditProfile();
      await loadFeed();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update profile.");
    }
  };

  return (
    <>
      {/*Feed Section Start*/}
      <div className="_layout _layout_main_wrapper">
        {/*Switching Btn Start*/}
        <div className="_layout_mode_swithing_btn">
          <button
            type="button"
            className="_layout_swithing_btn_link"
            onClick={handleToggleDarkMode}
          >
            <div className="_layout_swithing_btn">
              <div className="_layout_swithing_btn_round"></div>
            </div>
            <div className="_layout_change_btn_ic1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="16"
                fill="none"
                viewBox="0 0 11 16"
              >
                <path
                  fill="#fff"
                  d="M2.727 14.977l.04-.498-.04.498zm-1.72-.49l.489-.11-.489.11zM3.232 1.212L3.514.8l-.282.413zM9.792 8a6.5 6.5 0 00-6.5-6.5v-1a7.5 7.5 0 017.5 7.5h-1zm-6.5 6.5a6.5 6.5 0 006.5-6.5h1a7.5 7.5 0 01-7.5 7.5v-1zm-.525-.02c.173.013.348.02.525.02v1c-.204 0-.405-.008-.605-.024l.08-.997zm-.261-1.83A6.498 6.498 0 005.792 7h1a7.498 7.498 0 01-3.791 6.52l-.495-.87zM5.792 7a6.493 6.493 0 00-2.841-5.374L3.514.8A7.493 7.493 0 016.792 7h-1zm-3.105 8.476c-.528-.042-.985-.077-1.314-.155-.316-.075-.746-.242-.854-.726l.977-.217c-.028-.124-.145-.09.106-.03.237.056.6.086 1.165.131l-.08.997zm.314-1.956c-.622.354-1.045.596-1.31.792a.967.967 0 00-.204.185c-.01.013.027-.038.009-.12l-.977.218a.836.836 0 01.144-.666c.112-.162.27-.3.433-.42.324-.24.814-.519 1.41-.858L3 13.52zM3.292 1.5a.391.391 0 00.374-.285A.382.382 0 003.514.8l-.563.826A.618.618 0 012.702.95a.609.609 0 01.59-.45v1z"
                ></path>
              </svg>
            </div>
            <div className="_layout_change_btn_ic2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="4.389"
                  stroke="#fff"
                  transform="rotate(-90 12 12)"
                ></circle>
                <path
                  stroke="#fff"
                  strokeLinecap="round"
                  d="M3.444 12H1M23 12h-2.444M5.95 5.95L4.222 4.22M19.778 19.779L18.05 18.05M12 3.444V1M12 23v-2.445M18.05 5.95l1.728-1.729M4.222 19.779L5.95 18.05"
                ></path>
              </svg>
            </div>
          </button>
        </div>
        {/*Switching Btn End*/}
        <div className="_main_layout">
          <TopNav
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={handleSearch}
            userName={userName}
            userImage={user?.image}
            onOpenEditProfile={handleOpenEditProfile}
            onSignOut={handleSignOut}
            isProfileOpen={isProfileOpen}
            onToggleProfile={toggleProfile}
          />
          {/*Mobile Menu Start*/}
          <div className="_header_mobile_menu">
            <div className="_header_mobile_menu_wrap">
              <div className="container">
                <div className="_header_mobile_menu">
                  <div className="row">
                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                      <div className="_header_mobile_menu_top_inner">
                        <div className="_header_mobile_menu_logo">
                          <a href="/feed" className="_mobile_logo_link">
                            <Image
                              src="/assets/images/logo.svg"
                              alt="Image"
                              width={158}
                              height={33}
                              className="_nav_logo"
                            />
                          </a>
                        </div>
                        <div className="_header_mobile_menu_right">
                          <form className="_header_form_grp">
                            <a href="#0" className="_header_mobile_search">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="17"
                                height="17"
                                fill="none"
                                viewBox="0 0 17 17"
                              >
                                <circle cx="7" cy="7" r="6" stroke="#666" />
                                <path
                                  stroke="#666"
                                  strokeLinecap="round"
                                  d="M16 16l-3-3"
                                />
                              </svg>
                            </a>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/*Mobile Menu End*/}
          {/* Mobile Bottom Navigation */}
          <div className="_mobile_navigation_bottom_wrapper">
            <div className="_mobile_navigation_bottom_wrap">
              <div className="conatiner">
                <div className="row">
                  <div className="col-xl-12 col-lg-12 col-md-12">
                    <ul className="_mobile_navigation_bottom_list">
                      <li className="_mobile_navigation_bottom_item">
                        <a
                          href="/feed"
                          className="_mobile_navigation_bottom_link _mobile_navigation_bottom_link_active"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="27"
                            fill="none"
                            viewBox="0 0 24 27"
                          >
                            <path
                              className="_mobile_svg"
                              fill="#000"
                              fillOpacity=".6"
                              stroke="#666666"
                              strokeWidth="1.5"
                              d="M1 13.042c0-2.094 0-3.141.431-4.061.432-.92 1.242-1.602 2.862-2.965l1.571-1.321C8.792 2.232 10.256 1 12 1c1.744 0 3.208 1.232 6.136 3.695l1.572 1.321c1.62 1.363 2.43 2.044 2.86 2.965.432.92.432 1.967.432 4.06v6.54c0 2.908 0 4.362-.92 5.265-.921.904-2.403.904-5.366.904H7.286c-2.963 0-4.445 0-5.365-.904C1 23.944 1 22.49 1 19.581v-6.54z"
                            />
                            <path
                              fill="#fff"
                              stroke="#fff"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M9.07 18.497h5.857v7.253H9.07v-7.253z"
                            />
                          </svg>
                        </a>
                      </li>
                      <li className="_mobile_navigation_bottom_item">
                        <a href="#0" className="_mobile_navigation_bottom_link">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="27"
                            height="20"
                            fill="none"
                            viewBox="0 0 27 20"
                          >
                            <path
                              className="_dark_svg"
                              fill="#000"
                              fillOpacity=".6"
                              fillRule="evenodd"
                              d="M13.334 12.405h.138l.31.001c2.364.015 7.768.247 7.768 3.81 0 3.538-5.215 3.769-7.732 3.784h-.932c-2.364-.015-7.77-.247-7.77-3.805 0-3.543 5.405-3.774 7.77-3.789l.31-.001h.138zm0 1.787c-2.91 0-6.38.348-6.38 2.003 0 1.619 3.263 1.997 6.114 2.018l.266.001c2.91 0 6.379-.346 6.379-1.998 0-1.673-3.469-2.024-6.38-2.024zm9.742-2.27c2.967.432 3.59 1.787 3.59 2.849 0 .648-.261 1.83-2.013 2.48a.953.953 0 01-.327.058.919.919 0 01-.858-.575.886.886 0 01.531-1.153c.83-.307.83-.647.83-.81 0-.522-.682-.886-2.027-1.082a.9.9 0 01-.772-1.017c.074-.488.54-.814 1.046-.75zm-18.439.75a.9.9 0 01-.773 1.017c-1.345.196-2.027.56-2.027 1.082 0 .163 0 .501.832.81a.886.886 0 01.531 1.153.92.92 0 01-.858.575.953.953 0 01-.327-.058C.262 16.6 0 15.418 0 14.77c0-1.06.623-2.417 3.592-2.85.506-.061.97.263 1.045.751zM13.334 0c3.086 0 5.596 2.442 5.596 5.442 0 3.001-2.51 5.443-5.596 5.443H13.3a5.616 5.616 0 01-3.943-1.603A5.308 5.308 0 017.74 5.439C7.739 2.442 10.249 0 13.334 0zm0 1.787c-2.072 0-3.758 1.64-3.758 3.655-.003.977.381 1.89 1.085 2.58a3.772 3.772 0 002.642 1.076l.03.894v-.894c2.073 0 3.76-1.639 3.76-3.656 0-2.015-1.687-3.655-3.76-3.655zm7.58-.62c2.153.344 3.717 2.136 3.717 4.26-.004 2.138-1.647 3.972-3.82 4.269a.911.911 0 01-1.036-.761.897.897 0 01.782-1.01c1.273-.173 2.235-1.248 2.237-2.501 0-1.242-.916-2.293-2.179-2.494a.897.897 0 01-.756-1.027.917.917 0 011.055-.736zM6.81 1.903a.897.897 0 01-.757 1.027C4.79 3.13 3.874 4.182 3.874 5.426c.002 1.251.963 2.327 2.236 2.5.503.067.853.519.783 1.008a.912.912 0 01-1.036.762c-2.175-.297-3.816-2.131-3.82-4.267 0-2.126 1.563-3.918 3.717-4.262.515-.079.972.251 1.055.736z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </a>
                      </li>
                      <li className="_mobile_navigation_bottom_item">
                        <a href="#0" className="_mobile_navigation_bottom_link">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="25"
                            height="27"
                            fill="none"
                            viewBox="0 0 25 27"
                          >
                            <path
                              className="_dark_svg"
                              fill="#000"
                              fillOpacity=".6"
                              fillRule="evenodd"
                              d="M10.17 23.46c.671.709 1.534 1.098 2.43 1.098.9 0 1.767-.39 2.44-1.099.36-.377.976-.407 1.374-.067.4.34.432.923.073 1.3-1.049 1.101-2.428 1.708-3.886 1.708h-.003c-1.454-.001-2.831-.608-3.875-1.71a.885.885 0 01.072-1.298 1.01 1.01 0 011.374.068zM12.663 0c5.768 0 9.642 4.251 9.642 8.22 0 2.043.549 2.909 1.131 3.827.576.906 1.229 1.935 1.229 3.88-.453 4.97-5.935 5.375-12.002 5.375-6.067 0-11.55-.405-11.998-5.296-.004-2.024.649-3.053 1.225-3.959l.203-.324c.501-.814.928-1.7.928-3.502C3.022 4.25 6.897 0 12.664 0zm0 1.842C8.13 1.842 4.97 5.204 4.97 8.22c0 2.553-.75 3.733-1.41 4.774-.531.836-.95 1.497-.95 2.932.216 2.316 1.831 3.533 10.055 3.533 8.178 0 9.844-1.271 10.06-3.613-.004-1.355-.423-2.016-.954-2.852-.662-1.041-1.41-2.221-1.41-4.774 0-3.017-3.161-6.38-7.696-6.38z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="_counting">0</span>
                        </a>
                      </li>
                      <li className="_mobile_navigation_bottom_item">
                        <a
                          href="/chat_list(for_mbl).html"
                          className="_mobile_navigation_bottom_link"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <path
                              className="_dark_svg"
                              fill="#000"
                              fillOpacity=".6"
                              fillRule="evenodd"
                              d="M12.002 0c3.208 0 6.223 1.239 8.487 3.489 4.681 4.648 4.681 12.211 0 16.86-2.294 2.28-5.384 3.486-8.514 3.486-1.706 0-3.423-.358-5.03-1.097-.474-.188-.917-.366-1.235-.366-.366.003-.859.171-1.335.334-.976.333-2.19.748-3.09-.142-.895-.89-.482-2.093-.149-3.061.164-.477.333-.97.333-1.342 0-.306-.149-.697-.376-1.259C-1 12.417-.032 7.011 3.516 3.49A11.96 11.96 0 0112.002 0zm.001 1.663a10.293 10.293 0 00-7.304 3.003A10.253 10.253 0 002.63 16.244c.261.642.514 1.267.514 1.917 0 .649-.225 1.302-.422 1.878-.163.475-.41 1.191-.252 1.349.156.16.881-.092 1.36-.255.576-.195 1.228-.42 1.874-.424.648 0 1.259.244 1.905.503 3.96 1.818 8.645.99 11.697-2.039 4.026-4 4.026-10.509 0-14.508a10.294 10.294 0 00-7.303-3.002zm4.407 9.607c.617 0 1.117.495 1.117 1.109 0 .613-.5 1.109-1.117 1.109a1.116 1.116 0 01-1.12-1.11c0-.613.494-1.108 1.11-1.108h.01zm-4.476 0c.616 0 1.117.495 1.117 1.109 0 .613-.5 1.109-1.117 1.109a1.116 1.116 0 01-1.121-1.11c0-.613.493-1.108 1.11-1.108h.01zm-4.477 0c.617 0 1.117.495 1.117 1.109 0 .613-.5 1.109-1.117 1.109a1.116 1.116 0 01-1.12-1.11c0-.613.494-1.108 1.11-1.108h.01z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="_counting">0</span>
                        </a>
                      </li>
                      <div className="_header_mobile_toggle">
                        <form action="/mobileMenu.html">
                          <button
                            type="submit"
                            className="_header_mobile_btn_link"
                            value="go to mobile menu"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="14"
                              fill="none"
                              viewBox="0 0 18 14"
                            >
                              <path
                                stroke="#666"
                                strokeLinecap="round"
                                strokeWidth="1.5"
                                d="M1 1h16M1 7h16M1 13h16"
                              />
                            </svg>
                          </button>
                        </form>
                      </div>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Mobile Bottom Navigation End */}
          <div className="_layout_inner_wrap">
            <div className="row">
              {/* Left Sidebar */}
              <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                <div className="_layout_left_sidebar_wrap">
                  <div className="_layout_left_sidebar_inner">
                    <div className="_left_inner_area_explore _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                      <h4 className="_left_inner_area_explore_title _title5 _mar_b24">
                        Explore
                      </h4>
                      <ul className="_left_inner_area_explore_list">
                        <li className="_left_inner_area_explore_item _explore_item">
                          <a
                            href="#0"
                            className="_left_inner_area_explore_link"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              fill="none"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fill="#666"
                                d="M10 0c5.523 0 10 4.477 10 10s-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0zm0 1.395a8.605 8.605 0 100 17.21 8.605 8.605 0 000-17.21zm-1.233 4.65l.104.01c.188.028.443.113.668.203 1.026.398 3.033 1.746 3.8 2.563l.223.239.08.092a1.16 1.16 0 01.025 1.405c-.04.053-.086.105-.19.215l-.269.28c-.812.794-2.57 1.971-3.569 2.391-.277.117-.675.25-.865.253a1.167 1.167 0 01-1.07-.629c-.053-.104-.12-.353-.171-.586l-.051-.262c-.093-.57-.143-1.437-.142-2.347l.001-.288c.01-.858.063-1.64.157-2.147.037-.207.12-.563.167-.678.104-.25.291-.45.523-.575a1.15 1.15 0 01.58-.14zm.14 1.467l-.027.126-.034.198c-.07.483-.112 1.233-.111 2.036l.001.279c.009.737.053 1.414.123 1.841l.048.235.192-.07c.883-.372 2.636-1.56 3.23-2.2l.08-.087-.212-.218c-.711-.682-2.38-1.79-3.167-2.095l-.124-.045z"
                              ></path>
                            </svg>
                            Learning
                          </a>
                          <span className="_left_inner_area_explore_link_txt">
                            New
                          </span>
                        </li>
                        <li className="_left_inner_area_explore_item">
                          <a
                            href="#0"
                            className="_left_inner_area_explore_link"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="22"
                              height="24"
                              fill="none"
                              viewBox="0 0 22 24"
                            >
                              <path
                                fill="#666"
                                d="M14.96 2c3.101 0 5.159 2.417 5.159 5.893v8.214c0 3.476-2.058 5.893-5.16 5.893H6.989c-3.101 0-5.159-2.417-5.159-5.893V7.893C1.83 4.42 3.892 2 6.988 2h7.972zm0 1.395H6.988c-2.37 0-3.883 1.774-3.883 4.498v8.214c0 2.727 1.507 4.498 3.883 4.498h7.972c2.375 0 3.883-1.77 3.883-4.498V7.893c0-2.727-1.508-4.498-3.883-4.498zM7.036 9.63c.323 0 .59.263.633.604l.005.094v6.382c0 .385-.285.697-.638.697-.323 0-.59-.262-.632-.603l-.006-.094v-6.382c0-.385.286-.697.638-.697zm3.97-3.053c.323 0 .59.262.632.603l.006.095v9.435c0 .385-.285.697-.638.697-.323 0-.59-.262-.632-.603l-.006-.094V7.274c0-.386.286-.698.638-.698zm3.905 6.426c.323 0 .59.262.632.603l.006.094v3.01c0 .385-.285.697-.638.697-.323 0-.59-.262-.632-.603l-.006-.094v-3.01c0-.385.286-.697.638-.697z"
                              ></path>
                            </svg>
                            Insights
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              {/* Left Sidebar End */}

              {/* Layout Middle */}
              <div className="col-xl-6 col-lg-6 col-md-12 col-sm-12">
                <div className="_layout_middle_wrap">
                  <div className="_layout_middle_inner">
                    {/*For Desktop*/}
                    <div className="_feed_inner_ppl_card _mar_b16">
                      <div className="_feed_inner_story_arrow">
                        <button
                          type="button"
                          className="_feed_inner_story_arrow_btn"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="9"
                            height="8"
                            fill="none"
                            viewBox="0 0 9 8"
                          >
                            <path
                              fill="#fff"
                              d="M8 4l.366-.341.318.341-.318.341L8 4zm-7 .5a.5.5 0 010-1v1zM5.566.659l2.8 3-.732.682-2.8-3L5.566.66zm2.8 3.682l-2.8 3-.732-.682 2.8-3 .732.682zM8 4.5H1v-1h7v1z"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="row">
                        <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col">
                          <div className="_feed_inner_profile_story _b_radious6">
                            <div className="_feed_inner_profile_story_image">
                              <Image
                                src="/assets/images/card_ppl1.png"
                                alt="Image"
                                width={300}
                                height={330}
                                className="_profile_story_img"
                              />
                              <div className="_feed_inner_story_txt">
                                <div className="_feed_inner_story_btn">
                                  <button className="_feed_inner_story_btn_link">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="10"
                                      height="10"
                                      fill="none"
                                      viewBox="0 0 10 10"
                                    >
                                      <path
                                        stroke="#fff"
                                        strokeLinecap="round"
                                        d="M.5 4.884h9M4.884 9.5v-9"
                                      />
                                    </svg>
                                  </button>
                                </div>
                                <p className="_feed_inner_story_para">
                                  Your Story
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col">
                          <div className="_feed_inner_public_story _b_radious6">
                            <div className="_feed_inner_public_story_image">
                              <Image
                                src="/assets/images/card_ppl2.png"
                                alt="Image"
                                width={300}
                                height={330}
                                className="_public_story_img"
                              />
                              <div className="_feed_inner_pulic_story_txt">
                                <p className="_feed_inner_pulic_story_para">
                                  Ryan Roslansky
                                </p>
                              </div>
                              <div className="_feed_inner_public_mini">
                                <Image
                                  src="/assets/images/mini_pic.png"
                                  alt="Image"
                                  width={56}
                                  height={56}
                                  className="_public_mini_img"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 _custom_mobile_none">
                          <div className="_feed_inner_public_story _b_radious6">
                            <div className="_feed_inner_public_story_image">
                              <Image
                                src="/assets/images/card_ppl3.png"
                                alt="Image"
                                width={300}
                                height={330}
                                className="_public_story_img"
                              />
                              <div className="_feed_inner_pulic_story_txt">
                                <p className="_feed_inner_pulic_story_para">
                                  Ryan Roslansky
                                </p>
                              </div>
                              <div className="_feed_inner_public_mini">
                                <Image
                                  src="/assets/images/mini_pic.png"
                                  alt="Image"
                                  width={56}
                                  height={56}
                                  className="_public_mini_img"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 _custom_none">
                          <div className="_feed_inner_public_story _b_radious6">
                            <div className="_feed_inner_public_story_image">
                              <Image
                                src="/assets/images/card_ppl4.png"
                                alt="Image"
                                width={300}
                                height={330}
                                className="_public_story_img"
                              />
                              <div className="_feed_inner_pulic_story_txt">
                                <p className="_feed_inner_pulic_story_para">
                                  Ryan Roslansky
                                </p>
                              </div>
                              <div className="_feed_inner_public_mini">
                                <Image
                                  src="/assets/images/mini_pic.png"
                                  alt="Image"
                                  width={56}
                                  height={56}
                                  className="_public_mini_img"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/*For Desktop End*/}
                    {/*For Mobile*/}
                    <div className="_feed_inner_ppl_card_mobile _mar_b16">
                      <div className="_feed_inner_ppl_card_area">
                        <ul className="_feed_inner_ppl_card_area_list">
                          <li className="_feed_inner_ppl_card_area_item">
                            <a
                              href="#0"
                              className="_feed_inner_ppl_card_area_link"
                            >
                              <div className="_feed_inner_ppl_card_area_story">
                                <Image
                                  src="/assets/images/mobile_story_img.png"
                                  alt="Image"
                                  width={120}
                                  height={120}
                                  className="_card_story_img"
                                />
                                <div className="_feed_inner_ppl_btn">
                                  <button
                                    className="_feed_inner_ppl_btn_link"
                                    type="button"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      fill="none"
                                      viewBox="0 0 12 12"
                                    >
                                      <path
                                        stroke="#fff"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 2.5v7M2.5 6h7"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              <p className="_feed_inner_ppl_card_area_link_txt">
                                Your Story
                              </p>
                            </a>
                          </li>
                          <li className="_feed_inner_ppl_card_area_item">
                            <a
                              href="#0"
                              className="_feed_inner_ppl_card_area_link"
                            >
                              <div className="_feed_inner_ppl_card_area_story_active">
                                <Image
                                  src="/assets/images/mobile_story_img1.png"
                                  alt="Image"
                                  width={60}
                                  height={60}
                                  className="_card_story_img1"
                                />
                              </div>
                              <p className="_feed_inner_ppl_card_area_txt">
                                Ryan...
                              </p>
                            </a>
                          </li>
                          <li className="_feed_inner_ppl_card_area_item">
                            <a
                              href="#0"
                              className="_feed_inner_ppl_card_area_link"
                            >
                              <div className="_feed_inner_ppl_card_area_story_inactive">
                                <Image
                                  src="/assets/images/mobile_story_img2.png"
                                  alt="Image"
                                  width={120}
                                  height={120}
                                  className="_card_story_img1"
                                />
                              </div>
                              <p className="_feed_inner_ppl_card_area_txt">
                                Ryan...
                              </p>
                            </a>
                          </li>
                          <li className="_feed_inner_ppl_card_area_item">
                            <a
                              href="#0"
                              className="_feed_inner_ppl_card_area_link"
                            >
                              <div className="_feed_inner_ppl_card_area_story_active">
                                <Image
                                  src="/assets/images/mobile_story_img1.png"
                                  alt="Image"
                                  width={60}
                                  height={60}
                                  className="_card_story_img1"
                                />
                              </div>
                              <p className="_feed_inner_ppl_card_area_txt">
                                Ryan...
                              </p>
                            </a>
                          </li>
                          <li className="_feed_inner_ppl_card_area_item">
                            <a
                              href="#0"
                              className="_feed_inner_ppl_card_area_link"
                            >
                              <div className="_feed_inner_ppl_card_area_story_inactive">
                                <Image
                                  src="/assets/images/mobile_story_img2.png"
                                  alt="Image"
                                  width={120}
                                  height={120}
                                  className="_card_story_img1"
                                />
                              </div>
                              <p className="_feed_inner_ppl_card_area_txt">
                                Ryan...
                              </p>
                            </a>
                          </li>
                          <li className="_feed_inner_ppl_card_area_item">
                            <a
                              href="#0"
                              className="_feed_inner_ppl_card_area_link"
                            >
                              <div className="_feed_inner_ppl_card_area_story">
                                <Image
                                  src="/assets/images/mobile_story_img.png"
                                  alt="Image"
                                  width={120}
                                  height={120}
                                  className="_card_story_img"
                                />
                              </div>
                              <p className="_feed_inner_ppl_card_area_txt">
                                Ryan...
                              </p>
                            </a>
                          </li>
                        </ul>
                      </div>
                    </div>
                    {/*For Mobile End*/}
                    <form
                      onSubmit={handlePostSubmit}
                      className="_feed_inner_text_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setSelectedImage(file);
                        }}
                      />
                      <div className="_feed_inner_text_area_box">
                        <div className="_feed_inner_text_area_box_image">
                          <Image
                            src="/assets/images/txt_img.png"
                            alt="Image"
                            width={80}
                            height={80}
                            className="_txt_img"
                          />
                        </div>
                        <div className="form-floating _feed_inner_text_area_box_form">
                          <textarea
                            className="form-control _textarea"
                            placeholder="Leave a comment here"
                            id="floatingTextarea"
                            name="content"
                            value={postText}
                            onChange={(e) => setPostText(e.target.value)}
                          ></textarea>
                          <label
                            className="_feed_textarea_label"
                            htmlFor="floatingTextarea"
                          >
                            Write something ...
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="23"
                              height="24"
                              fill="none"
                              viewBox="0 0 23 24"
                            >
                              <path
                                fill="#666"
                                d="M19.504 19.209c.332 0 .601.289.601.646 0 .326-.226.596-.52.64l-.081.005h-6.276c-.332 0-.602-.289-.602-.645 0-.327.227-.597.52-.64l.082-.006h6.276zM13.4 4.417c1.139-1.223 2.986-1.223 4.125 0l1.182 1.268c1.14 1.223 1.14 3.205 0 4.427L9.82 19.649a2.619 2.619 0 01-1.916.85h-3.64c-.337 0-.61-.298-.6-.66l.09-3.941a3.019 3.019 0 01.794-1.982l8.852-9.5zm-.688 2.562l-7.313 7.85a1.68 1.68 0 00-.441 1.101l-.077 3.278h3.023c.356 0 .698-.133.968-.376l.098-.096 7.35-7.887-3.608-3.87zm3.962-1.65a1.633 1.633 0 00-2.423 0l-.688.737 3.606 3.87.688-.737c.631-.678.666-1.755.105-2.477l-.105-.124-1.183-1.268z"
                              />
                            </svg>
                          </label>
                        </div>
                      </div>

                      {selectedImage && (
                        <div className="mt-2 mb-2 px-3 d-flex align-items-center justify-content-between bg-light p-2 rounded">
                          <div className="d-flex align-items-center gap-2">
                            {selectedImagePreview && (
                              <Image
                                src={selectedImagePreview}
                                alt={selectedImage.name}
                                width={64}
                                height={64}
                                unoptimized
                                className="rounded object-fit-cover"
                                style={{ width: 64, height: 64 }}
                              />
                            )}
                            <span className="text-muted small text-truncate">
                              {selectedImage.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setSelectedImage(null)}
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {/*For Desktop*/}
                      <div className="_feed_inner_text_area_bottom">
                        <div className="_feed_inner_text_area_item">
                          <div className="_feed_inner_text_area_bottom_photo _feed_common">
                            <button
                              type="button"
                              className="_feed_inner_text_area_bottom_photo_link"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="20"
                                  height="20"
                                  fill="none"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fill="#666"
                                    d="M13.916 0c3.109 0 5.18 2.429 5.18 5.914v8.17c0 3.486-2.072 5.916-5.18 5.916H5.999C2.89 20 .827 17.572.827 14.085v-8.17C.827 2.43 2.897 0 6 0h7.917zm0 1.504H5.999c-2.321 0-3.799 1.735-3.799 4.41v8.17c0 2.68 1.472 4.412 3.799 4.412h7.917c2.328 0 3.807-1.734 3.807-4.411v-8.17c0-2.678-1.478-4.411-3.807-4.411zm.65 8.68l.12.125 1.9 2.147a.803.803 0 01-.016 1.063.642.642 0 01-.894.058l-.076-.074-1.9-2.148a.806.806 0 00-1.205-.028l-.074.087-2.04 2.717c-.722.963-2.02 1.066-2.86.26l-.111-.116-.814-.91a.562.562 0 00-.793-.07l-.075.073-1.4 1.617a.645.645 0 01-.97.029.805.805 0 01-.09-.977l.064-.086 1.4-1.617c.736-.852 1.95-.897 2.734-.137l.114.12.81.905a.587.587 0 00.861.033l.07-.078 2.04-2.718c.81-1.08 2.27-1.19 3.205-.275zM6.831 4.64c1.265 0 2.292 1.125 2.292 2.51 0 1.386-1.027 2.511-2.292 2.511S4.54 8.537 4.54 7.152c0-1.386 1.026-2.51 2.291-2.51zm0 1.504c-.507 0-.918.451-.918 1.007 0 .555.411 1.006.918 1.006.507 0 .919-.451.919-1.006 0-.556-.412-1.007-.919-1.007z"
                                  />
                                </svg>
                              </span>
                              Photo
                            </button>
                          </div>
                          <div className="_feed_inner_text_area_bottom_video _feed_common">
                            <button
                              type="button"
                              className="_feed_inner_text_area_bottom_photo_link"
                            >
                              <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="22"
                                  height="24"
                                  fill="none"
                                  viewBox="0 0 22 24"
                                >
                                  <path
                                    fill="#666"
                                    d="M11.485 4.5c2.213 0 3.753 1.534 3.917 3.784l2.418-1.082c1.047-.468 2.188.327 2.271 1.533l.005.141v6.64c0 1.237-1.103 2.093-2.155 1.72l-.121-.047-2.418-1.083c-.164 2.25-1.708 3.785-3.917 3.785H5.76c-2.343 0-3.932-1.72-3.932-4.188V8.688c0-2.47 1.589-4.188 3.932-4.188h5.726zm0 1.5H5.76C4.169 6 3.197 7.05 3.197 8.688v7.015c0 1.636.972 2.688 2.562 2.688h5.726c1.586 0 2.562-1.054 2.562-2.688v-.686-6.329c0-1.636-.973-2.688-2.562-2.688zM18.4 8.57l-.062.02-2.921 1.306v4.596l2.921 1.307c.165.073.343-.036.38-.215l.008-.07V8.876c0-.195-.16-.334-.326-.305z"
                                  />
                                </svg>
                              </span>
                              Video
                            </button>
                          </div>
                          <div className="_feed_inner_text_area_bottom_event _feed_common">
                            <button
                              type="button"
                              className="_feed_inner_text_area_bottom_photo_link"
                            >
                              <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="22"
                                  height="24"
                                  fill="none"
                                  viewBox="0 0 22 24"
                                >
                                  <path
                                    fill="#666"
                                    d="M14.371 2c.32 0 .585.262.627.603l.005.095v.788c2.598.195 4.188 2.033 4.18 5v8.488c0 3.145-1.786 5.026-4.656 5.026H7.395C4.53 22 2.74 20.087 2.74 16.904V8.486c0-2.966 1.596-4.804 4.187-5v-.788c0-.386.283-.698.633-.698.32 0 .584.262.626.603l.006.095v.771h5.546v-.771c0-.386.284-.698.633-.698zm3.546 8.283H4.004l.001 6.621c0 2.325 1.137 3.616 3.183 3.697l.207.004h7.132c2.184 0 3.39-1.271 3.39-3.63v-6.692zm-3.202 5.853c.349 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.237-.645.546-.692l.094-.006zm-3.742 0c.35 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.238-.645.546-.692l.094-.006zm-3.75 0c.35 0 .633.312.633.698 0 .353-.238.645-.547.691l-.093.006c-.35 0-.633-.312-.633-.697 0-.354.238-.645.547-.692l.094-.006zm7.492-3.615c.349 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.237-.645.546-.691l.094-.006zm-3.742 0c.35 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.238-.645.546-.691l.094-.006zm-3.75 0c.35 0 .633.312.633.697 0 .354-.238.645-.547.692l-.093.006c-.35 0-.633-.312-.633-.698 0-.353.238-.645.547-.691l.094-.006zm6.515-7.657H8.192v.895c0 .385-.283.698-.633.698-.32 0-.584-.263-.626-.603l-.006-.095v-.874c-1.886.173-2.922 1.422-2.922 3.6v.402h13.912v-.403c.007-2.181-1.024-3.427-2.914-3.599v.874c0 .385-.283.698-.632.698-.32 0-.585-.263-.627-.603l-.005-.095v-.895z"
                                  />
                                </svg>
                              </span>
                              Event
                            </button>
                          </div>
                          <div className="_feed_inner_text_area_bottom_article _feed_common">
                            <button
                              type="button"
                              className="_feed_inner_text_area_bottom_photo_link"
                            >
                              <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="20"
                                  fill="none"
                                  viewBox="0 0 18 20"
                                >
                                  <path
                                    fill="#666"
                                    d="M12.49 0c2.92 0 4.665 1.92 4.693 5.132v9.659c0 3.257-1.75 5.209-4.693 5.209H5.434c-.377 0-.734-.032-1.07-.095l-.2-.041C2 19.371.74 17.555.74 14.791V5.209c0-.334.019-.654.055-.96C1.114 1.564 2.799 0 5.434 0h7.056zm-.008 1.457H5.434c-2.244 0-3.381 1.263-3.381 3.752v9.582c0 2.489 1.137 3.752 3.38 3.752h7.049c2.242 0 3.372-1.263 3.372-3.752V5.209c0-2.489-1.13-3.752-3.372-3.752zm-.239 12.053c.36 0 .652.324.652.724 0 .4-.292.724-.652.724H5.656c-.36 0-.652-.324-.652-.724 0-.4.293-.724.652-.724h6.587zm0-4.239a.643.643 0 01.632.339.806.806 0 010 .78.643.643 0 01-.632.339H5.656c-.334-.042-.587-.355-.587-.729s.253-.688.587-.729h6.587zM8.17 5.042c.335.041.588.355.588.729 0 .373-.253.687-.588.728H5.665c-.336-.041-.589-.355-.589-.728 0-.374.253-.688.589-.729H8.17z"
                                  />
                                </svg>
                              </span>
                              Article
                            </button>
                          </div>
                        </div>
                        <div className="_feed_inner_text_area_btn">
                          <button
                            type="submit"
                            className="_feed_inner_text_area_btn_link"
                          >
                            <svg
                              className="_mar_img"
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="13"
                              fill="none"
                              viewBox="0 0 14 13"
                            >
                              <path
                                fill="#fff"
                                fillRule="evenodd"
                                d="M6.37 7.879l2.438 3.955a.335.335 0 00.34.162c.068-.01.23-.05.289-.247l3.049-10.297a.348.348 0 00-.09-.35.341.341 0 00-.34-.088L1.75 4.03a.34.34 0 00-.247.289.343.343 0 00.16.347L5.666 7.17 9.2 3.597a.5.5 0 01.712.703L6.37 7.88zM9.097 13c-.464 0-.89-.236-1.14-.641L5.372 8.165l-4.237-2.65a1.336 1.336 0 01-.622-1.331c.074-.536.441-.96.957-1.112L11.774.054a1.347 1.347 0 011.67 1.682l-3.05 10.296A1.332 1.332 0 019.098 13z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span>Post</span>
                          </button>
                        </div>
                      </div>
                      {/*For Desktop*/}

                      {/*For Mobile*/}
                      <div className="_feed_inner_text_area_bottom_mobile">
                        <div className="_feed_inner_text_mobile">
                          <div className="_feed_inner_text_area_item">
                            <div className="_feed_inner_text_area_bottom_photo _feed_common">
                              <button
                                type="button"
                                className="_feed_inner_text_area_bottom_photo_link"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    fill="none"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fill="#666"
                                      d="M13.916 0c3.109 0 5.18 2.429 5.18 5.914v8.17c0 3.486-2.072 5.916-5.18 5.916H5.999C2.89 20 .827 17.572.827 14.085v-8.17C.827 2.43 2.897 0 6 0h7.917zm0 1.504H5.999c-2.321 0-3.799 1.735-3.799 4.41v8.17c0 2.68 1.472 4.412 3.799 4.412h7.917c2.328 0 3.807-1.734 3.807-4.411v-8.17c0-2.678-1.478-4.411-3.807-4.411zm.65 8.68l.12.125 1.9 2.147a.803.803 0 01-.016 1.063.642.642 0 01-.894.058l-.076-.074-1.9-2.148a.806.806 0 00-1.205-.028l-.074.087-2.04 2.717c-.722.963-2.02 1.066-2.86.26l-.111-.116-.814-.91a.562.562 0 00-.793-.07l-.075.073-1.4 1.617a.645.645 0 01-.97.029.805.805 0 01-.09-.977l.064-.086 1.4-1.617c.736-.852 1.95-.897 2.734-.137l.114.12.81.905a.587.587 0 00.861.033l.07-.078 2.04-2.718c.81-1.08 2.27-1.19 3.205-.275zM6.831 4.64c1.265 0 2.292 1.125 2.292 2.51 0 1.386-1.027 2.511-2.292 2.511S4.54 8.537 4.54 7.152c0-1.386 1.026-2.51 2.291-2.51zm0 1.504c-.507 0-.918.451-.918 1.007 0 .555.411 1.006.918 1.006.507 0 .919-.451.919-1.006 0-.556-.412-1.007-.919-1.007z"
                                    />
                                  </svg>
                                </span>
                              </button>
                            </div>
                            <div className="_feed_inner_text_area_bottom_video _feed_common">
                              <button
                                type="button"
                                className="_feed_inner_text_area_bottom_photo_link"
                              >
                                <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="22"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 22 24"
                                  >
                                    <path
                                      fill="#666"
                                      d="M11.485 4.5c2.213 0 3.753 1.534 3.917 3.784l2.418-1.082c1.047-.468 2.188.327 2.271 1.533l.005.141v6.64c0 1.237-1.103 2.093-2.155 1.72l-.121-.047-2.418-1.083c-.164 2.25-1.708 3.785-3.917 3.785H5.76c-2.343 0-3.932-1.72-3.932-4.188V8.688c0-2.47 1.589-4.188 3.932-4.188h5.726zm0 1.5H5.76C4.169 6 3.197 7.05 3.197 8.688v7.015c0 1.636.972 2.688 2.562 2.688h5.726c1.586 0 2.562-1.054 2.562-2.688v-.686-6.329c0-1.636-.973-2.688-2.562-2.688zM18.4 8.57l-.062.02-2.921 1.306v4.596l2.921 1.307c.165.073.343-.036.38-.215l.008-.07V8.876c0-.195-.16-.334-.326-.305z"
                                    />
                                  </svg>
                                </span>
                              </button>
                            </div>
                            <div className="_feed_inner_text_area_bottom_event _feed_common">
                              <button
                                type="button"
                                className="_feed_inner_text_area_bottom_photo_link"
                              >
                                <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="22"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 22 24"
                                  >
                                    <path
                                      fill="#666"
                                      d="M14.371 2c.32 0 .585.262.627.603l.005.095v.788c2.598.195 4.188 2.033 4.18 5v8.488c0 3.145-1.786 5.026-4.656 5.026H7.395C4.53 22 2.74 20.087 2.74 16.904V8.486c0-2.966 1.596-4.804 4.187-5v-.788c0-.386.283-.698.633-.698.32 0 .584.262.626.603l.006.095v.771h5.546v-.771c0-.386.284-.698.633-.698zm3.546 8.283H4.004l.001 6.621c0 2.325 1.137 3.616 3.183 3.697l.207.004h7.132c2.184 0 3.39-1.271 3.39-3.63v-6.692zm-3.202 5.853c.349 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.237-.645.546-.692l.094-.006zm-3.742 0c.35 0 .632.312.632.698 0 .353-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.238-.645.546-.692l.094-.006zm-3.75 0c.35 0 .633.312.633.698 0 .353-.238.645-.547.691l-.093.006c-.35 0-.633-.312-.633-.697 0-.354.238-.645.547-.692l.094-.006zm7.492-3.615c.349 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.237-.645.546-.691l.094-.006zm-3.742 0c.35 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.238-.645.546-.691l.094-.006zm-3.75 0c.35 0 .633.312.633.697 0 .354-.238.645-.547.692l-.093.006c-.35 0-.633-.312-.633-.698 0-.353.238-.645.547-.691l.094-.006zm6.515-7.657H8.192v.895c0 .385-.283.698-.633.698-.32 0-.584-.263-.626-.603l-.006-.095v-.874c-1.886.173-2.922 1.422-2.922 3.6v.402h13.912v-.403c.007-2.181-1.024-3.427-2.914-3.599v.874c0 .385-.283.698-.632.698-.32 0-.585-.263-.627-.603l-.005-.095v-.895z"
                                    />
                                  </svg>
                                </span>
                              </button>
                            </div>
                            <div className="_feed_inner_text_area_bottom_article _feed_common">
                              <button
                                type="button"
                                className="_feed_inner_text_area_bottom_photo_link"
                              >
                                <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="20"
                                    fill="none"
                                    viewBox="0 0 18 20"
                                  >
                                    <path
                                      fill="#666"
                                      d="M12.49 0c2.92 0 4.665 1.92 4.693 5.132v9.659c0 3.257-1.75 5.209-4.693 5.209H5.434c-.377 0-.734-.032-1.07-.095l-.2-.041C2 19.371.74 17.555.74 14.791V5.209c0-.334.019-.654.055-.96C1.114 1.564 2.799 0 5.434 0h7.056zm-.008 1.457H5.434c-2.244 0-3.381 1.263-3.381 3.752v9.582c0 2.489 1.137 3.752 3.38 3.752h7.049c2.242 0 3.372-1.263 3.372-3.752V5.209c0-2.489-1.13-3.752-3.372-3.752zm-.239 12.053c.36 0 .652.324.652.724 0 .4-.292.724-.652.724H5.656c-.36 0-.652-.324-.652-.724 0-.4.293-.724.652-.724h6.587zm0-4.239a.643.643 0 01.632.339.806.806 0 010 .78.643.643 0 01-.632.339H5.656c-.334-.042-.587-.355-.587-.729s.253-.688.587-.729h6.587zM8.17 5.042c.335.041.588.355.588.729 0 .373-.253.687-.588.728H5.665c-.336-.041-.589-.355-.589-.728 0-.374.253-.688.589-.729H8.17z"
                                    />
                                  </svg>
                                </span>
                              </button>
                            </div>
                          </div>
                          <div className="_feed_inner_text_area_btn">
                            <button
                              type="submit"
                              className="_feed_inner_text_area_btn_link"
                            >
                              <svg
                                className="_mar_img"
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="13"
                                fill="none"
                                viewBox="0 0 14 13"
                              >
                                <path
                                  fill="#fff"
                                  fillRule="evenodd"
                                  d="M6.37 7.879l2.438 3.955a.335.335 0 00.34.162c.068-.01.23-.05.289-.247l3.049-10.297a.348.348 0 00-.09-.35.341.341 0 00-.34-.088L1.75 4.03a.34.34 0 00-.247.289.343.343 0 00.16.347L5.666 7.17 9.2 3.597a.5.5 0 01.712.703L6.37 7.88zM9.097 13c-.464 0-.89-.236-1.14-.641L5.372 8.165l-4.237-2.65a1.336 1.336 0 01-.622-1.331c.074-.536.441-.96.957-1.112L11.774.054a1.347 1.347 0 011.67 1.682l-3.05 10.296A1.332 1.332 0 019.098 13z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>Post</span>
                            </button>
                          </div>
                        </div>
                      </div>
                     {/*For Mobile*/}
                     </form>

                     {showSearchResults && (
                       <div className="_feed_inner_search_results _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
                         <h5 className="_title5 _mar_b16">Search Results</h5>
                         {searchLoading ? (
                           <div className="text-center p-4">
                             <div
                               className="spinner-border text-primary"
                               role="status"
                             >
                               <span className="visually-hidden">
                                 Searching...
                               </span>
                             </div>
                           </div>
                         ) : searchResults.length === 0 ? (
                           <p className="text-muted">
                             No posts found matching your search.
                           </p>
                         ) : (
                           searchResults.map((post) => (
                             <div
                               key={post.id}
                               className="border-bottom pb-3 mb-3"
                             >
                               <div className="d-flex justify-content-between align-items-center">
                                 <div>
                                   <h6 className="fw-bold">
                                     {post.user
                                       ? `${post.user.firstName} ${post.user.lastName}`
                                       : "User"}
                                   </h6>
                                   <p className="text-muted small mb-1">
                                     {post.content?.slice(0, 120)}
                                     {post.content && post.content.length > 120 ? "..." : ""}
                                   </p>
                                   <span className="badge bg-light text-dark">
                                     {post.visibility === "PUBLIC"
                                       ? "🌍 Public"
                                       : "🔒 Private"}
                                   </span>
                                 </div>
                                 {post.imageUrl && (
                                   <Image
                                     src={post.imageUrl}
                                     alt=""
                                     width={80}
                                     height={80}
                                     className="rounded"
                                     style={{ objectFit: "cover" }}
                                   />
                                 )}
                               </div>
                             </div>
                           ))
                         )}
                       </div>
                     )}

                     {/* Loading State */}
                     {loading && (
                      <div className="text-center p-5">
                        <div
                          className="spinner-border text-primary"
                          role="status"
                        >
                          <span className="visually-hidden">
                            Loading feed...
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Feed Posts List */}
                    {!loading && posts.length === 0 && (
                      <div className="text-center p-5 bg-white rounded shadow-sm">
                        <p className="text-muted">
                          No posts available. Be the first to create one!
                        </p>
                      </div>
                    )}

                    {!loading &&
                      posts.map((post) => {
                        const hasLiked = post.likes.some(
                          (l) => l.userId === user?.id,
                        );
                        const isOwner = post.userId === user?.id;

                        return (
                          <div
                            key={post.id}
                            className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16"
                          >
                            <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
                              <div className="_feed_inner_timeline_post_top d-flex justify-content-between align-items-center">
                                <div className="_feed_inner_timeline_post_box">
                                  <div className="_feed_inner_timeline_post_box_image">
                                    <Image
                                      src="/assets/images/post_img.png"
                                      alt=""
                                      width={88}
                                      height={88}
                                      className="_post_img"
                                    />
                                  </div>
                                  <div className="_feed_inner_timeline_post_box_txt">
                                    <h4 className="_feed_inner_timeline_post_box_title">
                                      {post.user
                                        ? `${post.user.firstName} ${post.user.lastName}`
                                        : "User"}
                                    </h4>
                                    <p className="_feed_inner_timeline_post_box_para">
                                      {new Date(
                                        post.createdAt,
                                      ).toLocaleDateString()}{" "}
                                      .{" "}
                                      <span className="badge bg-light text-dark">
                                        {post.visibility === "PUBLIC"
                                          ? "🌍 Public"
                                          : "🔒 Private"}
                                      </span>
                                    </p>
                                  </div>
                                </div>

                                {isOwner && (
                                  <button
                                    onClick={() => handleDeletePost(post.id)}
                                    className="btn btn-sm btn-outline-danger"
                                    style={{
                                      borderRadius: "50%",
                                      width: "32px",
                                      height: "32px",
                                      padding: 0,
                                    }}
                                    title="Delete post"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {post.content && (
                                <h4
                                  className="_feed_inner_timeline_post_title mt-3"
                                  style={{
                                    fontSize: "16px",
                                    fontWeight: "normal",
                                  }}
                                >
                                  {post.content}
                                </h4>
                              )}

                              {post.imageUrl && (
                                <div className="_feed_inner_timeline_image mt-3">
                                  <Image
                                    src={post.imageUrl}
                                    alt="Post Attachment"
                                    width={1200}
                                    height={600}
                                    className="_time_img"
                                    style={{
                                      maxHeight: "400px",
                                      objectFit: "cover",
                                      width: "100%",
                                      borderRadius: "8px",
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26 mt-3">
                              <div className="_feed_inner_timeline_total_reacts_image d-flex align-items-center gap-1">
                                <span
                                  onClick={() =>
                                    handleShowLikers("post", post.id)
                                  }
                                  className="text-primary font-weight-bold"
                                  style={{ cursor: "pointer", fontSize: "14px" }}
                                >
                                  👍 {post.likes.length} Likes
                                </span>
                              </div>
                              <div className="_feed_inner_timeline_total_reacts_txt">
                                <p className="_feed_inner_timeline_total_reacts_para1">
                                  <span>{post.comments.length}</span> Comments
                                </p>
                              </div>
                            </div>

                            <div className="_feed_inner_timeline_reaction">
                              <button
                                onClick={() => handleLikePost(post.id)}
                                className={`_feed_inner_timeline_reaction_emoji _feed_reaction ${hasLiked ? "_feed_reaction_active" : ""}`}
                              >
                                <span className="_feed_inner_timeline_reaction_link">
                                  <span>👍 {hasLiked ? "Liked" : "Like"}</span>
                                </span>
                              </button>
                            </div>

                            {/* Comment Area */}
                            <div className="_feed_inner_timeline_cooment_area px-4 mt-3">
                              {/* Comment Input */}
                              <div className="_feed_inner_comment_box mb-3">
                                <form
                                  onSubmit={(e) =>
                                    handleCommentSubmit(post.id, e)
                                  }
                                  className="_feed_inner_comment_box_form"
                                >
                                  <div className="_feed_inner_comment_box_content">
                                    <div className="_feed_inner_comment_box_content_image">
                                      <Image
                                        src="/assets/images/comment_img.png"
                                        alt=""
                                        width={52}
                                        height={52}
                                        className="_comment_img"
                                      />
                                    </div>
                                    <div className="_feed_inner_comment_box_content_txt">
                                      <textarea
                                        className="form-control _comment_textarea"
                                        placeholder="Write a comment..."
                                        rows={1}
                                        value={commentInputs[post.id] || ""}
                                        onChange={(e) =>
                                          setCommentInputs((prev) => ({
                                            ...prev,
                                            [post.id]: e.target.value,
                                          }))
                                        }
                                      ></textarea>
                                    </div>
                                  </div>
                                  <div className="_feed_inner_comment_box_icon">
                                    <button
                                      type="submit"
                                      className="btn btn-sm btn-primary px-3 text-white"
                                      style={{ borderRadius: "10px" }}
                                    >
                                      Send
                                    </button>
                                  </div>
                                </form>
                              </div>

                              {/* Comments List */}
                              <div className="_timline_comment_main mt-2">
                                {post.comments.map((comment) => {
                                  const hasLikedComment =
                                    comment.likes?.some(
                                      (l) => l.userId === user?.id,
                                    ) ?? false;
                                  return (
                                    <div
                                      key={comment.id}
                                      className="mb-3 border-bottom pb-2"
                                    >
                                      <div className="_comment_main d-flex gap-2">
                                        <div className="_comment_image">
                                          <Image
                                            src="/assets/images/txt_img.png"
                                            alt=""
                                            width={80}
                                            height={80}
                                            className="_comment_img1"
                                          />
                                        </div>
                                        <div className="_comment_area grow">
                                          <div className="_comment_details bg-light p-2 rounded">
                                            <div className="_comment_details_top">
                                              <div className="_comment_name">
                                                <h4
                                                  className="_comment_name_title"
                                                  style={{
                                                    fontSize: "14px",
                                                    fontWeight: "bold",
                                                  }}
                                                >
                                                  {formatUserName(comment.user)}
                                                </h4>
                                              </div>
                                            </div>
                                            <div className="_comment_status mt-1">
                                              <p
                                                className="_comment_status_text"
                                                style={{
                                                  fontSize: "14px",
                                                  margin: 0,
                                                }}
                                              >
                                                {comment.content}
                                              </p>
                                            </div>
                                          </div>

                                          <div className="_comment_reply mt-1">
                                            <div className="_comment_reply_num">
                                              <ul
                                                className="_comment_reply_list d-flex gap-3 list-unstyled mb-0"
                                                style={{ fontSize: "12px" }}
                                              >
                                                <li
                                                  onClick={() =>
                                                    handleLikeComment(
                                                      post.id,
                                                      comment.id,
                                                    )
                                                  }
                                                  style={{ cursor: "pointer" }}
                                                  className="text-primary"
                                                >
                                                  <span>
                                                    👍{" "}
                                                    {hasLikedComment
                                                      ? "Liked"
                                                      : "Like"}{" "}
                                                    (
                                                    {comment.likes?.length || 0}
                                                    )
                                                  </span>
                                                </li>
                                                <li
                                                  onClick={() =>
                                                    handleShowLikers("comment", comment.id)
                                                  }
                                                  style={{ cursor: "pointer" }}
                                                  className="text-muted"
                                                >
                                                  <span>View likes</span>
                                                </li>
                                                <li
                                                  onClick={() =>
                                                    setActiveReplyCommentId(
                                                      activeReplyCommentId ===
                                                        comment.id
                                                        ? null
                                                        : comment.id,
                                                    )
                                                  }
                                                  style={{ cursor: "pointer" }}
                                                  className="text-primary"
                                                >
                                                  <span>Reply</span>
                                                </li>
                                                {comment.userId === user?.id && (
                                                  <li
                                                    onClick={() =>
                                                      handleDeleteComment(
                                                        post.id,
                                                        comment.id,
                                                      )
                                                    }
                                                    style={{ cursor: "pointer" }}
                                                    className="text-danger"
                                                  >
                                                    <span>Delete</span>
                                                  </li>
                                                )}
                                                <li className="text-muted">
                                                  <span>
                                                    {new Date(
                                                      comment.createdAt,
                                                    ).toLocaleDateString()}
                                                  </span>
                                                </li>
                                              </ul>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Replies List */}
                                      {comment.replies &&
                                        comment.replies.length > 0 && (
                                          <div className="ms-5 mt-2 pl-3 border-left">
                                            {comment.replies.map((reply) => {
                                              const hasLikedReply =
                                                reply.likes?.some(
                                                  (l) => l.userId === user?.id,
                                                ) ?? false;
                                              return (
                                                <div
                                                  key={reply.id}
                                                  className="d-flex gap-2 mt-2 bg-light p-2 rounded"
                                                  style={{ marginLeft: "10px" }}
                                                >
                                                  <div className="_comment_image">
                                                    <Image
                                                      src="/assets/images/comment_img.png"
                                                      alt=""
                                                      width={52}
                                                      height={52}
                                                      className="_comment_img1"
                                                      style={{
                                                        width: "24px",
                                                        height: "24px",
                                                      }}
                                                    />
                                                  </div>
                                                  <div className="grow">
                                                    <h5
                                                      style={{
                                                        fontSize: "12px",
                                                        fontWeight: "bold",
                                                        margin: 0,
                                                      }}
                                                    >
                                                      {formatUserName(
                                                        reply.user,
                                                      )}
                                                    </h5>
                                                    <p
                                                      style={{
                                                        fontSize: "13px",
                                                        margin: "2px 0 4px 0",
                                                      }}
                                                    >
                                                      {reply.content}
                                                    </p>
                                                    <div
                                                      className="d-flex gap-3 align-items-center"
                                                      style={{
                                                        fontSize: "11px",
                                                      }}
                                                    >
                                                       <span
                                                         onClick={() =>
                                                           handleLikeReply(
                                                             post.id,
                                                             comment.id,
                                                             reply.id,
                                                           )
                                                         }
                                                         className="text-primary"
                                                         style={{
                                                           cursor: "pointer",
                                                         }}
                                                       >
                                                         👍{" "}
                                                         {hasLikedReply
                                                           ? "Liked"
                                                           : "Like"}{" "}
                                                         (
                                                         {reply.likes?.length ||
                                                           0}
                                                         )
                                                       </span>
                                                       <span
                                                         onClick={() =>
                                                           handleShowLikers("reply", reply.id)
                                                         }
                                                         className="text-muted"
                                                         style={{ cursor: "pointer" }}
                                                       >
                                                         View likes
                                                       </span>
                                                       {reply.userId === user?.id && (
                                                         <span
                                                           onClick={() =>
                                                             handleDeleteReply(
                                                               post.id,
                                                               comment.id,
                                                               reply.id,
                                                             )
                                                           }
                                                           className="text-danger"
                                                           style={{ cursor: "pointer" }}
                                                         >
                                                           Delete
                                                         </span>
                                                       )}
                                                       <span className="text-muted">
                                                         {new Date(
                                                           reply.createdAt,
                                                         ).toLocaleDateString()}
                                                       </span>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                      {/* Reply Input Form */}
                                      {activeReplyCommentId === comment.id && (
                                        <div className="ms-5 mt-2">
                                          <form
                                            onSubmit={(e) =>
                                              handleReplySubmit(comment.id, e)
                                            }
                                            className="d-flex gap-2 align-items-center"
                                          >
                                            <input
                                              type="text"
                                              className="form-control form-control-sm"
                                              placeholder="Write a reply..."
                                              value={
                                                replyInputs[comment.id] || ""
                                              }
                                              onChange={(e) =>
                                                setReplyInputs((prev) => ({
                                                  ...prev,
                                                  [comment.id]: e.target.value,
                                                }))
                                              }
                                            />
                                            <button
                                              type="submit"
                                              className="btn btn-sm btn-primary text-white"
                                            >
                                              Reply
                                            </button>
                                          </form>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {hasMore && (
                    <div className="text-center mt-3 mb-4">
                      <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="btn btn-primary px-4"
                      >
                        {loadingMore ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                              aria-hidden="true"
                            ></span>
                            Loading...
                          </>
                        ) : (
                          "Load More"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Layout Middle End */}

              {/* Right Sidebar */}
              <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                <div className="_layout_right_sidebar_wrap">
                  <div className="_layout_right_sidebar_inner">
                    <div className="_right_inner_area_info _padd_t24 _padd_b24 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                      <div className="_right_inner_area_info_content _mar_b24">
                        <h4 className="_right_inner_area_info_content_title _title5">
                          You Might Like
                        </h4>
                      </div>
                      <hr className="_underline" />
                      <div className="_right_inner_area_info_ppl">
                        <div className="_right_inner_area_info_box">
                          <div className="_right_inner_area_info_box_image">
                            <a href="#0">
                              <Image
                                src="/assets/images/Avatar.png"
                                alt="Image"
                                width={100}
                                height={100}
                                className="_ppl_img"
                              />
                            </a>
                          </div>
                          <div className="_right_inner_area_info_box_txt">
                            <a href="#0">
                              <h4 className="_right_inner_area_info_box_title">
                                Radovan SkillArena
                              </h4>
                            </a>
                            <p className="_right_inner_area_info_box_para">
                              Founder & CEO at Trophy
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Right Sidebar End */}
            </div>
          </div>
        </div>
      </div>
      {/*Feed Section End*/}
      <LikersModal
        isOpen={likersModal.isOpen}
        onClose={handleCloseLikers}
        type={likersModal.type}
        entityId={likersModal.entityId}
      />
      {showEditProfile && (
        <div
          className="modal d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
          onClick={handleCloseEditProfile}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Profile</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseEditProfile}
                ></button>
              </div>
              <form onSubmit={handleUpdateProfile}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">First Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Last Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Profile Picture</label>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setEditImage(file);
                      }}
                    />
                    {editImage && (
                      <div className="mt-2 text-muted small">
                        Selected: {editImage.name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseEditProfile}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
