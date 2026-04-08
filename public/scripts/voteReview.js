async function voteReview(reviewId, type) {
  const likeBtn = document.querySelector(`[data-review-id="${reviewId}"][data-vote-type="like"]`);
  const dislikeBtn = document.querySelector(`[data-review-id="${reviewId}"][data-vote-type="dislike"]`);

  const isLike = type === "like";
  const targetBtn = isLike ? likeBtn : dislikeBtn;
  const oppositeBtn = isLike ? dislikeBtn : likeBtn;

  const isActive = targetBtn?.classList.contains("active");

  try {
    const response = await fetch(`/reviews/${reviewId}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ type: isActive ? "remove" : type })
    });

    const result = await response.json();

    if (response.ok) {
      targetBtn?.classList.toggle("active", !isActive);
      oppositeBtn?.classList.remove("active");
      location.reload();
    } else {
      alert(result.message || "Failed to vote.");
    }
  } catch (err) {
    console.error("Vote failed", err);
    alert("Something went wrong while voting.");
  }
}