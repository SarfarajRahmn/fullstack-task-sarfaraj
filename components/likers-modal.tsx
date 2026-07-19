"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface Liker {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
}

interface LikersModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "post" | "comment" | "reply";
  entityId: string;
}

function formatLikerName(liker: Liker) {
  const fullName = `${liker.firstName || ""} ${liker.lastName || ""}`.trim();
  return fullName || liker.name || "User";
}

export default function LikersModal({
  isOpen,
  onClose,
  type,
  entityId,
}: LikersModalProps) {
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadLikers() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/likers?type=${encodeURIComponent(type)}&id=${encodeURIComponent(entityId)}`,
        );
        if (!res.ok) throw new Error("Failed to load likers");
        const data = await res.json();
        if (!cancelled) {
          setLikers(data.likers ?? []);
        }
      } catch {
        if (!cancelled) {
          setLikers([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLikers();

    return () => {
      cancelled = true;
    };
  }, [isOpen, type, entityId]);

  if (!isOpen) return null;

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Liked by</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            {loading ? (
              <div className="text-center p-4">
                <div
                  className="spinner-border text-primary"
                  role="status"
                >
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : likers.length === 0 ? (
              <p className="text-muted text-center">No likes yet.</p>
            ) : (
              <ul className="list-group list-group-flush">
                {likers.map((liker) => (
                  <li
                    key={liker.id}
                    className="list-group-item d-flex align-items-center gap-3"
                  >
                    <Image
                      src={
                        liker.image ||
                        "/assets/images/profile.png"
                      }
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-circle"
                      style={{ objectFit: "cover" }}
                    />
                    <span className="fw-medium">
                      {formatLikerName(liker)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
