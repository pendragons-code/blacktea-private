"use strict"
const socket = io();

//logging out
function logOut() {
	fetch("/logout", {
		method: "POST",
		credentials: "include" // Important for cookie-based auth
	})
		.then(response => {
			if (response.ok) {
				// Clear local storage if used
				localStorage.clear();

				// Remove token cookie
				document.cookie = "token=; Max-Age=0; path=/; SameSite=Strict; Secure";

				// Redirect to landing page
				window.location.href = "/";
			}
		})
		.catch(error => {
			console.error("Logout failed:", error);
		});
}

// music control

// socket events

// transform