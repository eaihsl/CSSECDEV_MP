document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('editProfileForm');
    const clearButton = document.getElementById('clearProfilePicture');
    const imagePreview = document.getElementById('editProfileImagePreview');
    const profilePictureInput = document.getElementById('editProfilePictureFile');

    const editModal = document.getElementById('editProfileModal');

    if (editModal) {
        $('#editProfileModal').on('hidden.bs.modal', () => {
            // Clear password fields
            document.getElementById('editPassword').value = '';
            document.getElementById('editConfirmPassword').value = '';
    
            // Reset description
            document.getElementById('editProfileDescription').value = form.dataset.originalDescription;
    
            // Reset file input
            profilePictureInput.value = '';
    
            // Reset image preview
            const originalPicture = form.dataset.originalProfilePicture;
            if (originalPicture && imagePreview) {
                imagePreview.src = `/profile_pictures/${originalPicture}`;
            }
    
            // Remove hidden inputs (if they exist)
            const resetInput = document.getElementById('resetProfilePictureInput');
            if (resetInput) resetInput.remove();
    
            const tempFilenameInput = document.getElementById('profilePictureFilenameInput');
            if (tempFilenameInput) tempFilenameInput.remove();
        });
    }

    if (profilePictureInput) {
        profilePictureInput.addEventListener("change", () => {
            const file = profilePictureInput.files[0];
            if (!file) return;

            const imagePreview = document.getElementById("editProfileImagePreview");
            if (imagePreview) {
                imagePreview.src = URL.createObjectURL(file);
            }
        });
    }

    clearButton.addEventListener('click', (event) => {
        event.preventDefault();
        imagePreview.src = '/profile_pictures/default_avatar.jpg';
        profilePictureInput.value = '';

        let resetInput = form.querySelector('input[name="resetProfilePicture"]');
        if (!resetInput) {
            resetInput = document.createElement('input');
            resetInput.type = 'hidden';
            resetInput.name = 'resetProfilePicture';
            form.appendChild(resetInput);
        }
        resetInput.value = 'true';
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const userId = form.getAttribute('data-user-id');
        const password = document.getElementById('editPassword').value;
        const confirmPassword = document.getElementById('editConfirmPassword').value;
        const shortDescription = document.getElementById('editProfileDescription').value;
        const formData = new FormData();

        if (password && password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }

        if (password) {
            formData.append('password', password);
        }

        if (shortDescription) {
            formData.append('shortDescription', shortDescription);
        }

        if (profilePictureInput.files.length > 0) {
            formData.append('profilePicture', profilePictureInput.files[0]);
        }

        const resetProfilePicture = form.querySelector('input[name="resetProfilePicture"]');
        if (resetProfilePicture) {
            formData.append('resetProfilePicture', resetProfilePicture.value);
        }

        const tempFilenameInput = document.getElementById("profilePictureFilenameInput");
        if (tempFilenameInput) {
            formData.append("profilePictureFilename", tempFilenameInput.value);
        }

        try {
            const response = await fetch(`/users/${userId}`, {
                method: 'PUT',
                body: formData,
            });

            if (response.ok) {
                alert('Profile updated successfully!');
                location.reload();
            } else {
                alert('Error updating profile.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
        }
    });
});
