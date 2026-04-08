// document.addEventListener("DOMContentLoaded", function () {
//     // Handle image preview on file input change
//     document.querySelectorAll("[id^='editGymForm-']").forEach(form => {
//         const imageInput = form.querySelector("input[type='file']");
//         const previewImg = form.querySelector("img.profile-image");

//         const clearBtn = document.getElementById(`clearImageBtn-${gymId}`);
//         let cleared = false;

//         if (imageInput && previewImg) {
//             imageInput.addEventListener("change", function () {
//                 const file = imageInput.files[0];
//                 if (file) {
//                     const reader = new FileReader();
//                     reader.onload = function (e) {
//                         previewImg.src = e.target.result;
//                         previewImg.style.display = "block";
//                     };
//                     reader.readAsDataURL(file);
//                 }
//             });

//             clearBtn.addEventListener("click", function () {
//                 previewImg.src = "/establishment_pictures/default_establishment.jpg";
//                 imageInput.value = "";
//                 cleared = true;
//             });
//         }

//         form.addEventListener("submit", async function (event) {
//             event.preventDefault();

//             const gymIdInput = form.querySelector("[id^='gymId']");
//             const gymId = gymIdInput ? gymIdInput.value : null;

//             if (!gymId) {
//                 alert("Error: Gym ID not found!");
//                 return;
//             }

//             const formData = new FormData();
//             formData.append("gymName", form.querySelector("[id^='eGymName-']").value);
//             formData.append("gymDesc", form.querySelector("[id^='eGymDescription-']").value);
//             formData.append("address", form.querySelector("[id^='eGymAddress-']").value);
//             formData.append("contactNumber", form.querySelector("[id^='eGymContact-']").value);

//             const amenities = Array.from(form.querySelectorAll("input[name='eAmenities[]']:checked")).map(input => input.value);
//             amenities.forEach(value => formData.append("amenities", value));

//             const region = form.querySelector("input[name='eRegions']:checked")?.value;
//             if (region) formData.append("regions", region);

//             // Append image if selected
//             if (imageInput && imageInput.files.length > 0) {
//                 formData.append("gymImage", imageInput.files[0]);
//             }

//             const response = await fetch(`/users/updateGym/${gymId}`, {
//                 method: "PUT",
//                 body: formData
//             });

//             if (response.ok) {
//                 alert("Gym updated successfully!");
//                 $(form).closest(".modal").modal("hide");
//                 form.reset();
//                 window.location.reload();
//             } else {
//                 const errorData = await response.json();
//                 alert("Error: " + (errorData.message || "Unknown error"));
//             }
//         });
//     });

//     $("[id^='editGymModal-']").on("hidden.bs.modal", function () {
//         $(this).find("form")[0].reset();
//     });
// });

document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[id^='editGymForm-']").forEach(form => {
        const gymIdInput = form.querySelector("[id^='gymId']");
        const gymId = gymIdInput ? gymIdInput.value : null;

        const imageInput = form.querySelector("input[type='file']");
        const previewImg = form.querySelector("img.profile-image");
        const clearBtn = document.getElementById(`clearImageBtn-${gymId}`);

        let cleared = false;

        // Handle image preview
        if (imageInput && previewImg) {
            imageInput.addEventListener("change", function () {
                const file = imageInput.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        previewImg.src = e.target.result;
                        previewImg.style.display = "block";
                        cleared = false; // user selected a new file, cancel cleared flag
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Handle clear image button
        if (clearBtn && previewImg && imageInput) {
            clearBtn.addEventListener("click", function () {
                previewImg.src = "/establishment_pictures/default_establishment.jpg";
                imageInput.value = "";
                cleared = true;
            });
        }

        // Submit form
        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (!gymId) {
                alert("Error: Gym ID not found!");
                return;
            }

            const formData = new FormData();
            formData.append("gymName", form.querySelector("[id^='eGymName-']").value);
            formData.append("gymDesc", form.querySelector("[id^='eGymDescription-']").value);
            formData.append("address", form.querySelector("[id^='eGymAddress-']").value);

            const phoneRegex = /\b(\+63\s?)?\d{3}-\d{3}-\d{4}\b/g;

            const contactInput = form.querySelector("[id^='eGymContact-']");
            let contactNumber = contactInput.value.trim();

            if (contactNumber === "" || contactNumber.match(phoneRegex) || contactNumber.startsWith("+63")) {
                if (!contactNumber.startsWith("+63") && contactNumber !== "") {
                    contactNumber = '+63 ' + contactNumber;
                }
                formData.append("contactNumber", contactNumber);
            } else {
                alert("Invalid phone number. Please enter a valid contact number.");
                return;
            }

            const amenities = Array.from(form.querySelectorAll("input[name='eAmenities[]']:checked")).map(input => input.value);
            amenities.forEach(value => formData.append("amenities", value));

            const region = form.querySelector("input[name='eRegions']:checked")?.value;
            if (region) formData.append("regions", region);

            // Add image file if not cleared
            if (imageInput && imageInput.files.length > 0) {
                formData.append("gymImage", imageInput.files[0]);
            }

            // Tell the backend to reset to default if user cleared it
            if (cleared) {
                formData.append("resetImage", "true");
            }

            try {
                const response = await fetch(`/users/updateGym/${gymId}`, {
                    method: "PUT",
                    body: formData
                });

                if (response.ok) {
                    alert("Gym updated successfully!");
                    $(form).closest(".modal").modal("hide");
                    window.location.reload();
                } else {
                    const errorData = await response.json();
                    alert("Error: " + (errorData.message || "Unknown error"));
                }
            } catch (err) {
                console.error("Update error:", err);
                alert("Something went wrong.");
            }
        });
    });

    // Reset form on modal close
    $("[id^='editGymModal-']").on("hidden.bs.modal", function () {
        $(this).find("form")[0].reset();
    });
});