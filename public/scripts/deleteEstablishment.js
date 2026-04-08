document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[id^=deleteGymModal-]").forEach(modal => {
        const gymId = modal.id.replace("deleteGymModal-", "");

        const deleteForm = modal.querySelector(`#deleteGymForm-${gymId}`);
        const deleteButton = modal.querySelector(`#deleteButton-${gymId}`);

        deleteForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const username = modal.querySelector(`#confirmDeleteUsername-${gymId}`).value.trim();
            const password = modal.querySelector(`#confirmDeletePassword-${gymId}`).value.trim();
            const confirmationChecked = modal.querySelector(`#confirmDeleteCheckbox-${gymId}`).checked;

            if (!username || !password || !confirmationChecked) {
                alert("Please fill in all fields and check the confirmation box.");
                return;
            }

            try {
                deleteButton.disabled = true;
                const response = await fetch(`/users/deleteGym/${gymId}`, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();
                if (response.ok) {
                    alert("Gym deleted successfully!");
                    location.reload();
                } else {
                    alert(result.message || "Failed to delete gym.");
                }
            } catch (error) {
                console.error("Error deleting gym:", error);
                alert("An error occurred. Please try again later.");
            } finally {
                deleteButton.disabled = false;
            }
        });
    });
});