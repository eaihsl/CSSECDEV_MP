function loadComments(reviewId, establishmentId) {
    fetch(`/establishments/${establishmentId}/reviews/${reviewId}`)
        .then(response => response.json())
        .then(data => {
            const commentSection = document.getElementById("commentModalBody");
            commentSection.innerHTML = ""; // Clear previous comments

            if (data.comments.length > 0) {
                data.comments.forEach(comment => {
                    commentSection.innerHTML += `
                        <div class="comment">
                            <p><strong>${comment.userId.username}</strong>: ${comment.commentText}</p>
                            <p><small>Posted at: ${new Date(comment.createdAt).toLocaleString()}</small></p>
                            <hr>
                        </div>
                    `;
                });
            } else {
                commentSection.innerHTML = "<p>No comments yet. Be the first to comment!</p>";
            }
        })
        .catch(error => console.error("Error loading comments:", error));
}

function openCommentModal(reviewId, establishmentId) {
    console.log("Modal opened with reviewId:", reviewId); // DEBUG
    document.getElementById("currentReviewId").value = reviewId;
    document.getElementById("currentEstablishmentId").value = establishmentId;
    loadComments(reviewId, establishmentId);
    document.getElementById("commentbox").value = "";
}

function post_comment() {
    const commentText = document.getElementById("commentbox").value;
    const reviewId = document.getElementById("currentReviewId").value;
    const establishmentId = document.getElementById("currentEstablishmentId").value;

    console.log("Posting comment to:", reviewId, establishmentId);

    if (commentText.trim() === "") {
        alert("Comment cannot be empty.");
        return;
    }

    fetch(`/comments/${reviewId}/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ commentText })
    })
    .then(response => response.json())
    .then(data => {
        if (data.comment) {
            loadComments(reviewId, establishmentId);
            document.getElementById("commentbox").value = "";
        } else {
            alert("Failed to post comment.");
        }
    })
    .catch(error => console.error("Error posting comment:", error));
}

function deleteComment(commentId) {
    fetch(`/comments/${commentId}/delete`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
      if (data.message === "Comment deleted successfully") {
        alert("Comment deleted.");
        location.reload(); // 🔁 Refresh to reflect changes
      } else {
        alert("Failed to delete comment.");
      }
    })
    .catch(err => {
      console.error("Error deleting comment:", err);
      alert("Something went wrong.");
    });
  }
