let selectedFile = null;

window.onload = function() {
    const username = getCookie("username");
    const password = getCookie("password");
    
    

    if (username) {
        document.getElementById("loginUsername").value = username;
    }
    if (password) {
        document.getElementById("loginPassword").value = password;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const profilePictureInput = document.getElementById("profilePictureFile");
    const registerButton = document.getElementById("registerButton");
    const loginButton = document.getElementById("loginButton");
    const registerModal = document.getElementById("registerModal");

    const loginModal = document.getElementById("loginModal");

    function resetLoginModal() {
        const username = document.getElementById("loginUsername");
        const password = document.getElementById("loginPassword");
        const rememberMe = document.getElementById("rememberMe");

        if (username) username.value = "";
        if (password) password.value = "";
        if (rememberMe) rememberMe.checked = false;
    }

    function resetRegisterModal() {
        selectedFile = null;
        profilePictureInput.value = "";
        const preview = document.getElementById("profileImagePreview");
        if (preview) {
            preview.src = "/profile_pictures/default_avatar.jpg";
        }

        // Reset all text inputs and selects inside the modal
        const fieldsToReset = [
            "registerFirstName",
            "registerLastName",
            "registerUsername",
            "registerPassword",
            "registerConfirmPassword",
            "profileDescription",
            "accountType",
            "securityQuestion",
            "securityAnswer"
        ];

        fieldsToReset.forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                if (field.tagName === "SELECT") {
                    field.selectedIndex = 0; // Reset dropdown
                } else {
                    field.value = ""; // Clear text inputs
                }
            }
        });
    }

    if (loginModal) {
        loginModal.addEventListener("hidden.bs.modal", resetLoginModal);
        const closeButton = loginModal.querySelector(".close");
        if (closeButton) {
            closeButton.addEventListener("click", resetLoginModal);
        }
    }

    if (registerModal) {
        registerModal.addEventListener("hidden.bs.modal", resetRegisterModal);
        const closeButton = registerModal.querySelector(".close");
        if (closeButton) {
            closeButton.addEventListener("click", resetRegisterModal);
        }
    }

    if (profilePictureInput) {
        profilePictureInput.addEventListener("change", function (event) {
            selectedFile = event.target.files[0];

            if (!selectedFile) {
                console.warn("No file selected.");
                return;
            }

            console.log("Selected file:", selectedFile.name);

            const preview = document.getElementById("profileImagePreview");
            if (!preview) {
                console.error("Image preview element not found.");
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = "block"; 
                console.log("Image preview updated.");
            };

            reader.onerror = function (error) {
                console.error("Error reading file:", error);
            };

            reader.readAsDataURL(selectedFile); 
        });
    }

    if (registerButton) {
        registerButton.addEventListener("click", async function (event) {
            event.preventDefault();

            console.log("Registering user...");

            const username = document.getElementById("registerUsername").value.trim();
            const email = document.getElementById("registerEmail").value.trim();
            const password = document.getElementById("registerPassword").value.trim();
            const confirmPassword = document.getElementById("registerConfirmPassword").value.trim();
            const shortDescription = document.getElementById("profileDescription").value.trim() || "";
            const role = document.getElementById("accountType").value;
            const securityQuestion = document.getElementById("securityQuestion").value.trim();
            const securityAnswer = document.getElementById("securityAnswer").value.trim();

            if (!username || !email || !password || !confirmPassword) {
                alert("Please fill in all required fields.");
                return;
            }

            if (!securityQuestion || !securityAnswer) {
                alert("Please provide a security question and answer.");
                return;
            }

            const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

            if (emailPattern.test(username)) {
                alert('Please do not use an email address as a Username');
                return;
            }

            if (!emailPattern.test(email)) {
                alert('Please enter a valid email address.');
                return;
            }

            if (password !== confirmPassword) {
                alert("Passwords do not match.");
                return;
            }

            let tempFilename = "";

            if (selectedFile) {
                console.log("Uploading profile picture...");

                const formData = new FormData();
                formData.append("profilePicture", selectedFile);

                try {
                    const response = await fetch("/users/uploadTempProfilePicture", {
                        method: "POST",
                        body: formData
                    });

                    const data = await response.json();
                    if (response.ok) {
                        tempFilename = data.filename;
                        console.log("Uploaded temp filename:", tempFilename);
                    } else {
                        console.error("Upload error:", data.message);
                    }
                } catch (error) {
                    console.error("Error uploading profile picture:", error);
                }
            }

            try {
                const response = await fetch("/users/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, email, password, shortDescription, role, tempFilename, securityQuestion, securityAnswer })
                });

                const data = await response.json();
                if (response.ok) {
                    console.log("Registration Successful:", data);


                    setCookie('authToken', data.token, 30);
                    window.location.reload();
                } else {
                    alert("Error: " + (data.message || "Unknown error"));
                }
            } catch (error) {
                console.error("Error registering user:", error);
            }
        });
    }

    if (loginButton) {
    window.onload = function() {
        const username = getCookie("username");
        const password = getCookie("password");
        if (username) {
            document.getElementById("loginUsername").value = username;
        }
        if (password) {
            document.getElementById("loginPassword").value = password;
        }
    }

        loginButton.addEventListener("click", async function (event) {
            event.preventDefault();

            const username = document.getElementById("loginUsername").value.trim();
            const password = document.getElementById("loginPassword").value.trim();
            const rememberMe = document.getElementById("rememberMe").checked;
            console.log("Password field value before login:", document.getElementById("loginPassword").value);

            // if (!username || !password) {
            //     alert("Please enter both username and password.");
            //     return;
            // }

            try {
                const response = await fetch("/users/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password, rememberMe })
                });
                
                const data = await response.json();
                if (response.ok) {
                    // 2.1.12 - Show the user their last login activity before reloading
                    if (data.lastLogin) {
                        const { lastLoginAt, lastLoginAttemptAt, lastLoginSuccess } = data.lastLogin;
                        if (lastLoginAttemptAt) {
                            const attemptDate = new Date(lastLoginAttemptAt).toLocaleString();
                            const outcome = lastLoginSuccess ? "successful" : "FAILED";
                            alert(`Welcome back! Your last login attempt was ${outcome} on ${attemptDate}.`);
                        }
                    }
                    if(rememberMe){
                        setCookie("username", username, 30);
                        setCookie("password", password, 30);
                    }else{
                        setCookie("username", username, -1);
                        setCookie("password", password, -1);
                    }
                    window.location.reload();
                } else {
                    alert(`Error: ${data.message}`);
                }
            } catch (error) {
                console.error("Error logging in:", error);
                alert("Error logging in. Please try again.");
            }
        });
    }

    // ── Forgot Password: Step 1 — fetch security question ────────────────────
    const fetchQuestionButton = document.getElementById("fetchQuestionButton");
    if (fetchQuestionButton) {
        fetchQuestionButton.addEventListener("click", async function () {
            const username = document.getElementById("resetUsername").value.trim();
            if (!username) {
                alert("Please enter your username or email.");
                return;
            }

            try {
                const response = await fetch(`/users/resetPassword/question?username=${encodeURIComponent(username)}`);
                const data = await response.json();

                if (!data.question) {
                    alert("No security question found for that account.");
                    return;
                }

                // Show step 2 and populate the question label
                document.getElementById("resetQuestionLabel").textContent = data.question;
                document.getElementById("resetStep1").style.display = "none";
                document.getElementById("resetStep2").style.display = "block";
            } catch (error) {
                console.error("Error fetching security question:", error);
                alert("Something went wrong. Please try again.");
            }
        });
    }

    // ── Forgot Password: Step 2 — submit answer and new password ─────────────
    const resetPasswordButton = document.getElementById("resetPasswordButton");
    if (resetPasswordButton) {
        resetPasswordButton.addEventListener("click", async function () {
            const username = document.getElementById("resetUsername").value.trim();
            const securityAnswer = document.getElementById("resetAnswer").value.trim();
            const newPassword = document.getElementById("resetNewPassword").value.trim();
            const confirmPassword = document.getElementById("resetConfirmPassword").value.trim();

            if (!securityAnswer || !newPassword || !confirmPassword) {
                alert("Please fill in all fields.");
                return;
            }

            if (newPassword !== confirmPassword) {
                alert("Passwords do not match.");
                return;
            }

            try {
                const response = await fetch("/users/resetPassword", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, securityAnswer, newPassword })
                });

                const data = await response.json();
                if (response.ok) {
                    alert("Password reset successfully! Please log in with your new password.");
                    // Close modal and reset its state
                    $("#forgotPasswordModal").modal("hide");
                    document.getElementById("resetUsername").value = "";
                    document.getElementById("resetAnswer").value = "";
                    document.getElementById("resetNewPassword").value = "";
                    document.getElementById("resetConfirmPassword").value = "";
                    document.getElementById("resetStep1").style.display = "block";
                    document.getElementById("resetStep2").style.display = "none";
                } else {
                    alert("Error: " + (data.message || "Unknown error"));
                }
            } catch (error) {
                console.error("Error resetting password:", error);
                alert("Something went wrong. Please try again.");
            }
        });
    }

    async function loginUser(username, password) {
        try {
            const response = await fetch("/users/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({username, password})
            });
    
            const data = await response.json();
            if (response.ok) {
                window.location.reload();
            } else {
                alert(`Error logging in after registration: ${data.message}`);
            }
        } catch (error) {
            console.error("Auto-login error:", error);
            alert("Auto-login failed. Please log in manually.");
        }
    }


})

function setCookie(cname,cvalue,exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
  }
  
  function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  }