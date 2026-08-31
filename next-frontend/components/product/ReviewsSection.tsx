"use client";

import { useState } from "react";
import { Star, ThumbsUp, CheckCircle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Review = {
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

// ─── Mock reviews generator (stable per productId) ───────────────────────────

function generateMockReviews(productId: string): Review[] {
  // Use productId as seed so reviews are consistent for the same product
  const seed = productId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const getRating = (i: number) => Math.max(3, ((seed + i * 7) % 3) + 3); // 3-5

  return [
    {
      id: `${productId}-r1`,
      author: "Kofi A.",
      initials: "KA",
      date: "Aug 18, 2026",
      rating: getRating(0),
      title: "Exactly as described — very happy!",
      body: "Ordered this and it arrived within 2 days. The quality is great, exactly what I expected from the product description. Would definitely recommend to others.",
      helpful: 12,
      verified: true,
    },
    {
      id: `${productId}-r2`,
      author: "Ama O.",
      initials: "AO",
      date: "Aug 10, 2026",
      rating: getRating(1),
      title: "Good value for money",
      body: "I was hesitant to order at first but the price was very competitive. The product works as expected. Delivery was fast and the packaging was secure.",
      helpful: 8,
      verified: true,
    },
    {
      id: `${productId}-r3`,
      author: "Nana K.",
      initials: "NK",
      date: "Jul 29, 2026",
      rating: getRating(2),
      title: "Quality is top notch",
      body: "Really impressed with the build quality. Feels premium and looks great. The NextDor team was also very responsive when I had a question before purchasing.",
      helpful: 5,
      verified: false,
    },
    {
      id: `${productId}-r4`,
      author: "Abena M.",
      initials: "AM",
      date: "Jul 15, 2026",
      rating: 5,
      title: "Best purchase this month!",
      body: "I bought this as a gift and the recipient absolutely loved it. Will be shopping here again. 5 stars for the product and the delivery experience.",
      helpful: 21,
      verified: true,
    },
  ];
}

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
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${star} star`}
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              star <= (hover || value)
                ? "fill-[#ff9900] text-[#ff9900]"
                : "fill-zinc-200 text-zinc-200"
            }`}
          />
        </button>
      ))}
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

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      {/* Big average */}
      <div className="text-center sm:shrink-0">
        <p className="text-5xl font-bold text-zinc-900">{avgRating.toFixed(1)}</p>
        <StarRow rating={avgRating} size="sm" />
        <p className="mt-1 text-sm text-zinc-500">{total} reviews</p>
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
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Please select a star rating."); return; }
    if (!title.trim()) { setError("Please enter a review title."); return; }
    if (!body.trim()) { setError("Please write your review."); return; }
    setError("");
    setIsSubmitting(true);
    // Stub — replace with POST /api/reviews when backend ready
    await new Promise((r) => setTimeout(r, 900));
    setIsSubmitting(false);
    onSubmitted();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
      <h3 className="font-semibold text-zinc-900">Write a Review</h3>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-700">Your rating <span className="text-red-500">*</span></p>
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
            placeholder="Kofi Asante"
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
        className="flex items-center gap-2 rounded-lg bg-[#ff9900] px-6 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-[#f08804] disabled:opacity-70"
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
  avgRating: number;
  reviewCount: number;
};

export function ReviewsSection({
  productId,
  avgRating,
  reviewCount,
}: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>(() =>
    generateMockReviews(productId),
  );
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [helpfulVotes, setHelpfulVotes] = useState<Set<string>>(new Set());

  function handleHelpful(id: string, current: number) {
    if (helpfulVotes.has(id)) return;
    setHelpfulVotes((prev) => new Set(prev).add(id));
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, helpful: r.helpful + 1 } : r)),
    );
  }

  function handleSubmitted() {
    setSubmitted(true);
    setShowForm(false);
  }

  return (
    <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-zinc-900">
          Customer Reviews
        </h2>
        {!showForm && !submitted && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Write a Review
          </button>
        )}
      </div>

      {/* Rating breakdown */}
      <RatingBreakdown reviews={reviews} avgRating={avgRating || 4.2} />

      <hr className="my-6 border-zinc-100" />

      {/* Success banner */}
      {submitted && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle className="h-5 w-5 shrink-0" />
          Thank you! Your review has been submitted for moderation.
        </div>
      )}

      {/* Write review form */}
      {showForm && (
        <WriteReviewForm productId={productId} onSubmitted={handleSubmitted} />
      )}

      <hr className="my-6 border-zinc-100" />

      {/* Review cards */}
      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review.id} className="group">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-sm font-bold text-[#ff9900]">
                {review.initials}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900">{review.author}</span>
                  {review.verified && (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-600">
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
                  onClick={() => handleHelpful(review.id, review.helpful)}
                  className={`mt-3 flex items-center gap-1.5 text-xs transition-colors ${
                    helpfulVotes.has(review.id)
                      ? "text-[#ff9900]"
                      : "text-zinc-400 hover:text-zinc-700"
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Helpful ({review.helpful})
                </button>
              </div>
            </div>
            <hr className="mt-6 border-zinc-100 last:hidden" />
          </div>
        ))}
      </div>
    </section>
  );
}
