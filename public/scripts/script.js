// Navbar establishment search script
document.getElementById("search-addon").addEventListener("click", function() {
    window.location.href = "/results?nameSearch="+document.getElementById("searchQueryNavbar").value;
  });

// Establishment review script
document.getElementById("search-review").addEventListener("click", function() {
  window.location.href = "/establishments/"+this.getAttribute("data-establishment-id")+"/results?reviewSearch="+document.getElementById("searchQueryReview").value;
});
