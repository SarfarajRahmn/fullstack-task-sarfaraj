"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createPost,
  deletePost,
  toggleLike,
  toggleLikeComment,
  toggleLikeReply,
  commentPost,
  replyPost,
} from "@/actions/posts";
import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/store/auth-store";
import { useFeedStore } from "@/store/feed-store";
import { useUser } from "./user-context";

function formatUserName(u?: { firstName?: string | null; lastName?: string | null } | null) {
  if (!u) return "User";
  return `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User";
}

export default function FeedPage() {
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const router = useRouter();
  const user = useUser();
  const userName = formatUserName(user);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const posts = useFeedStore((state) => state.posts);
  const loading = useFeedStore((state) => state.loading);
  const setFeedPosts = useFeedStore((state) => state.setPosts);
  const setFeedLoading = useFeedStore((state) => state.setLoading);
  const togglePostLikeOptimistic = useFeedStore((state) => state.togglePostLikeOptimistic);
  const toggleCommentLikeOptimistic = useFeedStore((state) => state.toggleCommentLikeOptimistic);
  const toggleReplyLikeOptimistic = useFeedStore((state) => state.toggleReplyLikeOptimistic);

  // Post form state
  const [postText, setPostText] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comment and reply inputs
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);

  const loadFeed = async () => {
    try {
      const response = await fetch("/api/feed");
      if (!response.ok) {
        throw new Error("Failed to load feed");
      }
      const data = await response.json();
      setFeedPosts(data.posts ?? []);
    } catch {
      setFeedPosts([]);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    setAuthUser(user ?? null);
  }, [setAuthUser, user]);

  useEffect(() => {
    setFeedLoading(true);
    loadFeed();
  }, [setFeedLoading, setFeedPosts]);

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

  const handleLikeReply = async (postId: string, commentId: string, replyId: string) => {
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

  return (
    <>
      {/*Feed Section Start*/}
      <div className="_layout _layout_main_wrapper">
        {/*Switching Btn Start*/}
        <div className="_layout_mode_swithing_btn">
          <button type="button" className="_layout_swithing_btn_link">
            <div className="_layout_swithing_btn">
              <div className="_layout_swithing_btn_round"></div>
            </div>
            <div className="_layout_change_btn_ic1">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="16" fill="none" viewBox="0 0 11 16">
                <path fill="#fff" d="M2.727 14.977l.04-.498-.04.498zm-1.72-.49l.489-.11-.489.11zM3.232 1.212L3.514.8l-.282.413zM9.792 8a6.5 6.5 0 00-6.5-6.5v-1a7.5 7.5 0 017.5 7.5h-1zm-6.5 6.5a6.5 6.5 0 006.5-6.5h1a7.5 7.5 0 01-7.5 7.5v-1zm-.525-.02c.173.013.348.02.525.02v1c-.204 0-.405-.008-.605-.024l.08-.997zm-.261-1.83A6.498 6.498 0 005.792 7h1a7.498 7.498 0 01-3.791 6.52l-.495-.87zM5.792 7a6.493 6.493 0 00-2.841-5.374L3.514.8A7.493 7.493 0 016.792 7h-1zm-3.105 8.476c-.528-.042-.985-.077-1.314-.155-.316-.075-.746-.242-.854-.726l.977-.217c-.028-.124-.145-.09.106-.03.237.056.6.086 1.165.131l-.08.997zm.314-1.956c-.622.354-1.045.596-1.31.792a.967.967 0 00-.204.185c-.01.013.027-.038.009-.12l-.977.218a.836.836 0 01.144-.666c.112-.162.27-.3.433-.42.324-.24.814-.519 1.41-.858L3 13.52zM3.292 1.5a.391.391 0 00.374-.285A.382.382 0 003.514.8l-.563.826A.618.618 0 012.702.95a.609.609 0 01.59-.45v1z"></path>
              </svg>
            </div>
            <div className="_layout_change_btn_ic2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4.389" stroke="#fff" transform="rotate(-90 12 12)"></circle>
                <path stroke="#fff" strokeLinecap="round" d="M3.444 12H1M23 12h-2.444M5.95 5.95L4.222 4.22M19.778 19.779L18.05 18.05M12 3.444V1M12 23v-2.445M18.05 5.95l1.728-1.729M4.222 19.779L5.95 18.05"></path>
              </svg>
            </div>
          </button>
        </div>
        {/*Switching Btn End*/}
        <div className="_main_layout">
          {/*Desktop Menu Start*/}
          <nav className="navbar navbar-expand-lg navbar-light _header_nav _padd_t10">
            <div className="container _custom_container">
              <div className="_logo_wrap">
                <a className="navbar-brand" href="/feed">
                  <img src="/assets/images/logo.svg" alt="Image" className="_nav_logo" />
                </a>
              </div>
              <button
                className="navbar-toggler bg-light"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#navbarSupportedContent"
                aria-controls="navbarSupportedContent"
                aria-expanded="false"
                aria-label="Toggle navigation"
              >
                {" "}
                <span className="navbar-toggler-icon"></span>
              </button>
              <div className="collapse navbar-collapse" id="navbarSupportedContent">
                <div className="_header_form ms-auto">
                  <form className="_header_form_grp">
                    <svg
                      className="_header_form_svg"
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      fill="none"
                      viewBox="0 0 17 17"
                    >
                      <circle cx="7" cy="7" r="6" stroke="#666"></circle>
                      <path stroke="#666" strokeLinecap="round" d="M16 16l-3-3"></path>
                    </svg>
                    <input
                      className="form-control me-2 _inpt1"
                      type="search"
                      placeholder="input search text"
                      aria-label="Search"
                    />
                  </form>
                </div>
                <ul className="navbar-nav mb-2 mb-lg-0 _header_nav_list ms-auto _mar_r8">
                  <li className="nav-item _header_nav_item">
                    <a className="nav-link _header_nav_link_active _header_nav_link" aria-current="page" href="/feed">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="21" fill="none" viewBox="0 0 18 21">
                        <path
                          className="_home_active"
                          stroke="#000"
                          strokeWidth="1.5"
                          strokeOpacity=".6"
                          d="M1 9.924c0-1.552 0-2.328.314-3.01.313-.682.902-1.187 2.08-2.196l1.143-.98C6.667 1.913 7.732 1 9 1c1.268 0 2.333.913 4.463 2.738l1.142.98c1.179 1.01 1.768 1.514 2.081 2.196.314.682.314 1.458.314 3.01v4.846c0 2.155 0 3.233-.67 3.902-.669.67-1.746.67-3.901.67H5.57c-2.155 0-3.232 0-3.902-.67C1 18.002 1 16.925 1 14.77V9.924z"
                        ></path>
                        <path
                          className="_home_active"
                          stroke="#000"
                          strokeOpacity=".6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M11.857 19.341v-5.857a1 1 0 00-1-1H7.143a1 1 0 00-1 1v5.857"
                        ></path>
                      </svg>
                    </a>
                  </li>
                  <li className="nav-item _header_nav_item">
                    <a className="nav-link _header_nav_link" aria-current="page" href="#0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="20" fill="none" viewBox="0 0 26 20">
                        <path
                          fill="#000"
                          fillOpacity=".6"
                          fillRule="evenodd"
                          d="M12.79 12.15h.429c2.268.015 7.45.243 7.45 3.732 0 3.466-5.002 3.692-7.415 3.707h-.894c-2.268-.015-7.452-.243-7.452-3.727 0-3.47 5.184-3.697 7.452-3.711l.297-.001h.132zm0 1.75c-2.792 0-6.12.34-6.12 1.962 0 1.585 3.13 1.955 5.864 1.976l.255.002c2.792 0 6.118-.34 6.118-1.958 0-1.638-3.326-1.982-6.118-1.982zm9.343-2.224c2.846.424 3.444 1.751 3.444 2.79 0 .636-.251 1.794-1.931 2.43a.882.882 0 01-1.137-.506.873.873 0 01.51-1.13c.796-.3.796-.633.796-.793 0-.511-.654-.868-1.944-1.06a.878.878 0 01-.741-.996.886.886 0 011.003-.735zm-17.685.735a.878.878 0 01-.742.997c-1.29.19-1.944.548-1.944 1.059 0 .16 0 .491.798.793a.873.873 0 01-.314 1.693.897.897 0 01-.313-.057C.25 16.259 0 15.1 0 14.466c0-1.037.598-2.366 3.446-2.79.485-.06.929.257 1.002.735zM12.789 0c2.96 0 5.368 2.392 5.368 5.33 0 2.94-2.407 5.331-5.368 5.331h-.031a5.329 5.329 0 01-3.782-1.57 5.253 5.253 0 01-1.553-3.764C7.423 2.392 9.83 0 12.789 0zm0 1.75c-1.987 0-3.604 1.607-3.604 3.58a3.526 3.526 0 001.04 2.527 3.58 3.58 0 002.535 1.054l.03.875v-.875c1.987 0 3.605-1.605 3.605-3.58S14.777 1.75 12.789 1.75zm7.27-.607a4.222 4.222 0 013.566 4.172c-.004 2.094-1.58 3.89-3.665 4.181a.88.88 0 01-.994-.745.875.875 0 01.75-.989 2.494 2.494 0 002.147-2.45 2.473 2.473 0 00-2.09-2.443.876.876 0 01-.726-1.005.881.881 0 011.013-.721zm-13.528.72a.876.876 0 01-.726 1.006 2.474 2.474 0 00-2.09 2.446A2.493 2.493 0 005.86 7.762a.875.875 0 11-.243 1.734c-2.085-.29-3.66-2.087-3.664-4.179 0-2.082 1.5-3.837 3.566-4.174a.876.876 0 011.012.72z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                    </a>
                  </li>
                  <li className="nav-item _header_nav_item">
                    <span
                      id="_notify_btn"
                      className="nav-link _header_nav_link _header_notify_btn"
                      onClick={() => setIsNotifyOpen((prev) => !prev)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="22" fill="none" viewBox="0 0 20 22">
                        <path
                          fill="#000"
                          fillOpacity=".6"
                          fillRule="evenodd"
                          d="M7.547 19.55c.533.59 1.218.915 1.93.915.714 0 1.403-.324 1.938-.916a.777.777 0 011.09-.056c.318.284.344.77.058 1.084-.832.917-1.927 1.423-3.086 1.423h-.002c-1.155-.001-2.248-.506-3.077-1.424a.762.762 0 01.057-1.083.774.774 0 011.092.057zM9.527 0c4.58 0 7.657 3.543 7.657 6.85 0 1.702.436 2.424.899 3.19.457.754.976 1.612.976 3.233-.36 4.14-4.713 4.478-9.531 4.478-4.818 0-9.172-.337-9.528-4.413-.003-1.686.515-2.544.973-3.299l.161-.27c.398-.679.737-1.417.737-2.918C1.871 3.543 4.948 0 9.528 0zm0 1.535c-3.6 0-6.11 2.802-6.11 5.316 0 2.127-.595 3.11-1.12 3.978-.422.697-.755 1.247-.755 2.444.173 1.93 1.455 2.944 7.986 2.944 6.494 0 7.817-1.06 7.988-3.01-.003-1.13-.336-1.681-.757-2.378-.526-.868-1.12-1.851-1.12-3.978 0-2.514-2.51-5.316-6.111-5.316z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                      <span className="_counting">0</span>
                    </span>
                  </li>
                  <li className="nav-item _header_nav_item">
                    <a className="nav-link _header_nav_link" aria-current="page" href="#0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="23" height="22" fill="none" viewBox="0 0 23 22">
                        <path
                          fill="#000"
                          fillOpacity=".6"
                          fillRule="evenodd"
                          d="M11.43 0c2.96 0 5.743 1.143 7.833 3.22 4.32 4.29 4.32 11.271 0 15.562C17.145 20.886 14.293 22 11.405 22c-1.575 0-3.16-.33-4.643-1.012-.437-.174-.847-.338-1.14-.338-.338.002-.793.158-1.232.308-.9.307-2.022.69-2.852-.131-.826-.822-.445-1.932-.138-2.826.152-.44.307-.895.307-1.239 0-.282-.137-.642-.347-1.161C-.57 11.46.322 6.47 3.596 3.22A11.04 11.04 0 0111.43 0zm0 1.535A9.5 9.5 0 004.69 4.307a9.463 9.463 0 00-1.91 10.686c.241.592.474 1.17.474 1.77 0 .598-.207 1.201-.39 1.733-.15.439-.378 1.1-.231 1.245.143.147.813-.085 1.255-.235.53-.18 1.133-.387 1.73-.391.597 0 1.161.225 1.758.463 3.655 1.679 7.98.915 10.796-1.881 3.716-3.693 3.716-9.7 0-13.391a9.5 9.5 0 00-6.74-2.77zm4.068 8.867c.57 0 1.03.458 1.03 1.024 0 .566-.46 1.023-1.03 1.023a1.023 1.023 0 11-.01-2.047h.01zm-4.131 0c.568 0 1.03.458 1.03 1.024 0 .566-.462 1.023-1.03 1.023a1.03 1.03 0 01-1.035-1.024c0-.566.455-1.023 1.025-1.023h.01zm-4.132 0c.568 0 1.03.458 1.03 1.024 0 .566-.462 1.023-1.03 1.023a1.022 1.022 0 11-.01-2.047h.01z"
                          clipRule="evenodd"
                        ></path>
                      </svg>{" "}
                      <span className="_counting">0</span>
                    </a>
                  </li>
                </ul>
                <div className="_header_nav_profile">
                  <div className="_header_nav_profile_image">
                    <img src="/assets/images/profile.png" alt="Image" className="_nav_profile_img" />
                  </div>
                  <div className="_header_nav_dropdown">
                    <p className="_header_nav_para">{userName}</p>
                    <button id="_profile_drop_show_btn" className="_header_nav_dropdown_btn _dropdown_toggle" type="button">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" fill="none" viewBox="0 0 10 6">
                        <path fill="#112032" d="M5 5l.354.354L5 5.707l-.354-.353L5 5zm4.354-3.646l-4 4-.708-.708 4-4 .708.708zm-4.708 4l-4-4 .708-.708 4 4-.708.708z"></path>
                      </svg>
                    </button>
                  </div>
                  {/* dropdown */}
                  <div id="_prfoile_drop" className="_nav_profile_dropdown _profile_dropdown">
                    <div className="_nav_profile_dropdown_info">
                      <div className="_nav_profile_dropdown_image">
                        <img src="/assets/images/profile.png" alt="Image" className="_nav_drop_img" />
                      </div>
                      <div className="_nav_profile_dropdown_info_txt">
                        <h4 className="_nav_dropdown_title">{userName}</h4>
                        <a href="#0" className="_nav_drop_profile">
                          View Profile
                        </a>
                      </div>
                    </div>
                    <hr />
                    <ul className="_nav_dropdown_list">
                      <li className="_nav_dropdown_list_item">
                        <a href="#0" className="_nav_dropdown_link">
                          <div className="_nav_drop_info">
                            <span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="19" fill="none" viewBox="0 0 18 19">
                                <path
                                  fill="#377DFF"
                                  d="M9.584 0c.671 0 1.315.267 1.783.74.468.473.721 1.112.7 1.709l.009.14a.985.985 0 00.136.395c.145.242.382.418.659.488.276.071.57.03.849-.13l.155-.078c1.165-.538 2.563-.11 3.21.991l.58.99a.695.695 0 01.04.081l.055.107c.519 1.089.15 2.385-.838 3.043l-.244.15a1.046 1.046 0 00-.313.339 1.042 1.042 0 00-.11.805c.074.272.255.504.53.66l.158.1c.478.328.823.812.973 1.367.17.626.08 1.292-.257 1.86l-.625 1.022-.094.144c-.735 1.038-2.16 1.355-3.248.738l-.129-.066a1.123 1.123 0 00-.412-.095 1.087 1.087 0 00-.766.31c-.204.2-.317.471-.316.786l-.008.163C11.956 18.022 10.88 19 9.584 19h-1.17c-1.373 0-2.486-1.093-2.484-2.398l-.008-.14a.994.994 0 00-.14-.401 1.066 1.066 0 00-.652-.493 1.12 1.12 0 00-.852.127l-.169.083a2.526 2.526 0 01-1.698.122 2.47 2.47 0 01-1.488-1.154l-.604-1.024-.08-.152a2.404 2.404 0 01.975-3.132l.1-.061c.292-.199.467-.527.467-.877 0-.381-.207-.733-.569-.94l-.147-.092a2.419 2.419 0 01-.724-3.236l.615-.993a2.503 2.503 0 013.366-.912l.126.066c.13.058.269.089.403.09a1.08 1.08 0 001.086-1.068l.008-.185c.049-.57.301-1.106.713-1.513A2.5 2.5 0 018.414 0h1.17zm0 1.375h-1.17c-.287 0-.562.113-.764.312-.179.177-.288.41-.308.628l-.012.29c-.098 1.262-1.172 2.253-2.486 2.253a2.475 2.475 0 01-1.013-.231l-.182-.095a1.1 1.1 0 00-1.488.407l-.616.993a1.05 1.05 0 00.296 1.392l.247.153A2.43 2.43 0 013.181 9.5c0 .802-.401 1.552-1.095 2.023l-.147.091c-.486.276-.674.873-.448 1.342l.053.102.597 1.01c.14.248.374.431.652.509.246.069.51.05.714-.04l.103-.05a2.506 2.506 0 011.882-.248 2.456 2.456 0 011.823 2.1l.02.335c.059.535.52.95 1.079.95h1.17c.566 0 1.036-.427 1.08-.95l.005-.104a2.412 2.412 0 01.726-1.732 2.508 2.508 0 011.779-.713c.331.009.658.082.992.23l.3.15c.469.202 1.026.054 1.309-.344l.068-.105.61-1a1.045 1.045 0 00-.288-1.383l-.257-.16a2.435 2.435 0 01-1.006-1.389 2.393 2.393 0 01.25-1.847c.181-.31.429-.575.752-.795l.152-.095c.485-.278.672-.875.448-1.346l-.067-.127-.012-.027-.554-.945a1.095 1.095 0 00-1.27-.487l-.105.041-.098.049a2.515 2.515 0 01-1.88.259 2.47 2.47 0 01-1.511-1.122 2.367 2.367 0 01-.325-.97l-.012-.24a1.056 1.056 0 00-.307-.774 1.096 1.096 0 00-.779-.323zm-.58 5.02c1.744 0 3.16 1.39 3.16 3.105s-1.416 3.105-3.16 3.105c-1.746 0-3.161-1.39-3.161-3.105s1.415-3.105 3.16-3.105zm0 1.376c-.973 0-1.761.774-1.761 1.729 0 .955.788 1.73 1.76 1.73s1.76-.775 1.76-1.73-.788-1.73-1.76-1.73z"
                                ></path>
                              </svg>
                            </span>
                            Settings
                          </div>
                          <span className="_nav_drop_btn_link">
                            <svg xmlns="http://www.w3.org/2000/svg" width="6" height="10" fill="none" viewBox="0 0 6 10">
                              <path fill="#112032" d="M5 5l.354.354L5.707 5l-.353-.354L5 5zM1.354 9.354l4-4-.708-.708-4 4 .708.708zm4-4.708l-4-4-.708.708 4 4 .708-.708z" opacity=".5"></path>
                            </svg>
                          </span>
                        </a>
                      </li>
                      <li className="_nav_dropdown_list_item">
                        <button type="button" className="_nav_dropdown_link" onClick={handleSignOut}>
                          <div className="_nav_drop_info">
                            <span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="none" viewBox="0 0 19 19">
                                <path stroke="#377DFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.667 18H2.889A1.889 1.889 0 011 16.111V2.89A1.889 1.889 0 012.889 1h3.778M13.277 14.222L18 9.5l-4.723-4.722M18 9.5H6.667"></path>
                              </svg>
                            </span>
                            Log Out
                          </div>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </nav>
          {/*Desktop Menu End*/}
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
                            <img src="/assets/images/logo.svg" alt="Image" className="_nav_logo" />
                          </a>
                        </div>
                        <div className="_header_mobile_menu_right">
                          <form className="_header_form_grp">
                            <a href="#0" className="_header_mobile_search">
                              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 17 17">
                                <circle cx="7" cy="7" r="6" stroke="#666" />
                                <path stroke="#666" strokeLinecap="round" d="M16 16l-3-3" />
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
                        <a href="/feed" className="_mobile_navigation_bottom_link _mobile_navigation_bottom_link_active">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="27" fill="none" viewBox="0 0 24 27">
                            <path className="_mobile_svg" fill="#000" fillOpacity=".6" stroke="#666666" strokeWidth="1.5" d="M1 13.042c0-2.094 0-3.141.431-4.061.432-.92 1.242-1.602 2.862-2.965l1.571-1.321C8.792 2.232 10.256 1 12 1c1.744 0 3.208 1.232 6.136 3.695l1.572 1.321c1.62 1.363 2.43 2.044 2.86 2.965.432.92.432 1.967.432 4.06v6.54c0 2.908 0 4.362-.92 5.265-.921.904-2.403.904-5.366.904H7.286c-2.963 0-4.445 0-5.365-.904C1 23.944 1 22.49 1 19.581v-6.54z" />
                            <path fill="#fff" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.07 18.497h5.857v7.253H9.07v-7.253z" />
                          </svg>
                        </a>
                      </li>
                      <li className="_mobile_navigation_bottom_item">
                        <a href="#0" className="_mobile_navigation_bottom_link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="27" height="20" fill="none" viewBox="0 0 27 20">
                            <path className="_dark_svg" fill="#000" fillOpacity=".6" fillRule="evenodd" d="M13.334 12.405h.138l.31.001c2.364.015 7.768.247 7.768 3.81 0 3.538-5.215 3.769-7.732 3.784h-.932c-2.364-.015-7.77-.247-7.77-3.805 0-3.543 5.405-3.774 7.77-3.789l.31-.001h.138zm0 1.787c-2.91 0-6.38.348-6.38 2.003 0 1.619 3.263 1.997 6.114 2.018l.266.001c2.91 0 6.379-.346 6.379-1.998 0-1.673-3.469-2.024-6.38-2.024zm9.742-2.27c2.967.432 3.59 1.787 3.59 2.849 0 .648-.261 1.83-2.013 2.48a.953.953 0 01-.327.058.919.919 0 01-.858-.575.886.886 0 01.531-1.153c.83-.307.83-.647.83-.81 0-.522-.682-.886-2.027-1.082a.9.9 0 01-.772-1.017c.074-.488.54-.814 1.046-.75zm-18.439.75a.9.9 0 01-.773 1.017c-1.345.196-2.027.56-2.027 1.082 0 .163 0 .501.832.81a.886.886 0 01.531 1.153.92.92 0 01-.858.575.953.953 0 01-.327-.058C.262 16.6 0 15.418 0 14.77c0-1.06.623-2.417 3.592-2.85.506-.061.97.263 1.045.751zM13.334 0c3.086 0 5.596 2.442 5.596 5.442 0 3.001-2.51 5.443-5.596 5.443H13.3a5.616 5.616 0 01-3.943-1.603A5.308 5.308 0 017.74 5.439C7.739 2.442 10.249 0 13.334 0zm0 1.787c-2.072 0-3.758 1.64-3.758 3.655-.003.977.381 1.89 1.085 2.58a3.772 3.772 0 002.642 1.076l.03.894v-.894c2.073 0 3.76-1.639 3.76-3.656 0-2.015-1.687-3.655-3.76-3.655zm7.58-.62c2.153.344 3.717 2.136 3.717 4.26-.004 2.138-1.647 3.972-3.82 4.269a.911.911 0 01-1.036-.761.897.897 0 01.782-1.01c1.273-.173 2.235-1.248 2.237-2.501 0-1.242-.916-2.293-2.179-2.494a.897.897 0 01-.756-1.027.917.917 0 011.055-.736zM6.81 1.903a.897.897 0 01-.757 1.027C4.79 3.13 3.874 4.182 3.874 5.426c.002 1.251.963 2.327 2.236 2.5.503.067.853.519.783 1.008a.912.912 0 01-1.036.762c-2.175-.297-3.816-2.131-3.82-4.267 0-2.126 1.563-3.918 3.717-4.262.515-.079.972.251 1.055.736z" clipRule="evenodd" />
                          </svg>
                        </a>
                      </li>
                      <li className="_mobile_navigation_bottom_item">
                        <a href="#0" className="_mobile_navigation_bottom_link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="25" height="27" fill="none" viewBox="0 0 25 27">
                            <path className="_dark_svg" fill="#000" fillOpacity=".6" fillRule="evenodd" d="M10.17 23.46c.671.709 1.534 1.098 2.43 1.098.9 0 1.767-.39 2.44-1.099.36-.377.976-.407 1.374-.067.4.34.432.923.073 1.3-1.049 1.101-2.428 1.708-3.886 1.708h-.003c-1.454-.001-2.831-.608-3.875-1.71a.885.885 0 01.072-1.298 1.01 1.01 0 011.374.068zM12.663 0c5.768 0 9.642 4.251 9.642 8.22 0 2.043.549 2.909 1.131 3.827.576.906 1.229 1.935 1.229 3.88-.453 4.97-5.935 5.375-12.002 5.375-6.067 0-11.55-.405-11.998-5.296-.004-2.024.649-3.053 1.225-3.959l.203-.324c.501-.814.928-1.7.928-3.502C3.022 4.25 6.897 0 12.664 0zm0 1.842C8.13 1.842 4.97 5.204 4.97 8.22c0 2.553-.75 3.733-1.41 4.774-.531.836-.95 1.497-.95 2.932.216 2.316 1.831 3.533 10.055 3.533 8.178 0 9.844-1.271 10.06-3.613-.004-1.355-.423-2.016-.954-2.852-.662-1.041-1.41-2.221-1.41-4.774 0-3.017-3.161-6.38-7.696-6.38z" clipRule="evenodd" />
                          </svg>
                          <span className="_counting">0</span>
                        </a>
                      </li>
                      <li className="_mobile_navigation_bottom_item">
                        <a href="/chat_list(for_mbl).html" className="_mobile_navigation_bottom_link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path className="_dark_svg" fill="#000" fillOpacity=".6" fillRule="evenodd" d="M12.002 0c3.208 0 6.223 1.239 8.487 3.489 4.681 4.648 4.681 12.211 0 16.86-2.294 2.28-5.384 3.486-8.514 3.486-1.706 0-3.423-.358-5.03-1.097-.474-.188-.917-.366-1.235-.366-.366.003-.859.171-1.335.334-.976.333-2.19.748-3.09-.142-.895-.89-.482-2.093-.149-3.061.164-.477.333-.97.333-1.342 0-.306-.149-.697-.376-1.259C-1 12.417-.032 7.011 3.516 3.49A11.96 11.96 0 0112.002 0zm.001 1.663a10.293 10.293 0 00-7.304 3.003A10.253 10.253 0 002.63 16.244c.261.642.514 1.267.514 1.917 0 .649-.225 1.302-.422 1.878-.163.475-.41 1.191-.252 1.349.156.16.881-.092 1.36-.255.576-.195 1.228-.42 1.874-.424.648 0 1.259.244 1.905.503 3.96 1.818 8.645.99 11.697-2.039 4.026-4 4.026-10.509 0-14.508a10.294 10.294 0 00-7.303-3.002zm4.407 9.607c.617 0 1.117.495 1.117 1.109 0 .613-.5 1.109-1.117 1.109a1.116 1.116 0 01-1.12-1.11c0-.613.494-1.108 1.11-1.108h.01zm-4.476 0c.616 0 1.117.495 1.117 1.109 0 .613-.5 1.109-1.117 1.109a1.116 1.116 0 01-1.121-1.11c0-.613.493-1.108 1.11-1.108h.01zm-4.477 0c.617 0 1.117.495 1.117 1.109 0 .613-.5 1.109-1.117 1.109a1.116 1.116 0 01-1.12-1.11c0-.613.494-1.108 1.11-1.108h.01z" clipRule="evenodd" />
                          </svg>
                          <span className="_counting">0</span>
                        </a>
                      </li>
                      <div className="_header_mobile_toggle">
                        <form action="/mobileMenu.html">
                          <button type="submit" className="_header_mobile_btn_link" value="go to mobile menu">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="14" fill="none" viewBox="0 0 18 14">
                              <path stroke="#666" strokeLinecap="round" strokeWidth="1.5" d="M1 1h16M1 7h16M1 13h16" />
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
                        <h4 className="_left_inner_area_explore_title _title5 _mar_b24">Explore</h4>
                        <ul className="_left_inner_area_explore_list">
                          <li className="_left_inner_area_explore_item _explore_item">
                            <a href="#0" className="_left_inner_area_explore_link">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
                                <path fill="#666" d="M10 0c5.523 0 10 4.477 10 10s-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0zm0 1.395a8.605 8.605 0 100 17.21 8.605 8.605 0 000-17.21zm-1.233 4.65l.104.01c.188.028.443.113.668.203 1.026.398 3.033 1.746 3.8 2.563l.223.239.08.092a1.16 1.16 0 01.025 1.405c-.04.053-.086.105-.19.215l-.269.28c-.812.794-2.57 1.971-3.569 2.391-.277.117-.675.25-.865.253a1.167 1.167 0 01-1.07-.629c-.053-.104-.12-.353-.171-.586l-.051-.262c-.093-.57-.143-1.437-.142-2.347l.001-.288c.01-.858.063-1.64.157-2.147.037-.207.12-.563.167-.678.104-.25.291-.45.523-.575a1.15 1.15 0 01.58-.14zm.14 1.467l-.027.126-.034.198c-.07.483-.112 1.233-.111 2.036l.001.279c.009.737.053 1.414.123 1.841l.048.235.192-.07c.883-.372 2.636-1.56 3.23-2.2l.08-.087-.212-.218c-.711-.682-2.38-1.79-3.167-2.095l-.124-.045z"></path>
                              </svg>
                              Learning
                            </a>
                            <span className="_left_inner_area_explore_link_txt">New</span>
                          </li>
                          <li className="_left_inner_area_explore_item">
                            <a href="#0" className="_left_inner_area_explore_link">
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                                <path fill="#666" d="M14.96 2c3.101 0 5.159 2.417 5.159 5.893v8.214c0 3.476-2.058 5.893-5.16 5.893H6.989c-3.101 0-5.159-2.417-5.159-5.893V7.893C1.83 4.42 3.892 2 6.988 2h7.972zm0 1.395H6.988c-2.37 0-3.883 1.774-3.883 4.498v8.214c0 2.727 1.507 4.498 3.883 4.498h7.972c2.375 0 3.883-1.77 3.883-4.498V7.893c0-2.727-1.508-4.498-3.883-4.498zM7.036 9.63c.323 0 .59.263.633.604l.005.094v6.382c0 .385-.285.697-.638.697-.323 0-.59-.262-.632-.603l-.006-.094v-6.382c0-.385.286-.697.638-.697zm3.97-3.053c.323 0 .59.262.632.603l.006.095v9.435c0 .385-.285.697-.638.697-.323 0-.59-.262-.632-.603l-.006-.094V7.274c0-.386.286-.698.638-.698zm3.905 6.426c.323 0 .59.262.632.603l.006.094v3.01c0 .385-.285.697-.638.697-.323 0-.59-.262-.632-.603l-.006-.094v-3.01c0-.385.286-.697.638-.697z"></path>
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
                           <button type="button" className="_feed_inner_story_arrow_btn">
                             <svg xmlns="http://www.w3.org/2000/svg" width="9" height="8" fill="none" viewBox="0 0 9 8">
                               <path fill="#fff" d="M8 4l.366-.341.318.341-.318.341L8 4zm-7 .5a.5.5 0 010-1v1zM5.566.659l2.8 3-.732.682-2.8-3L5.566.66zm2.8 3.682l-2.8 3-.732-.682 2.8-3 .732.682zM8 4.5H1v-1h7v1z" />
                             </svg>
                           </button>
                         </div>
                         <div className="row">
                           <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col">
                             <div className="_feed_inner_profile_story _b_radious6">
                               <div className="_feed_inner_profile_story_image">
                                 <img src="/assets/images/card_ppl1.png" alt="Image" className="_profile_story_img" />
                                 <div className="_feed_inner_story_txt">
                                   <div className="_feed_inner_story_btn">
                                     <button className="_feed_inner_story_btn_link">
                                       <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 10 10">
                                         <path stroke="#fff" strokeLinecap="round" d="M.5 4.884h9M4.884 9.5v-9" />
                                       </svg>
                                     </button>
                                   </div>
                                   <p className="_feed_inner_story_para">Your Story</p>
                                 </div>
                               </div>
                             </div>
                           </div>
                           <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col">
                             <div className="_feed_inner_public_story _b_radious6">
                               <div className="_feed_inner_public_story_image">
                                 <img src="/assets/images/card_ppl2.png" alt="Image" className="_public_story_img" />
                                 <div className="_feed_inner_pulic_story_txt">
                                   <p className="_feed_inner_pulic_story_para">Ryan Roslansky</p>
                                 </div>
                                 <div className="_feed_inner_public_mini">
                                   <img src="/assets/images/mini_pic.png" alt="Image" className="_public_mini_img" />
                                 </div>
                               </div>
                             </div>
                           </div>
                           <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 _custom_mobile_none">
                             <div className="_feed_inner_public_story _b_radious6">
                               <div className="_feed_inner_public_story_image">
                                 <img src="/assets/images/card_ppl3.png" alt="Image" className="_public_story_img" />
                                 <div className="_feed_inner_pulic_story_txt">
                                   <p className="_feed_inner_pulic_story_para">Ryan Roslansky</p>
                                 </div>
                                 <div className="_feed_inner_public_mini">
                                   <img src="/assets/images/mini_pic.png" alt="Image" className="_public_mini_img" />
                                 </div>
                               </div>
                             </div>
                           </div>
                           <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 _custom_none">
                             <div className="_feed_inner_public_story _b_radious6">
                               <div className="_feed_inner_public_story_image">
                                 <img src="/assets/images/card_ppl4.png" alt="Image" className="_public_story_img" />
                                 <div className="_feed_inner_pulic_story_txt">
                                   <p className="_feed_inner_pulic_story_para">Ryan Roslansky</p>
                                 </div>
                                 <div className="_feed_inner_public_mini">
                                   <img src="/assets/images/mini_pic.png" alt="Image" className="_public_mini_img" />
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
                               <a href="#0" className="_feed_inner_ppl_card_area_link">
                                 <div className="_feed_inner_ppl_card_area_story">
                                   <img src="/assets/images/mobile_story_img.png" alt="Image" className="_card_story_img" />
                                   <div className="_feed_inner_ppl_btn">
                                     <button className="_feed_inner_ppl_btn_link" type="button">
                                       <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 12 12">
                                         <path stroke="#fff" strokeLinecap="round" strokeLinejoin="round" d="M6 2.5v7M2.5 6h7" />
                                       </svg>
                                     </button>
                                   </div>
                                 </div>
                                 <p className="_feed_inner_ppl_card_area_link_txt">Your Story</p>
                               </a>
                             </li>
                             <li className="_feed_inner_ppl_card_area_item">
                               <a href="#0" className="_feed_inner_ppl_card_area_link">
                                 <div className="_feed_inner_ppl_card_area_story_active">
                                   <img src="/assets/images/mobile_story_img1.png" alt="Image" className="_card_story_img1" />
                                 </div>
                                 <p className="_feed_inner_ppl_card_area_txt">Ryan...</p>
                               </a>
                             </li>
                             <li className="_feed_inner_ppl_card_area_item">
                               <a href="#0" className="_feed_inner_ppl_card_area_link">
                                 <div className="_feed_inner_ppl_card_area_story_inactive">
                                   <img src="/assets/images/mobile_story_img2.png" alt="Image" className="_card_story_img1" />
                                 </div>
                                 <p className="_feed_inner_ppl_card_area_txt">Ryan...</p>
                               </a>
                             </li>
                             <li className="_feed_inner_ppl_card_area_item">
                               <a href="#0" className="_feed_inner_ppl_card_area_link">
                                 <div className="_feed_inner_ppl_card_area_story_active">
                                   <img src="/assets/images/mobile_story_img1.png" alt="Image" className="_card_story_img1" />
                                 </div>
                                 <p className="_feed_inner_ppl_card_area_txt">Ryan...</p>
                               </a>
                             </li>
                             <li className="_feed_inner_ppl_card_area_item">
                               <a href="#0" className="_feed_inner_ppl_card_area_link">
                                 <div className="_feed_inner_ppl_card_area_story_inactive">
                                   <img src="/assets/images/mobile_story_img2.png" alt="Image" className="_card_story_img1" />
                                 </div>
                                 <p className="_feed_inner_ppl_card_area_txt">Ryan...</p>
                               </a>
                             </li>
                             <li className="_feed_inner_ppl_card_area_item">
                               <a href="#0" className="_feed_inner_ppl_card_area_link">
                                 <div className="_feed_inner_ppl_card_area_story">
                                   <img src="/assets/images/mobile_story_img.png" alt="Image" className="_card_story_img" />
                                 </div>
                                 <p className="_feed_inner_ppl_card_area_txt">Ryan...</p>
                               </a>
                             </li>
                           </ul>
                         </div>
                       </div>
                       {/*For Mobile End*/}
                       <form onSubmit={handlePostSubmit} className="_feed_inner_text_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
                         <div className="_feed_inner_text_area_box">
                           <div className="_feed_inner_text_area_box_image">
                             <img src="/assets/images/txt_img.png" alt="Image" className="_txt_img" />
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
                             <label className="_feed_textarea_label" htmlFor="floatingTextarea">
                               Write something ...
                               <svg xmlns="http://www.w3.org/2000/svg" width="23" height="24" fill="none" viewBox="0 0 23 24">
                                 <path fill="#666" d="M19.504 19.209c.332 0 .601.289.601.646 0 .326-.226.596-.52.64l-.081.005h-6.276c-.332 0-.602-.289-.602-.645 0-.327.227-.597.52-.64l.082-.006h6.276zM13.4 4.417c1.139-1.223 2.986-1.223 4.125 0l1.182 1.268c1.14 1.223 1.14 3.205 0 4.427L9.82 19.649a2.619 2.619 0 01-1.916.85h-3.64c-.337 0-.61-.298-.6-.66l.09-3.941a3.019 3.019 0 01.794-1.982l8.852-9.5zm-.688 2.562l-7.313 7.85a1.68 1.68 0 00-.441 1.101l-.077 3.278h3.023c.356 0 .698-.133.968-.376l.098-.096 7.35-7.887-3.608-3.87zm3.962-1.65a1.633 1.633 0 00-2.423 0l-.688.737 3.606 3.87.688-.737c.631-.678.666-1.755.105-2.477l-.105-.124-1.183-1.268z" />
                               </svg>
                             </label>
                           </div>
                         </div>

                         {selectedImage && (
                           <div className="mt-2 mb-2 text-muted small px-3 d-flex align-items-center justify-content-between bg-light p-2 rounded">
                             <span>Selected image: <strong>{selectedImage.name}</strong></span>
                             <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setSelectedImage(null)}>Remove</button>
                           </div>
                         )}

                         {/*For Desktop*/}
                         <div className="_feed_inner_text_area_bottom">
                           <div className="_feed_inner_text_area_item">
                             <div className="_feed_inner_text_area_bottom_photo _feed_common">
                               <button type="button" className="_feed_inner_text_area_bottom_photo_link" onClick={() => fileInputRef.current?.click()}>
                                 <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
                                     <path fill="#666" d="M13.916 0c3.109 0 5.18 2.429 5.18 5.914v8.17c0 3.486-2.072 5.916-5.18 5.916H5.999C2.89 20 .827 17.572.827 14.085v-8.17C.827 2.43 2.897 0 6 0h7.917zm0 1.504H5.999c-2.321 0-3.799 1.735-3.799 4.41v8.17c0 2.68 1.472 4.412 3.799 4.412h7.917c2.328 0 3.807-1.734 3.807-4.411v-8.17c0-2.678-1.478-4.411-3.807-4.411zm.65 8.68l.12.125 1.9 2.147a.803.803 0 01-.016 1.063.642.642 0 01-.894.058l-.076-.074-1.9-2.148a.806.806 0 00-1.205-.028l-.074.087-2.04 2.717c-.722.963-2.02 1.066-2.86.26l-.111-.116-.814-.91a.562.562 0 00-.793-.07l-.075.073-1.4 1.617a.645.645 0 01-.97.029.805.805 0 01-.09-.977l.064-.086 1.4-1.617c.736-.852 1.95-.897 2.734-.137l.114.12.81.905a.587.587 0 00.861.033l.07-.078 2.04-2.718c.81-1.08 2.27-1.19 3.205-.275zM6.831 4.64c1.265 0 2.292 1.125 2.292 2.51 0 1.386-1.027 2.511-2.292 2.511S4.54 8.537 4.54 7.152c0-1.386 1.026-2.51 2.291-2.51zm0 1.504c-.507 0-.918.451-.918 1.007 0 .555.411 1.006.918 1.006.507 0 .919-.451.919-1.006 0-.556-.412-1.007-.919-1.007z" />
                                   </svg>
                                 </span>
                                 Photo
                               </button>
                             </div>
                             <div className="_feed_inner_text_area_bottom_video _feed_common">
                               <button type="button" className="_feed_inner_text_area_bottom_photo_link">
                                 <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                                     <path fill="#666" d="M11.485 4.5c2.213 0 3.753 1.534 3.917 3.784l2.418-1.082c1.047-.468 2.188.327 2.271 1.533l.005.141v6.64c0 1.237-1.103 2.093-2.155 1.72l-.121-.047-2.418-1.083c-.164 2.25-1.708 3.785-3.917 3.785H5.76c-2.343 0-3.932-1.72-3.932-4.188V8.688c0-2.47 1.589-4.188 3.932-4.188h5.726zm0 1.5H5.76C4.169 6 3.197 7.05 3.197 8.688v7.015c0 1.636.972 2.688 2.562 2.688h5.726c1.586 0 2.562-1.054 2.562-2.688v-.686-6.329c0-1.636-.973-2.688-2.562-2.688zM18.4 8.57l-.062.02-2.921 1.306v4.596l2.921 1.307c.165.073.343-.036.38-.215l.008-.07V8.876c0-.195-.16-.334-.326-.305z" />
                                   </svg>
                                 </span>
                                 Video
                               </button>
                             </div>
                             <div className="_feed_inner_text_area_bottom_event _feed_common">
                               <button type="button" className="_feed_inner_text_area_bottom_photo_link">
                                 <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                                     <path fill="#666" d="M14.371 2c.32 0 .585.262.627.603l.005.095v.788c2.598.195 4.188 2.033 4.18 5v8.488c0 3.145-1.786 5.026-4.656 5.026H7.395C4.53 22 2.74 20.087 2.74 16.904V8.486c0-2.966 1.596-4.804 4.187-5v-.788c0-.386.283-.698.633-.698.32 0 .584.262.626.603l.006.095v.771h5.546v-.771c0-.386.284-.698.633-.698zm3.546 8.283H4.004l.001 6.621c0 2.325 1.137 3.616 3.183 3.697l.207.004h7.132c2.184 0 3.39-1.271 3.39-3.63v-6.692zm-3.202 5.853c.349 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.237-.645.546-.692l.094-.006zm-3.742 0c.35 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.238-.645.546-.692l.094-.006zm-3.75 0c.35 0 .633.312.633.698 0 .353-.238.645-.547.691l-.093.006c-.35 0-.633-.312-.633-.697 0-.354.238-.645.547-.692l.094-.006zm7.492-3.615c.349 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.237-.645.546-.691l.094-.006zm-3.742 0c.35 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.238-.645.546-.691l.094-.006zm-3.75 0c.35 0 .633.312.633.697 0 .354-.238.645-.547.692l-.093.006c-.35 0-.633-.312-.633-.698 0-.353.238-.645.547-.691l.094-.006zm6.515-7.657H8.192v.895c0 .385-.283.698-.633.698-.32 0-.584-.263-.626-.603l-.006-.095v-.874c-1.886.173-2.922 1.422-2.922 3.6v.402h13.912v-.403c.007-2.181-1.024-3.427-2.914-3.599v.874c0 .385-.283.698-.632.698-.32 0-.585-.263-.627-.603l-.005-.095v-.895z" />
                                   </svg>
                                 </span>
                                 Event
                               </button>
                             </div>
                             <div className="_feed_inner_text_area_bottom_article _feed_common">
                               <button type="button" className="_feed_inner_text_area_bottom_photo_link">
                                 <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="20" fill="none" viewBox="0 0 18 20">
                                     <path fill="#666" d="M12.49 0c2.92 0 4.665 1.92 4.693 5.132v9.659c0 3.257-1.75 5.209-4.693 5.209H5.434c-.377 0-.734-.032-1.07-.095l-.2-.041C2 19.371.74 17.555.74 14.791V5.209c0-.334.019-.654.055-.96C1.114 1.564 2.799 0 5.434 0h7.056zm-.008 1.457H5.434c-2.244 0-3.381 1.263-3.381 3.752v9.582c0 2.489 1.137 3.752 3.38 3.752h7.049c2.242 0 3.372-1.263 3.372-3.752V5.209c0-2.489-1.13-3.752-3.372-3.752zm-.239 12.053c.36 0 .652.324.652.724 0 .4-.292.724-.652.724H5.656c-.36 0-.652-.324-.652-.724 0-.4.293-.724.652-.724h6.587zm0-4.239a.643.643 0 01.632.339.806.806 0 010 .78.643.643 0 01-.632.339H5.656c-.334-.042-.587-.355-.587-.729s.253-.688.587-.729h6.587zM8.17 5.042c.335.041.588.355.588.729 0 .373-.253.687-.588.728H5.665c-.336-.041-.589-.355-.589-.728 0-.374.253-.688.589-.729H8.17z" />
                                   </svg>
                                 </span>
                                 Article
                               </button>
                             </div>
                           </div>
                           <div className="_feed_inner_text_area_btn">
                             <button type="submit" className="_feed_inner_text_area_btn_link">
                               <svg className="_mar_img" xmlns="http://www.w3.org/2000/svg" width="14" height="13" fill="none" viewBox="0 0 14 13">
                                 <path fill="#fff" fillRule="evenodd" d="M6.37 7.879l2.438 3.955a.335.335 0 00.34.162c.068-.01.23-.05.289-.247l3.049-10.297a.348.348 0 00-.09-.35.341.341 0 00-.34-.088L1.75 4.03a.34.34 0 00-.247.289.343.343 0 00.16.347L5.666 7.17 9.2 3.597a.5.5 0 01.712.703L6.37 7.88zM9.097 13c-.464 0-.89-.236-1.14-.641L5.372 8.165l-4.237-2.65a1.336 1.336 0 01-.622-1.331c.074-.536.441-.96.957-1.112L11.774.054a1.347 1.347 0 011.67 1.682l-3.05 10.296A1.332 1.332 0 019.098 13z" clipRule="evenodd" />
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
                                 <button type="button" className="_feed_inner_text_area_bottom_photo_link" onClick={() => fileInputRef.current?.click()}>
                                   <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
                                       <path fill="#666" d="M13.916 0c3.109 0 5.18 2.429 5.18 5.914v8.17c0 3.486-2.072 5.916-5.18 5.916H5.999C2.89 20 .827 17.572.827 14.085v-8.17C.827 2.43 2.897 0 6 0h7.917zm0 1.504H5.999c-2.321 0-3.799 1.735-3.799 4.41v8.17c0 2.68 1.472 4.412 3.799 4.412h7.917c2.328 0 3.807-1.734 3.807-4.411v-8.17c0-2.678-1.478-4.411-3.807-4.411zm.65 8.68l.12.125 1.9 2.147a.803.803 0 01-.016 1.063.642.642 0 01-.894.058l-.076-.074-1.9-2.148a.806.806 0 00-1.205-.028l-.074.087-2.04 2.717c-.722.963-2.02 1.066-2.86.26l-.111-.116-.814-.91a.562.562 0 00-.793-.07l-.075.073-1.4 1.617a.645.645 0 01-.97.029.805.805 0 01-.09-.977l.064-.086 1.4-1.617c.736-.852 1.95-.897 2.734-.137l.114.12.81.905a.587.587 0 00.861.033l.07-.078 2.04-2.718c.81-1.08 2.27-1.19 3.205-.275zM6.831 4.64c1.265 0 2.292 1.125 2.292 2.51 0 1.386-1.027 2.511-2.292 2.511S4.54 8.537 4.54 7.152c0-1.386 1.026-2.51 2.291-2.51zm0 1.504c-.507 0-.918.451-.918 1.007 0 .555.411 1.006.918 1.006.507 0 .919-.451.919-1.006 0-.556-.412-1.007-.919-1.007z" />
                                     </svg>
                                   </span>
                                 </button>
                               </div>
                               <div className="_feed_inner_text_area_bottom_video _feed_common">
                                 <button type="button" className="_feed_inner_text_area_bottom_photo_link">
                                   <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                                       <path fill="#666" d="M11.485 4.5c2.213 0 3.753 1.534 3.917 3.784l2.418-1.082c1.047-.468 2.188.327 2.271 1.533l.005.141v6.64c0 1.237-1.103 2.093-2.155 1.72l-.121-.047-2.418-1.083c-.164 2.25-1.708 3.785-3.917 3.785H5.76c-2.343 0-3.932-1.72-3.932-4.188V8.688c0-2.47 1.589-4.188 3.932-4.188h5.726zm0 1.5H5.76C4.169 6 3.197 7.05 3.197 8.688v7.015c0 1.636.972 2.688 2.562 2.688h5.726c1.586 0 2.562-1.054 2.562-2.688v-.686-6.329c0-1.636-.973-2.688-2.562-2.688zM18.4 8.57l-.062.02-2.921 1.306v4.596l2.921 1.307c.165.073.343-.036.38-.215l.008-.07V8.876c0-.195-.16-.334-.326-.305z" />
                                     </svg>
                                   </span>
                                 </button>
                               </div>
                               <div className="_feed_inner_text_area_bottom_event _feed_common">
                                 <button type="button" className="_feed_inner_text_area_bottom_photo_link">
                                   <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                                       <path fill="#666" d="M14.371 2c.32 0 .585.262.627.603l.005.095v.788c2.598.195 4.188 2.033 4.18 5v8.488c0 3.145-1.786 5.026-4.656 5.026H7.395C4.53 22 2.74 20.087 2.74 16.904V8.486c0-2.966 1.596-4.804 4.187-5v-.788c0-.386.283-.698.633-.698.32 0 .584.262.626.603l.006.095v.771h5.546v-.771c0-.386.284-.698.633-.698zm3.546 8.283H4.004l.001 6.621c0 2.325 1.137 3.616 3.183 3.697l.207.004h7.132c2.184 0 3.39-1.271 3.39-3.63v-6.692zm-3.202 5.853c.349 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.237-.645.546-.692l.094-.006zm-3.742 0c.35 0 .632.312.632.698 0 .353-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.238-.645.546-.692l.094-.006zm-3.75 0c.35 0 .633.312.633.698 0 .353-.238.645-.547.691l-.093.006c-.35 0-.633-.312-.633-.697 0-.354.238-.645.547-.692l.094-.006zm7.492-3.615c.349 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.237-.645.546-.691l.094-.006zm-3.742 0c.35 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.238-.645.546-.691l.094-.006zm-3.75 0c.35 0 .633.312.633.697 0 .354-.238.645-.547.692l-.093.006c-.35 0-.633-.312-.633-.698 0-.353.238-.645.547-.691l.094-.006zm6.515-7.657H8.192v.895c0 .385-.283.698-.633.698-.32 0-.584-.263-.626-.603l-.006-.095v-.874c-1.886.173-2.922 1.422-2.922 3.6v.402h13.912v-.403c.007-2.181-1.024-3.427-2.914-3.599v.874c0 .385-.283.698-.632.698-.32 0-.585-.263-.627-.603l-.005-.095v-.895z" />
                                     </svg>
                                   </span>
                                 </button>
                               </div>
                               <div className="_feed_inner_text_area_bottom_article _feed_common">
                                 <button type="button" className="_feed_inner_text_area_bottom_photo_link">
                                   <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="20" fill="none" viewBox="0 0 18 20">
                                       <path fill="#666" d="M12.49 0c2.92 0 4.665 1.92 4.693 5.132v9.659c0 3.257-1.75 5.209-4.693 5.209H5.434c-.377 0-.734-.032-1.07-.095l-.2-.041C2 19.371.74 17.555.74 14.791V5.209c0-.334.019-.654.055-.96C1.114 1.564 2.799 0 5.434 0h7.056zm-.008 1.457H5.434c-2.244 0-3.381 1.263-3.381 3.752v9.582c0 2.489 1.137 3.752 3.38 3.752h7.049c2.242 0 3.372-1.263 3.372-3.752V5.209c0-2.489-1.13-3.752-3.372-3.752zm-.239 12.053c.36 0 .652.324.652.724 0 .4-.292.724-.652.724H5.656c-.36 0-.652-.324-.652-.724 0-.4.293-.724.652-.724h6.587zm0-4.239a.643.643 0 01.632.339.806.806 0 010 .78.643.643 0 01-.632.339H5.656c-.334-.042-.587-.355-.587-.729s.253-.688.587-.729h6.587zM8.17 5.042c.335.041.588.355.588.729 0 .373-.253.687-.588.728H5.665c-.336-.041-.589-.355-.589-.728 0-.374.253-.688.589-.729H8.17z" />
                                     </svg>
                                   </span>
                                 </button>
                               </div>
                             </div>
                             <div className="_feed_inner_text_area_btn">
                              <button type="submit" className="_feed_inner_text_area_btn_link">
                                <svg className="_mar_img" xmlns="http://www.w3.org/2000/svg" width="14" height="13" fill="none" viewBox="0 0 14 13">
                                  <path fill="#fff" fillRule="evenodd" d="M6.37 7.879l2.438 3.955a.335.335 0 00.34.162c.068-.01.23-.05.289-.247l3.049-10.297a.348.348 0 00-.09-.35.341.341 0 00-.34-.088L1.75 4.03a.34.34 0 00-.247.289.343.343 0 00.16.347L5.666 7.17 9.2 3.597a.5.5 0 01.712.703L6.37 7.88zM9.097 13c-.464 0-.89-.236-1.14-.641L5.372 8.165l-4.237-2.65a1.336 1.336 0 01-.622-1.331c.074-.536.441-.96.957-1.112L11.774.054a1.347 1.347 0 011.67 1.682l-3.05 10.296A1.332 1.332 0 019.098 13z" clipRule="evenodd" />
                                </svg>
                                <span>Post</span>
                              </button>
                            </div>
                           </div>
                          </div>
                          {/*For Mobile*/}
                        </form>

                      {/* Loading State */}
                      {loading && (
                        <div className="text-center p-5">
                          <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading feed...</span>
                          </div>
                        </div>
                      )}

                      {/* Feed Posts List */}
                      {!loading && posts.length === 0 && (
                        <div className="text-center p-5 bg-white rounded shadow-sm">
                          <p className="text-muted">No posts available. Be the first to create one!</p>
                        </div>
                      )}

                      {!loading && posts.map((post) => {
                        const hasLiked = post.likes.some((l) => l.userId === user?.id);
                        const isOwner = post.userId === user?.id;

                        return (
                          <div key={post.id} className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
                            <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
                              <div className="_feed_inner_timeline_post_top d-flex justify-content-between align-items-center">
                                <div className="_feed_inner_timeline_post_box">
                                  <div className="_feed_inner_timeline_post_box_image">
                                    <img src="/assets/images/post_img.png" alt="" className="_post_img" />
                                  </div>
                                  <div className="_feed_inner_timeline_post_box_txt">
                                    <h4 className="_feed_inner_timeline_post_box_title">
                                      {post.user ? `${post.user.firstName} ${post.user.lastName}` : "User"}
                                    </h4>
                                    <p className="_feed_inner_timeline_post_box_para">
                                      {new Date(post.createdAt).toLocaleDateString()} .{" "}
                                      <span className="badge bg-light text-dark">
                                        {post.visibility === "PUBLIC" ? "🌍 Public" : "🔒 Private"}
                                      </span>
                                    </p>
                                  </div>
                                </div>

                                {isOwner && (
                                  <button
                                    onClick={() => handleDeletePost(post.id)}
                                    className="btn btn-sm btn-outline-danger"
                                    style={{ borderRadius: "50%", width: "32px", height: "32px", padding: 0 }}
                                    title="Delete post"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {post.content && (
                                <h4 className="_feed_inner_timeline_post_title mt-3" style={{ fontSize: "16px", fontWeight: "normal" }}>
                                  {post.content}
                                </h4>
                              )}

                              {post.imageUrl && (
                                <div className="_feed_inner_timeline_image mt-3">
                                  <img src={post.imageUrl} alt="Post Attachment" className="_time_img" style={{ maxHeight: "400px", objectFit: "cover", width: "100%", borderRadius: "8px" }} />
                                </div>
                              )}
                            </div>

                            <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26 mt-3">
                              <div className="_feed_inner_timeline_total_reacts_image d-flex align-items-center gap-1">
                                <span className="text-primary font-weight-bold" style={{ fontSize: "14px" }}>
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
                                <form onSubmit={(e) => handleCommentSubmit(post.id, e)} className="_feed_inner_comment_box_form">
                                  <div className="_feed_inner_comment_box_content">
                                    <div className="_feed_inner_comment_box_content_image">
                                      <img src="/assets/images/comment_img.png" alt="" className="_comment_img" />
                                    </div>
                                    <div className="_feed_inner_comment_box_content_txt">
                                      <textarea
                                        className="form-control _comment_textarea"
                                        placeholder="Write a comment..."
                                        rows={1}
                                        value={commentInputs[post.id] || ""}
                                        onChange={(e) =>
                                          setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                                        }
                                      ></textarea>
                                    </div>
                                  </div>
                                  <div className="_feed_inner_comment_box_icon">
                                    <button type="submit" className="btn btn-sm btn-primary px-3 text-white" style={{ borderRadius: "10px" }}>
                                      Send
                                    </button>
                                  </div>
                                </form>
                              </div>

                              {/* Comments List */}
                              <div className="_timline_comment_main mt-2">
                                {post.comments.map((comment) => {
                                  const hasLikedComment = comment.likes?.some((l) => l.userId === user?.id) ?? false;
                                  return (
                                    <div key={comment.id} className="mb-3 border-bottom pb-2">
                                      <div className="_comment_main d-flex gap-2">
                                        <div className="_comment_image">
                                          <img src="/assets/images/txt_img.png" alt="" className="_comment_img1" />
                                        </div>
                                        <div className="_comment_area flex-grow-1">
                                          <div className="_comment_details bg-light p-2 rounded">
                                            <div className="_comment_details_top">
                                              <div className="_comment_name">
                                                <h4 className="_comment_name_title" style={{ fontSize: "14px", fontWeight: "bold" }}>
                                                  {formatUserName(comment.user)}
                                                </h4>
                                              </div>
                                            </div>
                                            <div className="_comment_status mt-1">
                                              <p className="_comment_status_text" style={{ fontSize: "14px", margin: 0 }}>
                                                {comment.content}
                                              </p>
                                            </div>
                                          </div>

                                          <div className="_comment_reply mt-1">
                                            <div className="_comment_reply_num">
                                              <ul className="_comment_reply_list d-flex gap-3 list-unstyled mb-0" style={{ fontSize: "12px" }}>
                                                <li onClick={() => handleLikeComment(post.id, comment.id)} style={{ cursor: "pointer" }} className="text-primary">
                                                  <span>👍 {hasLikedComment ? "Liked" : "Like"} ({comment.likes?.length || 0})</span>
                                                </li>
                                                <li
                                                  onClick={() => setActiveReplyCommentId(activeReplyCommentId === comment.id ? null : comment.id)}
                                                  style={{ cursor: "pointer" }}
                                                  className="text-primary"
                                                >
                                                  <span>Reply</span>
                                                </li>
                                                <li className="text-muted">
                                                  <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                                                </li>
                                              </ul>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Replies List */}
                                      {comment.replies && comment.replies.length > 0 && (
                                        <div className="ms-5 mt-2 pl-3 border-left">
                                          {comment.replies.map((reply) => {
                                            const hasLikedReply = reply.likes?.some((l) => l.userId === user?.id) ?? false;
                                            return (
                                              <div key={reply.id} className="d-flex gap-2 mt-2 bg-light p-2 rounded" style={{ marginLeft: "10px" }}>
                                                <div className="_comment_image">
                                                  <img src="/assets/images/comment_img.png" alt="" className="_comment_img1" style={{ width: "24px", height: "24px" }} />
                                                </div>
                                                <div className="flex-grow-1">
                                                  <h5 style={{ fontSize: "12px", fontWeight: "bold", margin: 0 }}>
                                                    {formatUserName(reply.user)}
                                                  </h5>
                                                  <p style={{ fontSize: "13px", margin: "2px 0 4px 0" }}>{reply.content}</p>
                                                  <div className="d-flex gap-3 align-items-center" style={{ fontSize: "11px" }}>
                                                    <span onClick={() => handleLikeReply(post.id, comment.id, reply.id)} className="text-primary" style={{ cursor: "pointer" }}>
                                                      👍 {hasLikedReply ? "Liked" : "Like"} ({reply.likes?.length || 0})
                                                    </span>
                                                    <span className="text-muted">{new Date(reply.createdAt).toLocaleDateString()}</span>
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
                                          <form onSubmit={(e) => handleReplySubmit(comment.id, e)} className="d-flex gap-2 align-items-center">
                                            <input
                                              type="text"
                                              className="form-control form-control-sm"
                                              placeholder="Write a reply..."
                                              value={replyInputs[comment.id] || ""}
                                              onChange={(e) =>
                                                setReplyInputs((prev) => ({ ...prev, [comment.id]: e.target.value }))
                                              }
                                            />
                                            <button type="submit" className="btn btn-sm btn-primary text-white">Reply</button>
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
                  </div>
                </div>
                {/* Layout Middle End */}

                {/* Right Sidebar */}
                <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                  <div className="_layout_right_sidebar_wrap">
                    <div className="_layout_right_sidebar_inner">
                      <div className="_right_inner_area_info _padd_t24 _padd_b24 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                        <div className="_right_inner_area_info_content _mar_b24">
                          <h4 className="_right_inner_area_info_content_title _title5">You Might Like</h4>
                        </div>
                        <hr className="_underline" />
                        <div className="_right_inner_area_info_ppl">
                          <div className="_right_inner_area_info_box">
                            <div className="_right_inner_area_info_box_image">
                              <a href="#0">
                                <img src="/assets/images/Avatar.png" alt="Image" className="_ppl_img" />
                              </a>
                            </div>
                            <div className="_right_inner_area_info_box_txt">
                              <a href="#0">
                                <h4 className="_right_inner_area_info_box_title">Radovan SkillArena</h4>
                              </a>
                              <p className="_right_inner_area_info_box_para">Founder & CEO at Trophy</p>
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
    </>
  );
}
