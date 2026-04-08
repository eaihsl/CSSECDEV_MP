document.addEventListener("DOMContentLoaded", function () {
    const deleteProfileModal = document.getElementById("deleteProfileModal");

    function resetDeleteProfileModal() {
        const username = document.getElementById("confirmDeleteUsername");
        const password = document.getElementById("confirmDeletePassword");
        const deleteConfirmation = document.getElementById("deleteConfirmation");

        if (username) username.value = "";
        if (password) password.value = "";
        if (deleteConfirmation) deleteConfirmation.checked = false;
    }

    if (deleteProfileModal) {
        deleteProfileModal.addEventListener("hidden.bs.modal", resetDeleteProfileModal);
        const closeButton = deleteProfileModal.querySelector(".close");
        if (closeButton) {
            closeButton.addEventListener("click", resetDeleteProfileModal);
        }
    }

    const deleteProfileForm = document.getElementById("deleteProfileForm");
    if (deleteProfileForm) {
        deleteProfileForm.addEventListener("submit", async function (e) {
            e.preventDefault();
    
            const username = document.getElementById("confirmDeleteUsername").value.trim();
            const password = document.getElementById("confirmDeletePassword").value.trim();
            const confirmed = document.getElementById("deleteConfirmation").checked;
    
            if (!username || !password || !confirmed) {
                return alert("Please complete all fields and confirm before deleting.");
            }
    
            const userId = deleteProfileForm.getAttribute("data-user-id");
    
            try {
                const response = await fetch(`/users/${userId}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });
    
                if (response.ok) {
                    alert("Profile deleted successfully.");
                    window.location.href = "/";
                } else {
                    const error = await response.json();
                    alert("Failed: " + error.message);
                }
            } catch (err) {
                console.error("Error deleting profile:", err);
                alert("An error occurred. Try again.");
            }
        });
    }
})
