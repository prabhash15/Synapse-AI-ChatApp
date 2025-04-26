let socket;
let userInfo = {
  user_name: "",
  room: ""
};


function base64ToBinary(base64) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

function replyimage(message, reply_image) {
  const arrayBuffer = new Uint8Array(message.data).buffer;
  const blob = new Blob([arrayBuffer], { type: message.fileType });
  const imageUrl = URL.createObjectURL(blob);

  reply_image.innerHTML = `<span style = "color:black;"><i><strong>${message.user_name}</strong></i></span> : <div class="upload-indicator"></div>`;

  // Create an anchor element that wraps the image
  const link = document.createElement('a');
  link.href = imageUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const img = document.createElement('img');
  img.src = imageUrl;
  img.className = 'image-message';

  link.appendChild(img); // wrap image in the link
  reply_image.appendChild(link);
}



function socketConnect() {
  socket = new WebSocket("ws://localhost:8000/ws/chat");

  socket.onopen = function () {
    console.log("WebSocket connection established.");
  };

  socket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === "total_users") {
      document.getElementById("number-of-users").innerHTML = `Users in room: ${data.number}`;
      document.getElementById("number-of-users").style.display = 'inline-block';
    }
    if (data.type === "joined") {
      // Add system message to chat for user joining
      const chatBox = document.getElementById("chatBox");
      const joinMessage = document.createElement("li");
      joinMessage.classList.add("system-message");
      joinMessage.innerHTML = `<span class="user-notification">${data.user_name} joined the room</span>`;
      chatBox.appendChild(joinMessage);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    if (data.type === "left") {
      // Add system message to chat for user leaving
      const chatBox = document.getElementById("chatBox");
      const leaveMessage = document.createElement("li");
      leaveMessage.classList.add("system-message");
      leaveMessage.innerHTML = `<span class="user-notification">${data.user_name} left the room</span>`;
      chatBox.appendChild(leaveMessage);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    if (data.type === "image" || data.type === "message") {
      reply(event.data);
    }
    if (data.type === "room_created") {
      // Handle room creation response
      document.getElementById("generatedRoomId").innerText = data.room_id;
    }
    if (data.type === "audio") {
      // Handle received audio
      handleReceivedAudio(data);
    }
  };

  socket.onclose = function () {
    console.log("WebSocket connection closed.");
  };
}

// Handle received audio from server
function handleReceivedAudio(data) {
  // Hide loading indicator if it exists
  const loadingIndicator = document.querySelector('.youtube-loading');
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
  //convert the BASE64 data to BINARY

  binary_data  = base64ToBinary(data.audio_data);

  // Convert the binary data to a Blob
  const arrayBuffer = new Uint8Array(binary_data).buffer;
  const blob = new Blob([arrayBuffer], { type: 'audio/mp3' }); // Assuming the server converts to MP3
  const audioUrl = URL.createObjectURL(blob);

  // Set the audio player's source and show it
  const audioPlayer = document.getElementById('audio-player');
  audioPlayer.src = audioUrl;
  
  // Show the audio player container
  const audioPlayerContainer = document.getElementById('audio-player-container');
  audioPlayerContainer.style.display = 'block';
  
  // Add a message to the chat
  const chatBox = document.getElementById("chatBox");
  const messageElement = document.createElement("li");
  messageElement.classList.add("received");
  messageElement.innerHTML = `<span style="color:black;"><i><strong>System</strong></i></span>: Audio extracted from YouTube link: ${data.youtube_url}`;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Send YouTube link to server
function sendYoutubeLink() {
  const youtubeLink = document.getElementById('youtube-link').value.trim();
  
  if (!youtubeLink) {
    alert('Please enter a valid YouTube link');
    return;
  }
  
  // Check if it's a valid YouTube URL (basic check)
  if (!youtubeLink.includes('youtube.com/') && !youtubeLink.includes('youtu.be/')) {
    alert('Please enter a valid YouTube URL');
    return;
  }
  
  // Show loading indicator
  const youtubeContainer = document.querySelector('.youtube-container');
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'youtube-loading';
  loadingIndicator.textContent = 'Extracting audio from YouTube video...';
  youtubeContainer.appendChild(loadingIndicator);
  
  // Send the YouTube link to the server
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "youtube_link",
      url: youtubeLink,
      user_name: userInfo.user_name,
      room: userInfo.room
    }));
    
    // Clear the input
    document.getElementById('youtube-link').value = '';
    
    // Add message to chat
    const chatBox = document.getElementById("chatBox");
    const messageElement = document.createElement("li");
    messageElement.classList.add("sent");
    messageElement.innerHTML = `<span style="color:black;"><i><strong>YOU</strong></i></span>: Requested audio extraction from: ${youtubeLink}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

// Request a room ID from server
function requestRoomId() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "create_room"
    }));
  }
}

// When page loads - Starting point
window.onload = function () {
  const loginModal = document.getElementById('loginModal');
  loginModal.style.display = 'flex';

  // Show option selection by default
  const optionSelection = document.getElementById('optionSelection');
  const createRoomForm = document.getElementById('createRoomForm');
  const joinRoomForm = document.getElementById('joinRoomForm');
  
  // Connect to socket for room ID generation
  socketConnect();

  // Button event listeners
  document.getElementById('createRoomBtn').addEventListener('click', function() {
    optionSelection.style.display = 'none';
    createRoomForm.style.display = 'block';
    
    // Request room ID from server
    requestRoomId();
  });

document.getElementById('copyRoomId').addEventListener('click', function() {
  copyRoomIdToClipboard();
});

  document.getElementById('joinRoomBtn').addEventListener('click', function() {
    optionSelection.style.display = 'none';
    joinRoomForm.style.display = 'block';
  });

  document.getElementById('backFromCreate').addEventListener('click', function() {
    createRoomForm.style.display = 'none';
    optionSelection.style.display = 'block';
  });

  document.getElementById('backFromJoin').addEventListener('click', function() {
    joinRoomForm.style.display = 'none';
    optionSelection.style.display = 'block';
  });

  // YouTube link event listener
  document.getElementById('send-youtube-btn').addEventListener('click', function() {
    sendYoutubeLink();
  });
  
  // Add "Enter key" listener to YouTube input
  document.getElementById('youtube-link').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendYoutubeLink();
    }
  });

  // Create Room Form submission
  document.getElementById('createRoomForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const userName = document.getElementById('createUserName').value.trim();
    const roomId = document.getElementById('generatedRoomId').innerText.trim();

    if (!userName) {
      document.getElementById('createUserNameError').style.display = 'block';
      return;
    } else {
      document.getElementById('createUserNameError').style.display = 'none';
    }

    if (roomId === "Generating room ID...") {
      alert("Please wait for room ID generation");
      return;
    }

    userInfo.room = roomId;
    userInfo.user_name = userName;
    loginModal.style.display = 'none';

    // Update chat name with room ID
    document.getElementById("chat-name").innerHTML = `<h1>Room: ${userInfo.room}</h1>`;
    document.getElementById("chat-name").style.display = 'block';

    console.log("User created and joined room:", userInfo.room);
    console.log("user_name:", userInfo.user_name);

    // Socket is already connected from earlier, just need to join the room
    socket.send(JSON.stringify({
      type: "join",
      room: userInfo.room,
      user_name: userInfo.user_name
    }));
  });

  // Join Room Form submission
  document.getElementById('joinRoomForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const roomId = document.getElementById('roomId').value.trim();
    const userName = document.getElementById('userName').value.trim();

    let isValid = true;

    if (!roomId) {
      document.getElementById('roomIdError').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('roomIdError').style.display = 'none';
    }

    if (!userName) {
      document.getElementById('userNameError').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('userNameError').style.display = 'none';
    }

    if (isValid) {
      userInfo.room = roomId;
      userInfo.user_name = userName;
      loginModal.style.display = 'none';

      // Update chat name with room ID
      document.getElementById("chat-name").innerHTML = `<h1>Room: ${userInfo.room}</h1>`;
      document.getElementById("chat-name").style.display = 'block';

      console.log("User joined room:", userInfo.room);
      console.log("user_name:", userInfo.user_name);

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        socketConnect();
      } else {
        // If socket is already open, just join the room
        socket.send(JSON.stringify({
          type: "join",
          room: userInfo.room,
          user_name: userInfo.user_name
        }));
      }
    }
  });

  // Add "Enter key" listener to message input
  document.getElementById('message').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();  // Prevent new line if it's a textarea (not needed in input, but safe)
      sendMessage();
    }
  });

  // Add event listener for image upload
  document.getElementById('image-upload').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.match('image.*')) {
      alert('Please select an image file');
      return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
      // Get the ArrayBuffer
      const arrayBuffer = event.target.result;

      // Create preview in chat
      const chatBox = document.getElementById("chatBox");
      const messageElement = document.createElement("li");
      messageElement.classList.add("sent");

      // Create a temporary URL for the image preview
      const blob = new Blob([arrayBuffer], { type: file.type });
      const imageUrl = URL.createObjectURL(blob);

      // Add image to chat
      messageElement.innerHTML = `<span style = "color:black;"> <i><strong>YOU</strong></i></span> : <div class="upload-indicator"></div>`;
      const img = document.createElement('img');
      img.src = imageUrl;
      img.className = 'image-message';
      messageElement.appendChild(img);

      chatBox.appendChild(messageElement);
      chatBox.scrollTop = chatBox.scrollHeight;

      // Send the image via WebSocket
      if (socket && socket.readyState === WebSocket.OPEN) {
        // Create a message object with type "image"
        const message = {
          type: "image",
          filename: file.name,
          fileType: file.type,
          data: Array.from(new Uint8Array(arrayBuffer)),
          user_name: userInfo.user_name,
        };
        socket.send(JSON.stringify(message));
      }
    };

    reader.readAsArrayBuffer(file);

    // Reset the file input
    this.value = '';
  });
};

function sendMessage() {
  const input = document.getElementById("message");
  const message = input.value.trim();

  if (message === "") return;

  const textMessage = {
    type: "text",
    message: message
  };

  socket.send(JSON.stringify(textMessage));

  const chatBox = document.getElementById("chatBox");
  const messageElement = document.createElement("li");
  messageElement.classList.add("sent");
  
  // Create username element
  const usernameSpan = document.createElement("span");
  usernameSpan.className = "message-username";
  usernameSpan.textContent = "YOU";
  messageElement.appendChild(usernameSpan);
  
  // Create message content
  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.textContent = message;
  messageElement.appendChild(contentDiv);
  
  // Add with animation
  chatBox.appendChild(messageElement);
  
  // Smooth scroll with small delay to let animation start
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 50);

  // Clear input with a nice effect
  input.value = "";
  input.focus();
}



function reply(message) {
  message = JSON.parse(message);
  const chatBox = document.getElementById("chatBox");
  const reply_value = document.createElement("li");
  reply_value.classList.add("received");

  // Create username element
  const usernameSpan = document.createElement("span");
  usernameSpan.className = "message-username";
  usernameSpan.textContent = message["user_name"];
  reply_value.appendChild(usernameSpan);

  // Create message content container
  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";

  if (message.AIresponse) {
    contentDiv.innerHTML = message.message;
  }

  if (message.type === "image") {
    // Handle image message
    const arrayBuffer = new Uint8Array(message.data).buffer;
    const blob = new Blob([arrayBuffer], { type: message.fileType });
    const imageUrl = URL.createObjectURL(blob);

    // Create an anchor element that wraps the image
    const link = document.createElement('a');
    link.href = imageUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'image-message';

    link.appendChild(img); // wrap image in the link
    contentDiv.appendChild(link);
  }
  
  else if (message.type === "message" && !(message.AIresponse)) {
    // Handle regular text message
    contentDiv.textContent = message["message"];
  }

  // Add the content to the message element
  reply_value.appendChild(contentDiv);

  
  chatBox.appendChild(reply_value);
  
  // Ensure smooth scroll to bottom
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 50);
}

// Add this function to your client.js file
function copyRoomIdToClipboard() {
  const roomId = document.getElementById('generatedRoomId').innerText.trim();
  
  if (roomId === "Generating room ID...") {
    return; // Don't copy if the room ID isn't ready
  }
  
  // Copy to clipboard
  navigator.clipboard.writeText(roomId)
    .then(() => {
      // Show "Copied!" tooltip
      const tooltip = document.getElementById('copyTooltip');
      tooltip.classList.add('show');
      
      // Hide tooltip after 2 seconds
      setTimeout(() => {
        tooltip.classList.remove('show');
      }, 2000);
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
      alert('Failed to copy room ID');
    });
}
