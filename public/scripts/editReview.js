document.addEventListener("DOMContentLoaded", function () {
  // Handle opening of any edit modal dynamically
  $('[id^="editReviewModal-"]').on('show.bs.modal', function (event) {
    const button = event.relatedTarget;

    const reviewId = button.getAttribute("data-review-id");
    const reviewText = button.getAttribute("data-review-text");
    const reviewRating = button.getAttribute("data-review-rating");

    const form = document.getElementById(`editReviewForm-${reviewId}`);
    form.dataset.reviewId = reviewId;

    document.getElementById(`editReviewbox-${reviewId}`).value = reviewText;
    document.getElementById(`editReviewRating-${reviewId}`).value = reviewRating;

    // Attach submit handler for this form
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const reviewText = document.getElementById(`editReviewbox-${reviewId}`).value.trim();
      const rating = document.getElementById(`editReviewRating-${reviewId}`).value;

      if (!reviewText || !reviewId) {
        alert("Review content or ID is missing.");
        return;
      }

      try {
        const response = await fetch(`/reviews/${reviewId}/edit`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ reviewText, rating })
        });

        const data = await response.json();

        if (response.ok) {
          alert("Review updated successfully!");
          location.reload();
        } else {
          alert(data.message || "Failed to update review.");
        }
      } catch (err) {
        console.error(err);
        alert("An error occurred while updating the review.");
      }
    });

    // Reset logic on close
    const modal = document.getElementById(`editReviewModal-${reviewId}`);
    function resetReviewModal() {
      const originalText = form?.dataset.originalReview || "";
      document.getElementById(`editReviewbox-${reviewId}`).value = originalText;
      document.getElementById(`editReviewRating-${reviewId}`).value = "5";
    }

    modal.addEventListener("hidden.bs.modal", resetReviewModal);

    const closeButton = modal.querySelector(".close");
    if (closeButton) {
      closeButton.addEventListener("click", resetReviewModal);
    }
  });
});