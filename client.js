let socket;
let userInfo = {
  user_name: "",
  room: ""
};

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
    // Send initial join messages as JSON
    socket.send(JSON.stringify({
      type: "join",
      room: userInfo.room,
      user_name: userInfo.user_name
    }));
  };

  socket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === "total_users") {
      document.getElementById("number-of-users").innerHTML = `Number of users in room: ${data.number}`;
    } 
    else {
      reply(event.data);
    }
  };

  socket.onclose = function () {
    console.log("WebSocket connection closed.");
  };
}

// When page loads
window.onload = function () {
  const loginModal = document.getElementById('loginModal');
  loginModal.style.display = 'flex';

  // Form submission
  document.getElementById('loginForm').addEventListener('submit', function (e) {
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

      console.log("User joined room:", userInfo.room);
      console.log("user_name:", userInfo.user_name);

      socketConnect();
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
  document.getElementById('image-upload').addEventListener('change', function(e) {
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
    
    reader.onload = function(event) {
      // Get the ArrayBuffer
      const arrayBuffer = event.target.result;
      
      // Create preview in chat
      const chatBox = document.getElementById("chatBox");
      const messageElement = document.createElement("li");
      messageElement.classList.add("sent");
      
      // Create a temporary URL for the image preview
      const blob = new Blob([arrayBuffer], {type: file.type});
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

  // Send as a text message
  const textMessage = {
    type: "text",
    message: message
  };

  socket.send(JSON.stringify(textMessage));

  const chatBox = document.getElementById("chatBox");
  const messageElement = document.createElement("li");
  messageElement.classList.add("sent");
  messageElement.innerHTML = `<span style = "color:black;"><i><strong>YOU</strong></i></span> : ${message}`;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;

  input.value = "";
}

function reply(message) {

  message = JSON.parse(message);
  const chatBox = document.getElementById("chatBox");
  const reply_value = document.createElement("li");
  reply_value.classList.add("received");
  
  if (message.type === "image") {
    // handle image
    replyimage(message , reply_value);

  } 

  if (message.type === "message") {
    console.log(message);
    // Handle regular text message
    reply_value.innerHTML = `<span style = "color:black;"><i><strong>${message["user_name"]}</strong></i></span> : ${message["message"]}`;
  }

  chatBox.appendChild(reply_value);
  chatBox.scrollTop = chatBox.scrollHeight;
}