const API_URL = "https://lostloop.onrender.com/";
let postIdToDelete = null;
// Helper: Retrieve token from localStorage
function getToken() {
  return localStorage.getItem("token");
}

// Helper: Parse query parameters from URL
function getQueryParams() {
  const params = {};
  const queryString = window.location.search.substring(1);
  if(queryString) {
    queryString.split("&").forEach(pair => {
      const [key, value] = pair.split("=");
      params[key] = decodeURIComponent(value);
    });
  }
  return params;
}

/* =====================================================
   INDEX (Login & Register Page)
===================================================== */
async function uploadProfilePic() {
  const fileInput = document.getElementById('regFileInput');
  const file = fileInput.files[0];
  const regImageUploadMsg = document.getElementById('regImageUploadMsg');

  if (!file) {
    alert('Please select an image first!');
    return;
  }

  // Replace with your Imgur Client-ID
  const clientId = '5b99fb51d864d24';
  const formData = new FormData();
  formData.append('image', file);

  regImageUploadMsg.innerText = "Uploading image...";

  try {
    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${clientId}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      let imageUrl = data.data.link; // e.g., "https://imgur.com/randomid"
      // If URL doesn't have an extension, convert it to a raw URL
      if (imageUrl.includes("imgur.com/") && !/\.[a-zA-Z0-9]+$/.test(imageUrl)) {
        let ext = "";
        if (data.data.type === "image/jpeg") {
          ext = "jpg";
        } else if (data.data.type === "image/png") {
          ext = "png";
        } else if (data.data.type === "image/gif") {
          ext = "gif";
        }
        const id = imageUrl.replace("https://imgur.com/", "");
        imageUrl = `https://i.imgur.com/${id}.${ext}`;
      }
      regImageUploadMsg.innerText = "Image uploaded successfully!";
      // Set the hidden input value
      document.getElementById('profile-pic').value = imageUrl;
    } else {
      regImageUploadMsg.innerText = "Image upload failed!";
      alert('Image upload failed!');
    }
  } catch (error) {
    console.error('Error uploading profile image:', error);
    regImageUploadMsg.innerText = "Something went wrong during the upload.";
    alert('Something went wrong during the upload.');
  }
}


if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
  const toggleAuth = document.getElementById("toggleAuth");
  const submitBtn = document.getElementById("submitBtn");
  const formTitle = document.getElementById("form-title");
  const toggleText = document.getElementById("toggle-text");
  const usernameField = document.getElementById("usernameField");
  const profilePicField = document.getElementById("profilePicField");
  let isLogin = true;

  toggleAuth.addEventListener("click", (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    if (isLogin) {
      formTitle.innerText = "Login";
      submitBtn.innerText = "Login";
      toggleText.innerText = "Don't have an account?";
      usernameField.classList.add("hidden");
      profilePicField.classList.add("hidden");
    } else {
      formTitle.innerText = "Register";
      submitBtn.innerText = "Register";
      toggleText.innerText = "Already have an account?";
      usernameField.classList.remove("hidden");
      profilePicField.classList.remove("hidden");
    }
  });

  submitBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorMsg = document.getElementById("error-msg");
    errorMsg.innerText = "";
    if (isLogin) {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        window.location.href = "dashboard.html";
      } else {
        errorMsg.innerText = data.error || "Login failed";
      }
    } else {
      const username = document.getElementById("username").value.trim();
      const profilePic = document.getElementById("profile-pic").value.trim(); // Will contain URL if uploaded
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, profile_pic: profilePic })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Registration successful. Please log in.");
        isLogin = true;
        formTitle.innerText = "Login";
        submitBtn.innerText = "Login";
        toggleText.innerText = "Don't have an account?";
        usernameField.classList.add("hidden");
        profilePicField.classList.add("hidden");
      } else {
        errorMsg.innerText = data.error || "Registration failed";
      }
    }
  });
}



/* =====================================================
   DASHBOARD (For You / Posts, Create Post, Search)
===================================================== */
async function loadDashboard() {
  if (!getToken()) {
    window.location.href = "index.html";
    return;
  }

  const res = await fetch(`${API_URL}/posts`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  const posts = await res.json();

  const container = document.getElementById("posts-container");
  container.innerHTML = posts
    .map((post) => {
      const profilePic = post.user.profile_pic || "https://via.placeholder.com/40?text=No+Pic";
      const updatedDate = new Date(post.updatedAt).toLocaleDateString();

      return `
        <div class="relative bg-white rounded-lg shadow-md p-4 overflow-hidden">
          <!-- User avatar + username in top-left corner -->
          <div class="absolute top-2 left-2 flex items-center">
            <img
              src="${profilePic}"
              alt="${post.user.username}'s avatar"
              referrerpolicy="no-referrer"
              class="w-8 h-8 rounded-full object-cover mr-2"
            />
            <span class="font-semibold">${post.user.username}</span>
          </div>
          <!-- Updated date in top-right corner -->
          <span class="absolute top-2 right-2 text-sm text-gray-500">
            Updated: ${updatedDate}
          </span>

          <!-- Image Container (fixed height for consistent display) -->
          ${
            post.imageUrl
              ? `
                <div class="mt-8 h-48 overflow-hidden rounded-md">
                  <img
                    src="${post.imageUrl}"
                    alt="Post Image"
                    referrerpolicy="no-referrer"
                    class="object-cover w-full h-full"
                  />
                </div>`
              : `
                <div class="mt-8 h-48 bg-gray-200 rounded-md flex items-center justify-center text-gray-500">
                  No Image
                </div>`
          }

          <!-- Title & Description -->
          <h3 class="text-lg font-bold mt-4">${post.title}</h3>
          <p class="text-gray-700 text-sm mb-3">
            ${post.description}
          </p>

          <!-- View Post Button -->
          <div class="flex justify-end">
            <button
              onclick="window.location.href='post.html?postId=${post.id}'"
              class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition"
            >
              View Post
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

if (window.location.pathname.includes("dashboard.html")) {
  loadDashboard();
}

function fillCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const longitude = position.coords.longitude.toFixed(6);
      const latitude = position.coords.latitude.toFixed(6);
      // Format as "long:lat"
      document.getElementById("post-location").value = `${longitude}:${latitude}`;
    }, (error) => {
      console.error("Geolocation error:", error);
      alert("Unable to retrieve your location.");
    });
  } else {
    alert("Geolocation is not supported by this browser.");
  }
}


async function createPost() {
  const title = document.getElementById("post-title").value.trim();
  const description = document.getElementById("post-description").value.trim();
  const location = document.getElementById("post-location").value.trim();
  const imageUrl = document.getElementById("post-imageUrl").value.trim();
  const res = await fetch(`${API_URL}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`
    },
    body: JSON.stringify({ title, description, location, imageUrl })
  });
  const data = await res.json();
  document.getElementById("create-post-msg").innerText = res.ok ? "Post created!" : (data.error || "Failed to create post");
  if (res.ok) {
    // Clear the form and reload posts
    document.getElementById("post-title").value = "";
    document.getElementById("post-description").value = "";
    document.getElementById("post-location").value = "";
    document.getElementById("post-imageUrl").value = "";
    loadDashboard();
  }
}

async function uploadImage() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  const imageUploadMsg = document.getElementById('imageUploadMsg');
  
  if (!file) {
    alert('Please select an image first!');
    return;
  }
  
  // Replace with your Imgur Client-ID
  const clientId = '5b99fb51d864d24';
  
  // Create form data to send the image
  const formData = new FormData();
  formData.append('image', file);
  
  imageUploadMsg.innerText = "Uploading image...";
  
  try {
    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${clientId}`,
      },
      body: formData,
    });
    
    const data = await response.json();
    if (data.success) {
      const imageUrl = data.data.link;
      // Display a message and set the image URL in the hidden input
      imageUploadMsg.innerText = "Image uploaded successfully!";
      // Optionally, you can remove the file input and show a preview here.
      document.getElementById('post-imageUrl').value = imageUrl;
      // Unhide the field if you want to let the user edit it
      // document.getElementById('post-imageUrl').classList.remove('hidden');
    } else {
      imageUploadMsg.innerText = "Image upload failed!";
      alert('Image upload failed!');
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    imageUploadMsg.innerText = "Something went wrong during the upload.";
    alert('Something went wrong during the upload.');
  }
}


async function searchPosts() {
  const query = document.getElementById("post-search").value.trim();
  if (!query) {
    loadDashboard();
    return;
  }
  const res = await fetch(`${API_URL}/posts/search?q=${encodeURIComponent(query)}`);
  const posts = await res.json();
  const container = document.getElementById("posts-container");
  container.innerHTML = posts.map(post => `
    <div class="bg-white rounded-xl shadow-lg p-4">
      <h3 class="text-xl font-bold">${post.title}</h3>
      <p class="mt-2">${post.description}</p>
      <p class="text-sm text-gray-600">${post.location || ""}</p>
      ${ post.imageUrl ? `<img src="${post.imageUrl}" alt="${post.title}" referrerpolicy="no-referrer" class="mt-2 rounded">` : "" }
      <a href="post.html?postId=${post.id}" class="inline-block mt-2 text-purple-600 font-semibold">View Post</a>
    </div>
  `).join("");
}

/* =====================================================
   PROFILE PAGE (View/Edit Profile, My Posts, Reward)
===================================================== */
async function loadProfile() {
  if (!getToken()) {
    window.location.href = "index.html";
    return;
  }

  // Get URL parameters (e.g., ?userid=123)
  const params = getQueryParams();
  let userIdParam = params.userid || "me";
  let apiUrl = (userIdParam === "me") ? `${API_URL}/users/me` : `${API_URL}/users/${userIdParam}`;

  const res = await fetch(apiUrl, {
    headers: { "Authorization": `Bearer ${getToken()}` }
  });
  const user = await res.json();

  // Decode token to get current logged-in user's id
  const tokenData = parseJwt(getToken());
  const currentUserId = tokenData ? tokenData.user_id : null;
  const isOwnProfile = (user.id === currentUserId);

    // Now, fetch the total reward points for this user
    const rewardsRes = await fetch(`${API_URL}/rewards/${user.id}`, {
      headers: { "Authorization": `Bearer ${getToken()}` }
    });
    const rewardData = await rewardsRes.json();
    const totalReward = rewardData.total_reward || 0;
  
  // Build profile info content
  const profileInfo = document.getElementById("profile-info");
  let profilePicHTML = "";
  if (user.profile_pic && user.profile_pic.trim() !== "") {
    profilePicHTML = `<img src="${user.profile_pic}" referrerpolicy="no-referrer" alt="${user.username}'s Profile Picture" class="w-full h-full rounded-full object-cover shadow-lg">`;
  } else {
    profilePicHTML = `<div class="w-full h-full rounded-full bg-gray-300 flex items-center justify-center">
      <span class="text-xl text-gray-700">No Pic</span>
    </div>`;
  }
  // Insert avatar image into the profile-avatar container
  document.getElementById("profile-avatar").innerHTML = profilePicHTML;

  // Format joined date
  const joinedDate = new Date(user.createdAt).toLocaleDateString();
  profileInfo.innerHTML = `
    <h2 class="text-2xl md:text-3xl font-bold mb-1">${user.username}</h2>
    <p class="text-gray-600 mb-1"><b>${totalReward} </b>⭐</p>
    <p class="text-gray-500 text-sm">Joined on <span class="font-medium">${joinedDate}</span></p>
  `;
 
  if (window.location.href.indexOf('userid') !== -1) {
    let word = localStorage.getItem(userIdParam);
    if (word === null){
      word = "Follow"
    }
    document.getElementById("edit-profile-button").outerHTML = `<button id="edit-profile-button" onclick="toggleFollow(${userIdParam})" class="bg-purple-600 text-white px-4 py-2 rounded font-semibold hover:bg-purple-700 transition duration-200">
                ${word}
              </button>`;
}
  // Setup email button as mailto link
  const emailButton = document.getElementById("emailButton");
  if (user.email) {
    emailButton.onclick = () => {
      window.location.href = `mailto:${user.email}`;
    };
  } else {
    emailButton.disabled = true;
    emailButton.classList.add("cursor-not-allowed", "opacity-50");
    emailButton.textContent = "No Email";
  }

  // Load user's posts
  const postsRes = await fetch(`${API_URL}/users/${user.id}/posts`);
  const posts = await postsRes.json();
  const postsContainer = document.getElementById("user-posts");
  postsContainer.innerHTML = posts.map(post => `
    <div class="bg-white rounded-xl shadow-lg p-4">
      <h3 class="text-xl font-bold">${post.title}</h3>
      <p class="mt-2">${post.description}</p>
      <a href="post.html?postId=${post.id}" class="inline-block mt-2 text-purple-600 font-semibold">View Post</a>
    </div>
  `).join("");

  // Update posts heading and autofill reward recipient if viewing another user's profile
  const postsHeading = document.getElementById("posts-heading");
  if (!isOwnProfile) {
    postsHeading.innerText = `${user.username}'s Posts`;
    const rewardRecipientInput = document.getElementById("reward-recipient");
    if (rewardRecipientInput) {
      rewardRecipientInput.value = user.id;
    }
  } else {
    postsHeading.innerText = "My Posts";
  }
}

if (window.location.pathname.includes("profile.html")) {
  loadProfile();
}



function shareProfile() {
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => {
      alert('Profile link copied to clipboard!');
    })
    .catch((err) => {
      console.error('Failed to copy link:', err);
    });
}

async function saveProfileEdits() {
  const newUsername = document.getElementById("edit-username").value.trim();
  const newEmail = document.getElementById("edit-email").value.trim();
  const newProfilePic = document.getElementById("edit-profile-pic").value.trim();
  
  // First, fetch current user info to get the user id
  const userRes = await fetch(`${API_URL}/users/me`, {
    headers: { "Authorization": `Bearer ${getToken()}` }
  });
  const user = await userRes.json();
  
  const res = await fetch(`${API_URL}/users/${user.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`
    },
    body: JSON.stringify({ username: newUsername, email: newEmail, profile_pic: newProfilePic })
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById("edit-profile-msg").innerText = "Profile updated successfully!";
    setTimeout(() => {
      closeEditProfileModal();
      loadProfile();  // refresh profile info
    }, 1000);
  } else {
    document.getElementById("edit-profile-msg").innerText = data.error || "Failed to update profile.";
  }
}

function editProfile() {
  openEditProfileModal();
}

async function sendReward() {
  const recipientId = document.getElementById("reward-recipient").value.trim();
  const amount = document.getElementById("reward-amount").value.trim();
  const res = await fetch(`${API_URL}/rewards/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`
    },
    body: JSON.stringify({ recipientId, amount })
  });
  const data = await res.json();
  document.getElementById("reward-msg").innerText = data.message || data.error;
}

// Utility to parse JWT
function parseJwt(token) {
  if (!token) return null;
  const base64Url = token.split('.')[1];
  if (!base64Url) return null;
  const base64 = base64Url.replace('-', '+').replace('_', '/');
  try {
    return JSON.parse(window.atob(base64));
  } catch (err) {
    console.error('JWT parse error:', err);
    return null;
  }
}

/* =====================================================
   POST DETAILS PAGE (View Post, Comments, Edit/Delete)
===================================================== */
async function loadPostDetails() {
  if (!getToken()) {
    window.location.href = "index.html";
    return;
  }
  const tokenData = parseJwt(getToken());
  const currentUserId = tokenData ? tokenData.user_id : null;

  const params = getQueryParams();
  const postId = params.postId;
  const res = await fetch(`${API_URL}/posts/${postId}`, {
    headers: { "Authorization": `Bearer ${getToken()}` }
  });
  if (!res.ok) {
    document.getElementById("post-details").innerText = "Post not found";
    return;
  }
  const data = await res.json();
  const post = data.post;
  const updatedDate = new Date(post.updatedAt).toLocaleDateString();
  const ownerPic = post.owner.profile_pic || "https://via.placeholder.com/40?text=No+Pic";

  // Build the post details HTML
  document.getElementById("post-details").innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center">
        <img src="${ownerPic}" referrerpolicy="no-referrer" alt="${post.owner.username}'s avatar" class="w-8 h-8 rounded-full object-cover mr-2" />
        <span class="font-semibold">${post.owner.username}</span>
      </div>
      <span class="text-sm text-gray-500">Updated: ${updatedDate}</span>
    </div>
    <h2 class="text-2xl font-bold">${post.title}</h2>
    <p class="mt-2 text-gray-700">${post.description}</p>
    ${ post.imageUrl ? `<img src="${post.imageUrl}" referrerpolicy="no-referrer" alt="Post Image" class="mt-4 rounded">` : "" }
  `;

  // If location exists, add a View Map button
  if (post.location && post.location.includes(":")) {
    document.getElementById("post-details").innerHTML += `
      <div class="mt-4 flex justify-end">
        <button onclick="toggleMap('${post.location}')" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
          View Map
        </button>
      </div>
      <div id="mapContainer" class="mt-4 hidden">
        <iframe id="mapFrame" width="100%" height="300" frameborder="0" style="border:0" allowfullscreen></iframe>
      </div>
    `;
  }

  // Show edit/delete buttons if current user is the owner
  if (currentUserId && currentUserId == post.owner.id) {
    document.getElementById("post-actions").innerHTML = `
      <button onclick="openEditPostModal()" class="bg-green-500 text-white px-4 py-2 rounded">Edit Post</button>
      <button onclick="openDeletePostModal('${post.id}')" class="bg-red-500 text-white px-4 py-2 rounded">Delete Post</button>
    `;
  } else {
    document.getElementById("post-actions").innerHTML = "";
  }

  // Build comments section with profile info (as before)
  const commentsContainer = document.getElementById("comments-container");
  commentsContainer.innerHTML = data.comments.map(comment => {
    const commenterPic = comment.user.profile_pic || "https://via.placeholder.com/40?text=No+Pic";
    const commentDate = new Date(comment.createdAt).toLocaleString();
    return `
      <div class="border-b pb-2">
        <div class="flex items-center mb-1">
          <img src="${commenterPic}" referrerpolicy="no-referrer" alt="${comment.user.username}'s avatar" class="w-6 h-6 rounded-full object-cover mr-2" />
          <span class="font-semibold">${comment.user.username}</span>
          <span class="ml-auto text-xs text-gray-500">${commentDate}</span>
        </div>
        <p class="ml-8 text-gray-700">${comment.content}</p>
      </div>
    `;
  }).join("");
  // Attach the confirm delete function to the modal's Delete button
document.getElementById('confirmDeletePostBtn').addEventListener('click', confirmDeletePost);
}
// Toggle the map display
function toggleMap(location) {
  const mapContainer = document.getElementById("mapContainer");
  const mapFrame = document.getElementById("mapFrame");

  // Expect location in the format "long:lat"
  let [long, lat] = location.split(":");
  // Remove any "deg" substrings and extra whitespace
  long = long.replace(" deg", "").trim();
  lat = lat.replace(" deg", "").trim();

  // Construct the URL using the provided format
  const gmapsUrl = `https://maps.google.com/maps?q=${lat},${long}&hl=es;z=14&output=embed`;
  mapFrame.src = gmapsUrl;
  mapContainer.classList.toggle("hidden");
}



if (window.location.pathname.includes("post.html")) {
  loadPostDetails();
}

async function addComment() {
  const params = getQueryParams();
  const postId = params.postId;
  const content = document.getElementById("comment-content").value;
  const res = await fetch(`${API_URL}/posts/${postId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ content })
  });
  const data = await res.json();
  if (res.ok) {
    window.location.reload();
  } else {
    document.getElementById("comment-msg").innerText =
      data.error || "Failed to add comment";
  }
}

async function savePostEdits() {
  const params = getQueryParams();
  const postId = params.postId;
  const newTitle = document.getElementById("edit-post-title").value.trim();
  const newDescription = document.getElementById("edit-post-description").value.trim();
  const newLocation = document.getElementById("edit-post-location").value.trim();
  const newImageUrl = document.getElementById("edit-post-imageUrl").value.trim();
  
  const res = await fetch(`${API_URL}/posts/${postId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`
    },
    body: JSON.stringify({ title: newTitle, description: newDescription, location: newLocation, imageUrl: newImageUrl })
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById("edit-post-msg").innerText = "Post updated successfully!";
    setTimeout(() => {
      closeEditPostModal();
      loadPostDetails();  // refresh the post details page
    }, 1000);
  } else {
    document.getElementById("edit-post-msg").innerText = data.error || "Failed to update post.";
  }
}



function editPost(postId) {
  openEditPostModal();
}


// Confirm deletion: called when the user clicks "Delete" in the modal
async function confirmDeletePost() {
  if (!postIdToDelete) return;
  const res = await fetch(`${API_URL}/posts/${postIdToDelete}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${getToken()}` }
  });
  if (res.ok) {
    document.getElementById('delete-post-msg').innerText = "Post deleted successfully!";
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1000);
  } else {
    document.getElementById('delete-post-msg').innerText = "Failed to delete post";
  }
}



/* =====================================================
   COMMUNITIES PAGE (List & Create)
===================================================== */
async function loadCommunities() {
  const res = await fetch(`${API_URL}/communities`);
  const communities = await res.json();
  const container = document.getElementById("communities-container");
  container.innerHTML = communities.map(c => `
    <div class="bg-white rounded-xl shadow-lg p-4">
      <h3 class="text-xl font-bold">${c.name}</h3>
      <p class="mt-2">${c.description}</p>
      <a href="community.html?communityId=${c.id}" class="inline-block mt-2 text-purple-600 font-semibold">View Community</a>
    </div>
  `).join("");
}

if (window.location.pathname.includes("communities.html")) {
  loadCommunities();
}

async function createCommunity() {
  const name = document.getElementById("community-name").value.trim();
  const description = document.getElementById("community-description").value.trim();
  // Get optional community logo URL
  const logo = document.getElementById("community-logo").value.trim();
  const res = await fetch(`${API_URL}/communities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`
    },
    body: JSON.stringify({ name, description, logo })
  });
  const data = await res.json();
  document.getElementById("community-create-msg").innerText = res.ok ? "Community created!" : (data.error || "Failed to create community");
  if (res.ok) {
    loadCommunities();
    closeCreateCommunityModal();
  }
}


/* =====================================================
   COMMUNITY DETAILS PAGE (View Community, Join/Exit)
===================================================== */
async function loadCommunityDetails() {
  const params = getQueryParams();
  const communityId = params.communityId;
  const res = await fetch(`${API_URL}/communities/${communityId}`);
  if (!res.ok) {
    document.getElementById("community-details").innerText = "Community not found";
    return;
  }
  const data = await res.json();
  const community = data.community;
  document.getElementById("community-details").innerHTML = `
    <h2 class="text-2xl font-bold">${community.name}</h2>
    <p class="mt-2">${community.description}</p>
    <div class="mt-4 space-x-2">
      <button onclick="joinCommunity('${community.id}')" class="bg-purple-600 text-white px-4 py-2 rounded">Join Community</button>
      <button onclick="exitCommunity('${community.id}')" class="bg-red-500 text-white px-4 py-2 rounded">Exit Community</button>
    </div>
  `;
  const postsContainer = document.getElementById("community-posts");
  postsContainer.innerHTML = data.posts.map(post => `
    <div class="bg-white rounded-xl shadow-lg p-4">
      <h3 class="text-xl font-bold">${post.title}</h3>
      <p class="mt-2">${post.description}</p>
      <a href="post.html?postId=${post.id}" class="inline-block mt-2 text-purple-600 font-semibold">View Post</a>
    </div>
  `).join("");
}

if (window.location.pathname.includes("community.html")) {
  loadCommunityDetails();
}

async function joinCommunity(communityId) {
  const res = await fetch(`${API_URL}/communities/${communityId}/join`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${getToken()}` }
  });
  const data = await res.json();
  alert(data.message || "Joined community");
  loadCommunityDetails();
}

async function exitCommunity(communityId) {
  const res = await fetch(`${API_URL}/communities/${communityId}/exit`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${getToken()}` }
  });
  const data = await res.json();
  alert(data.message || "Exited community");
  loadCommunityDetails();
}

/* =====================================================
   NOTIFICATIONS PAGE
===================================================== */
async function loadNotifications() {
  if (!getToken()) {
    window.location.href = "index.html";
    return;
  }
  const res = await fetch(`${API_URL}/notifications`, {
    headers: { "Authorization": `Bearer ${getToken()}` }
  });
  const notifications = await res.json();
  const container = document.getElementById("notifications-container");
  container.innerHTML = notifications.map(note => `
    <div class="bg-white rounded-xl shadow-lg p-4">
      <p>${note.message}</p>
      <p class="text-xs text-gray-600">${new Date(note.createdAt).toLocaleString()}</p>
    </div>
  `).join("");
}

if (window.location.pathname.includes("notifications.html")) {
  loadNotifications();
}

/* =====================================================
   USERS PAGE (User Search & Follow/Unfollow)
===================================================== */
async function loadUsers() {
  const res = await fetch(`${API_URL}/users`, { headers: { "Authorization": `Bearer ${getToken()}` } });
  const users = await res.json();
  const container = document.getElementById("users-container");
  container.innerHTML = users.map(u => `
    <div class="bg-white rounded-xl shadow-lg p-4 flex justify-between items-center">
      <div>
        <p class="font-bold">${u.username}</p>
        <p class="text-sm">${u.email}</p>
      </div>
      <button onclick="toggleFollow('${u.id}')" class="bg-purple-600 text-white px-4 py-2 rounded">Follow/Unfollow</button>
    </div>
  `).join("");
}

if (window.location.pathname.includes("users.html")) {
  loadUsers();
}

async function searchUsers() {
  const query = document.getElementById("user-search").value.trim();
  if (!query) {
    loadUsers();
    return;
  }
  const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, { headers: { "Authorization": `Bearer ${getToken()}` } });
  const users = await res.json();
  const container = document.getElementById("users-container");
  container.innerHTML = users.map(u => `
    <div class="bg-white rounded-xl shadow-lg p-4 flex justify-between items-center">
      <div>
        <p class="font-bold">${u.username}</p>
        <p class="text-sm">${u.email}</p>
      </div>
      <button onclick="toggleFollow('${u.id}')" class="bg-purple-600 text-white px-4 py-2 rounded">Follow/Unfollow</button>
    </div>
  `).join("");
}

async function toggleFollow(userId) {
  const res = await fetch(`${API_URL}/users/${userId}/follow`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${getToken()}` }
  });
  const data = await res.json();
  localStorage.setItem(userId,"Unfollow")
  loadUsers();
}

/* =====================================================
   LOGOUT FUNCTION
===================================================== */
function logout() {
  localStorage.removeItem("token");
  window.location.href = "index.html";
}

/* =====================================================
   SEARCH PAGE
===================================================== */
// Function to perform search using /posts/search endpoint
async function performSearch() {
  const query = document.getElementById("search-query").value.trim();
  if (!query) {
    document.getElementById("search-results").innerHTML = "<p class='text-gray-600'>Please enter a search term.</p>";
    return;
  }
  
  const res = await fetch(`${API_URL}/posts/search?q=${encodeURIComponent(query)}`);
  const posts = await res.json();
  const container = document.getElementById("search-results");
  
  if (!posts.length) {
    container.innerHTML = "<p class='text-gray-600'>No results found.</p>";
    return;
  }
  
  container.innerHTML = posts.map(post => {
    const updatedDate = new Date(post.updatedAt).toLocaleDateString();
    return `
      <div class="relative bg-white rounded-lg shadow-md p-4 overflow-hidden">
        <!-- Updated date -->
        <span class="absolute top-2 right-2 text-sm text-gray-500">Updated: ${updatedDate}</span>
        
        <!-- Image Container -->
        ${
          post.imageUrl
            ? `<div class="mt-8 h-48 overflow-hidden rounded-md">
                 <img src="${post.imageUrl}" referrerpolicy="no-referrer" alt="Post Image" class="object-cover w-full h-full">
               </div>`
            : `<div class="mt-8 h-48 bg-gray-200 rounded-md flex items-center justify-center text-gray-500">
                 No Image
               </div>`
        }
        
        <!-- Title & Description -->
        <h3 class="text-lg font-bold mt-4">${post.title}</h3>
        <p class="text-gray-700 text-sm mb-3">${post.description}</p>
        
        <!-- View Post Button -->
        <div class="flex justify-end">
          <button onclick="window.location.href='post.html?postId=${post.id}'" 
                  class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition">
            View Post
          </button>
        </div>
      </div>
    `;
  }).join("");
}




// Functions for Create Post Modal (Dashboard)
function openCreatePostModal() {
  document.getElementById('createPostModal').classList.remove('hidden');
}

function closeCreatePostModal() {
  document.getElementById('createPostModal').classList.add('hidden');
}
// Functions for Create Community Modal (Communities Page)
function openCreateCommunityModal() {
  document.getElementById('createCommunityModal').classList.remove('hidden');
}


function openEditProfileModal() {
  fetch(`${API_URL}/users/me`, {
    headers: { "Authorization": `Bearer ${getToken()}` }
  })
    .then(res => res.json())
    .then(user => {
      document.getElementById("edit-username").value = user.username || "";
      document.getElementById("edit-email").value = user.email || "";
      document.getElementById("edit-profile-pic").value = user.profile_pic || "";
      document.getElementById("editProfileModal").classList.remove("hidden");
    });
}

function openEditPostModal() {
  const params = getQueryParams();
  const postId = params.postId;
  fetch(`${API_URL}/posts/${postId}`, {
    headers: { "Authorization": `Bearer ${getToken()}` }
  })
    .then(res => res.json())
    .then(data => {
      const post = data.post;
      document.getElementById("edit-post-title").value = post.title;
      document.getElementById("edit-post-description").value = post.description;
      document.getElementById("edit-post-location").value = post.location || "";
      document.getElementById("edit-post-imageUrl").value = post.imageUrl || "";
      document.getElementById("editPostModal").classList.remove("hidden");
    });
}

// Open the custom delete modal and store the postId
function openDeletePostModal(postId) {
  postIdToDelete = postId;
  document.getElementById('delete-post-msg').innerText = "";
  document.getElementById('deletePostModal').classList.remove('hidden');
}

function closeCreateCommunityModal() {
  document.getElementById('createCommunityModal').classList.add('hidden');
}

function closeEditProfileModal() {
  document.getElementById("editProfileModal").classList.add("hidden");
}

function closeEditPostModal() {
  document.getElementById("editPostModal").classList.add("hidden");
}

// Close the custom delete modal and reset the postId variable
function closeDeletePostModal() {
  document.getElementById('deletePostModal').classList.add('hidden');
  postIdToDelete = null;
}

