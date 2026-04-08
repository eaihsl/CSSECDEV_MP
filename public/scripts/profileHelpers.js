document.querySelectorAll('.gym-card-link').forEach(card => {
    card.addEventListener('click', function(event) {
        if (!event.target.closest('.edit-btn') && !event.target.closest('.delete-btn')) {
            window.location.href = this.dataset.href;
        }
    });
});