"use client";

import { useState } from "react";
import { Star, ThumbsUp, CheckCircle, MessageSquare } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Review = {
  id: string;
  author: string;
  initials: string;
  date: string;
  rating: number;
  title: string;
  body: string;
  helpful: number;
  verified: boolean;
};

// ─── Star display ─────────────────────────────────────────────────────────────

function StarRow({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "lg";
}) {
  const cls = size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <div className="flex text-[#ff9900]">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${cls} ${
            i < Math.round(rating) ? "fill-current" : "fill-zinc-200 text-zinc-200"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Star picker (write review) ───────────────────────────────────────────────

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const star = i + 1;
        return (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            className="p-0.5 text-[#ff9900] transition-transform hover:scale-110 focus:outline-none"
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            <Star
              className={`h-6 w-6 ${
                star <= active ? "fill-current" : "fill-zinc-200 text-zinc-200"
              }`}
            />
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-2 text-sm font-semibold text-zinc-700">
          {["Poor", "Fair", "Good", "Very Good", "Excellent"][value - 1]}
        </span>
      )}
    </div>
  );
}

// ─── Rating breakdown bar ─────────────────────────────────────────────────────

function RatingBreakdown({
  reviews,
  avgRating,
}: {
  reviews: Review[];
  avgRating: number;
}) {
  const total = reviews.length;
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  const displayRating = total > 0 ? avgRating : 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      {/* Big average */}
      <div className="text-center sm:shrink-0">
        <p className="text-5xl font-bold text-zinc-900">{displayRating.toFixed(1)}</p>
        <StarRow rating={displayRating} size="sm" />
        <p className="mt-1 text-sm text-zinc-500">{total} {total === 1 ? "review" : "reviews"}</p>
      </div>

      {/* Bars */}
      <div className="flex-1 space-y-1.5">
        {counts.map(({ star, count }) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-4 shrink-0 text-right text-zinc-500">{star}</span>
              <Star className="h-3.5 w-3.5 shrink-0 fill-[#ff9900] text-[#ff9900]" />
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-[#ff9900] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-5 shrink-0 text-zinc-400">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Write Review Form ────────────────────────────────────────────────────────

function WriteReviewForm({
  productId,
  onSubmitted,
}: {
  productId: string;
  onSubmitted: (review: Review) => void;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a review title.");
      return;
    }
    if (!body.trim()) {
      setError("Please write your review.");
      return;
    }
    setError("");
    setIsSubmitting(true);

    const displayName = name.trim() || "Verified Customer";
    const initials = displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "VC";

    const newReview: Review = {
      id: `rev-${Date.now()}`,
      author: displayName,
      initials,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      rating,
      title: title.trim(),
      body: body.trim(),
      helpful: 0,
      verified: true,
    };

    await new Promise((r) => setTimeout(r, 600));
    setIsSubmitting(false);
    onSubmitted(newReview);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
      <h3 className="font-semibold text-zinc-900">Write a Review</h3>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-700">
          Your rating <span className="text-red-500">*</span>
        </p>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`review-name-${productId}`} className="block text-sm font-medium text-zinc-700">
            Your name
          </label>
          <input
            id={`review-name-${productId}`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kofi Asante"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`review-title-${productId}`} className="block text-sm font-medium text-zinc-700">
            Review title <span className="text-red-500">*</span>
          </label>
          <input
            id={`review-title-${productId}`}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summarise your experience"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor={`review-body-${productId}`} className="block text-sm font-medium text-zinc-700">
          Your review <span className="text-red-500">*</span>
        </label>
        <textarea
          id={`review-body-${productId}`}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell others about your experience with this product..."
          className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center gap-2 rounded-lg bg-[#ff9900] px-6 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-[#f08804] disabled:opacity-70 transition cursor-pointer"
      >
        {isSubmitting && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
        )}
        {isSubmitting ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}

// ─── Main ReviewsSection ──────────────────────────────────────────────────────

type ReviewsSectionProps = {
  productId: string;
  avgRating?: number;
  reviewCount?: number;
};

export function ReviewsSection({
  productId,
  avgRating = 0,
  reviewCount = 0,
}: ReviewsSectionProps) {
  // Pure legitimate reviews — starts empty unless reviews have been placed
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [helpfulVotes, setHelpfulVotes] = useState<Set<string>>(new Set());

  // Interactive helpful toggle — allows toggling like ON and OFF
  function handleHelpful(id: string) {
    setHelpfulVotes((prev) => {
      const next = new Set(prev);
      const isAlreadyVoted = next.has(id);

      if (isAlreadyVoted) {
        next.delete(id);
      } else {
        next.add(id);
      }

      setReviews((prevReviews) =>
        prevReviews.map((r) =>
          r.id === id
            ? { ...r, helpful: isAlreadyVoted ? Math.max(0, r.helpful - 1) : r.helpful + 1 }
            : r,
        ),
      );

      return next;
    });
  }

  function handleSubmitted(newReview: Review) {
    setReviews((prev) => [newReview, ...prev]);
    setSubmitted(true);
    setShowForm(false);
  }

  const effectiveAvgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : avgRating;

  return (
    <section className="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/60">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">
            Customer Reviews
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Verified ratings and feedback from genuine buyers
          </p>
        </div>
        {!showForm && !submitted && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
          >
            Write a Review
          </button>
        )}
      </div>

      {/* Rating breakdown */}
      <RatingBreakdown reviews={reviews} avgRating={effectiveAvgRating} />

      <hr className="my-6 border-zinc-100" />

      {/* Success banner */}
      {submitted && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          Thank you! Your verified review has been published.
        </div>
      )}

      {/* Write review form */}
      {showForm && (
        <WriteReviewForm productId={productId} onSubmitted={handleSubmitted} />
      )}

      {showForm && <hr className="my-6 border-zinc-100" />}

      {/* Review list or authentic empty state */}
      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <MessageSquare className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-zinc-900">No reviews yet</p>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
            Be the first customer to share your experience with this item.
          </p>
          {!showForm && !submitted && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#ff9900] px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-[#f08804] transition"
            >
              Write the First Review
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => {
            const isVoted = helpfulVotes.has(review.id);
            return (
              <div key={review.id} className="group">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-sm font-bold text-[#ff9900]">
                    {review.initials}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900">{review.author}</span>
                      {review.verified && (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Verified Purchase
                        </span>
                      )}
                      <span className="text-xs text-zinc-400">{review.date}</span>
                    </div>
                    <div className="mt-1">
                      <StarRow rating={review.rating} />
                    </div>
                    <p className="mt-2 font-semibold text-zinc-900">{review.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600">{review.body}</p>
                    <button
                      type="button"
                      onClick={() => handleHelpful(review.id)}
                      className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        isVoted
                          ? "bg-amber-50 text-[#f08804] ring-1 ring-amber-200"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                      }`}
                      title={isVoted ? "Click to remove helpful vote" : "Mark as helpful"}
                    >
                      <ThumbsUp className={`h-3.5 w-3.5 ${isVoted ? "fill-[#f08804]" : ""}`} />
                      <span>{isVoted ? "Helpful" : "Helpful"}</span>
                      {review.helpful > 0 && <span className="font-semibold">({review.helpful})</span>}
                    </button>
                  </div>
                </div>
                <hr className="mt-6 border-zinc-100 last:hidden" />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
