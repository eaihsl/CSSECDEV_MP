// document.addEventListener("DOMContentLoaded", function () {
//     const createGymForm = document.getElementById("createGymForm");

//     if (createGymForm) {
//         createGymForm.addEventListener("submit", async function (event) {
//             event.preventDefault();

//             const gymData = {
//                 gymName: document.getElementById("registerGymName").value,
//                 gymDesc: document.getElementById("gymProfileDescription").value,
//                 address: document.getElementById("gymAddress").value,
//                 contactNumber: document.getElementById("gymContact").value,
//                 amenities: Array.from(document.querySelectorAll("input[name='amenities[]']:checked")).map(input => input.value),
//                 regions: document.querySelector("input[name='regions']:checked")?.value || null
//             };

//             try {
//                 const response = await fetch("/users/createGym", {
//                     method: "POST",
//                     headers: {
//                         "Content-Type": "application/json"
//                     },
//                     body: JSON.stringify(gymData)
//                 });

//                 if (response.ok) {
//                     const result = await response.json();
//                     alert("Establishment created successfully!");
//                     console.log(result);
//                     $("#createGymModal").modal("hide");
//                     createGymForm.reset();
//                 } else {
//                     const errorData = await response.json();
//                     alert("Error: " + (errorData.message || "Unknown error"));
//                 }
//             } catch (error) {
//                 console.error("Error:", error);
//             }
//         });

//         $("#createGymModal").on("hidden.bs.modal", function () {
//             createGymForm.reset();
//         });
//     } else {
//         console.error("Form element not found!");
//     }
// });

let selectedGymImage = null;

document.addEventListener("DOMContentLoaded", function () {
    const createGymForm = document.getElementById("createGymForm");
    const gymImageInput = document.getElementById("gymImage");
    const gymPreview = document.getElementById("gymProfileImagePreview");

    if (gymImageInput && gymPreview) {
        gymImageInput.addEventListener("change", function () {
            const file = gymImageInput.files[0];
            if (file) {
                selectedGymImage = file;

                const reader = new FileReader();
                reader.onload = function (e) {
                    gymPreview.src = e.target.result;
                    gymPreview.style.display = "block";
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (createGymForm) {
        createGymForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const formData = new FormData();
            formData.append("gymName", document.getElementById("registerGymName").value);
            formData.append("gymDesc", document.getElementById("gymProfileDescription").value);
            formData.append("address", document.getElementById("gymAddress").value);

            const phoneRegex = /\b\d{3}-\d{3}-\d{4}\b/g;

            const formatPhoneNumber = (number) => {
                if (/^\d{10}$/.test(number)) {
                    return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`;
                }
                return number;
            };

            const contactInput = document.getElementById("gymContact");
            let contactNumber = contactInput.value.trim();
            contactNumber = formatPhoneNumber(contactNumber);

            if (contactNumber.match(phoneRegex)) {
                contactNumber = '+63 ' + contactNumber;
                formData.append("contactNumber", contactNumber);

            } else if(contactNumber === ""){
                formData.append("contactNumber", contactNumber);
            } else{
                alert("Invalid phone number. Please enter a valid contact number.");
                return;
            }

            const amenities = document.querySelectorAll("input[name='amenities[]']:checked");
            amenities.forEach(input => formData.append("amenities[]", input.value));

            const region = document.querySelector("input[name='regions']:checked");
            if (region) formData.append("regions", region.value);

            if (selectedGymImage) {
                formData.append("gymImage", selectedGymImage);
            }

            try {
                const response = await fetch("/users/createGymWithImage", {
                    method: "POST",
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    alert("Establishment created successfully!");
                    console.log(result);
                    $("#createGymModal").modal("hide");
                    createGymForm.reset();
                    gymPreview.src = "/establishment_pictures/default_establishment.jpg";
                    window.location.reload();
                } else {
                    const errorData = await response.json();
                    alert("Error: " + (errorData.message || "Unknown error"));
                }
            } catch (error) {
                console.error("Error:", error);
                alert("Something went wrong while submitting the form.");
            }
        });

        $("#createGymModal").on("hidden.bs.modal", function () {
            createGymForm.reset();
            selectedGymImage = null;
            if (gymPreview) {
                gymPreview.src = "/establishment_pictures/default_establishment.jpg";
            }
        });
    } else {
        console.error("Form element not found!");
    }
});