let socket;
let userInfo = {
  user_name: "",
  room: ""
};

// State to store audio and thumbnail data
let youtubeState = {
  audioUrl: null,
  thumbnailUrl: null,
  videoTitle: null
};

function base64ToBinary(base64) {
  console.log('binary length:', base64.length);
  if (base64.length < 1000) { 
    console.error('Audio data too small! Not building blob.');
    return; 
  }
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

  const usernameSpan = document.createElement("span");
  usernameSpan.className = "message-username";
  usernameSpan.textContent = message.user_name;
  reply_image.appendChild(usernameSpan);

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";

  const link = document.createElement('a');
  link.href = imageUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const img = document.createElement('img');
  img.src = imageUrl;
  img.className = 'image-message';

  link.appendChild(img);
  contentDiv.appendChild(link);
  reply_image.appendChild(contentDiv);
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
      document.getElementById("number-of-users").style.display = 'block';
      
      const connectedUsers = document.getElementById("connected-users");
      if (data.users) {
        connectedUsers.innerHTML = data.users.map(user => `
          <div class="user-item" id="user-${user.replace(/\s+/g, '-')}">
            <div class="user-avatar">${user.charAt(0).toUpperCase()}</div>
            <div class="user-name">${user}</div>
          </div>
        `).join('');
        connectedUsers.style.display = 'flex';
        connectedUsers.classList.add('visible');
      }
    }
    if (data.type === "joined") {
      const chatBox = document.getElementById("chatBox");
      const joinMessage = document.createElement("li");
      joinMessage.classList.add("system-message");
      joinMessage.innerHTML = `<span class="user-notification">${data.user_name} joined the room</span>`;
      chatBox.appendChild(joinMessage);
      chatBox.scrollTop = chatBox.scrollHeight;
    }
    if (data.type === "left") {
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
      document.getElementById("generatedRoomId").innerText = data.room_id;
    }
    if (data.type === "audio") {
      handleReceivedAudio(data);
    }
    if (data.type === "thumbnail") {
      handleReceivedThumbnail(data);
    }
  };

  socket.onclose = function () {
    console.log("WebSocket connection closed.");
  };
}

async function handleReceivedAudio(data) {
  try {
    const binaryData = base64ToBinary(data.audio_data);
    console.log("GOT AUDIO DATA");
    const uint8Array = new Uint8Array(binaryData);
    const blob = new Blob([uint8Array], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(blob);

    // Store audio URL
    youtubeState.audioUrl = audioUrl;

    // Update the audio section
    updateAudioSection();
  } catch (error) {
    console.error("Failed to handle received audio:", error);
    const loadingIndicator = document.querySelector('.youtube-loading');
    if (loadingIndicator) {
      loadingIndicator.textContent = 'Failed to load audio';
    }
  }
}

function handleReceivedThumbnail(data) {
  try {
    // Convert thumbnail_data (list of bytes) to Blob
    const uint8Array = new Uint8Array(data.thumbnail_data);
    const blob = new Blob([uint8Array], { type: 'image/jpeg' }); // Assuming JPEG, adjust if needed
    const thumbnailUrl = URL.createObjectURL(blob);

    // Store thumbnail URL and title
    youtubeState.thumbnailUrl = thumbnailUrl;
    youtubeState.videoTitle = data.title;

    // Update the audio section
    updateAudioSection();
  } catch (error) {
    console.error("Failed to handle received thumbnail:", error);
    // Fallback: hide thumbnail or show placeholder
    youtubeState.thumbnailUrl = null;
    updateAudioSection();
  }
}

function updateAudioSection() {
  // Check if at least audio is available
  if (!youtubeState.audioUrl) return;

  // Remove loading indicator
  const loadingIndicator = document.querySelector('.youtube-loading');
  if (loadingIndicator) {
    loadingIndicator.remove();
  }

  // Update audio player
  const audioPlayer = document.getElementById('audio-player');
  if (!audioPlayer) {
    console.error("Audio player element not found!");
    return;
  }
  audioPlayer.src = youtubeState.audioUrl;
  audioPlayer.load();

  // Update thumbnail and title
  const thumbnailImage = document.getElementById('thumbnail-image');
  const videoTitle = document.getElementById('video-title');
  if (youtubeState.thumbnailUrl) {
    thumbnailImage.src = youtubeState.thumbnailUrl;
    thumbnailImage.style.display = 'block';
  } else {
    thumbnailImage.style.display = 'none';
  }
  videoTitle.textContent = youtubeState.videoTitle || 'Unknown Title';

  // Show audio player container
  const audioPlayerContainer = document.getElementById('audio-player-container');
  if (audioPlayerContainer) {
    audioPlayerContainer.style.display = 'block';
    
    // Initialize waveform
    const waveform = document.getElementById('waveform');
    waveform.innerHTML = Array(10).fill().map(() => '<div></div>').join('');
    
    // Update waveform animation based on play state
    audioPlayer.addEventListener('play', () => {
      waveform.classList.add('playing');
    });
    audioPlayer.addEventListener('pause', () => {
      waveform.classList.remove('playing');
    });
  }

  // Initialize custom player controls
  initializeAudioPlayer();

  // Reset state for next audio
  youtubeState = {
    audioUrl: null,
    thumbnailUrl: null,
    videoTitle: null
  };
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function initializeAudioPlayer() {
  const audio = document.getElementById('audio-player');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const playIcon = playPauseBtn.querySelector('.play-icon');
  const pauseIcon = playPauseBtn.querySelector('.pause-icon');
  const seekBar = document.getElementById('seek-bar');
  const currentTime = document.getElementById('current-time');
  const duration = document.getElementById('duration');
  const volumeBtn = document.getElementById('volume-btn');
  const volumeBar = document.getElementById('volume-bar');

  // Update duration
  audio.addEventListener('loadedmetadata', () => {
    duration.textContent = formatTime(audio.duration);
    seekBar.max = audio.duration;
  });

  // Update current time and seek bar
  audio.addEventListener('timeupdate', () => {
    currentTime.textContent = formatTime(audio.currentTime);
    seekBar.value = audio.currentTime;
  });

  // Play/Pause toggle
  playPauseBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    } else {
      audio.pause();
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }
  });

  // Seek
  seekBar.addEventListener('input', () => {
    audio.currentTime = seekBar.value;
  });

  // Volume control
  volumeBtn.addEventListener('click', () => {
    volumeBar.style.display = volumeBar.style.display === 'none' ? 'block' : 'none';
  });

  volumeBar.addEventListener('input', () => {
    audio.volume = volumeBar.value / 100;
  });

  // Reset on audio end
  audio.addEventListener('ended', () => {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    seekBar.value = 0;
    currentTime.textContent = '0:00';
  });
}

function sendYoutubeLink() {
  const youtubeLink = document.getElementById('youtube-link').value.trim();
  if (!youtubeLink) {
    alert('Please enter a valid YouTube link');
    return;
  }
  if (!youtubeLink.includes('youtube.com/') && !youtubeLink.includes('youtu.be/')) {
    alert('Please enter a valid YouTube URL');
    return;
  }
  const youtubeContainer = document.querySelector('.youtube-container');
  
  // Remove existing loading indicator
  const existingLoading = document.querySelector('.youtube-loading');
  if (existingLoading) {
    existingLoading.remove();
  }
  
  // Add new loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'youtube-loading';
  loadingIndicator.textContent = 'Extracting audio from YouTube video...';
  youtubeContainer.appendChild(loadingIndicator);
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "youtube_link",
      url: youtubeLink,
      user_name: userInfo.user_name,
      room: userInfo.room
    }));
  }
}

function requestRoomId() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "create_room"
    }));
  }
}

window.onload = function () {
  const loginModal = document.getElementById('loginModal');
  loginModal.style.display = 'flex';
  const optionSelection = document.getElementById('optionSelection');
  const createRoomForm = document.getElementById('createRoomForm');
  const joinRoomForm = document.getElementById('joinRoomForm');
  socketConnect();

  document.getElementById('createRoomBtn').addEventListener('click', function() {
    optionSelection.style.display = 'none';
    createRoomForm.style.display = 'block';
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

  document.getElementById('send-youtube-btn').addEventListener('click', function() {
    sendYoutubeLink();
  });

  document.getElementById('youtube-link').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendYoutubeLink();
    }
  });

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
    document.getElementById("app-title").classList.add('visible');
    document.getElementById("chat-name").innerHTML = `<h1>Room ID: ${userInfo.room}</h1>`;
    document.getElementById("chat-name").style.display = 'block';
    console.log("User created and joined room:", userInfo.room);
    console.log("user_name:", userInfo.user_name);
    socket.send(JSON.stringify({
      type: "join",
      room: userInfo.room,
      user_name: userInfo.user_name
    }));
    const chatLoading = document.getElementById('chat-loading');
    chatLoading.style.display = 'block';
    setTimeout(() => {
      chatLoading.style.display = 'none';
    }, 1000);
  });

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
      document.getElementById("app-title").classList.add('visible');
      document.getElementById("chat-name").innerHTML = `<h1>Room: ${userInfo.room}</h1>`;
      document.getElementById("chat-name").style.display = 'block';
      console.log("User joined room:", userInfo.room);
      console.log("user_name:", userInfo.user_name);
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        socketConnect();
      } else {
        socket.send(JSON.stringify({
          type: "join",
          room: userInfo.room,
          user_name: userInfo.user_name
        }));
      }
      const chatLoading = document.getElementById('chat-loading');
      chatLoading.style.display = 'block';
      setTimeout(() => {
        chatLoading.style.display = 'none';
      }, 1000);
    }
  });

  document.getElementById('message').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('image-upload').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match('image.*')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = function (event) {
      const arrayBuffer = event.target.result;
      const chatBox = document.getElementById("chatBox");
      const messageElement = document.createElement("li");
      messageElement.classList.add("sent");
      
      const usernameSpan = document.createElement("span");
      usernameSpan.className = "message-username";
      usernameSpan.textContent = "YOU";
      messageElement.appendChild(usernameSpan);

      const contentDiv = document.createElement("div");
      contentDiv.className = "message-content";
      
      const blob = new Blob([arrayBuffer], { type: file.type });
      const imageUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = imageUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      const img = document.createElement('img');
      img.src = imageUrl;
      img.className = 'image-message';
      
      link.appendChild(img);
      contentDiv.appendChild(link);
      messageElement.appendChild(contentDiv);
      
      chatBox.appendChild(messageElement);
      chatBox.scrollTop = chatBox.scrollHeight;
      
      if (socket && socket.readyState === WebSocket.OPEN) {
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
  const usernameSpan = document.createElement("span");
  usernameSpan.className = "message-username";
  usernameSpan.textContent = "YOU";
  messageElement.appendChild(usernameSpan);
  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.textContent = message;
  messageElement.appendChild(contentDiv);
  chatBox.appendChild(messageElement);
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 50);
  input.value = "";
  input.focus();
}

function reply(message) {
  message = JSON.parse(message);
  const chatBox = document.getElementById("chatBox");
  const reply_value = document.createElement("li");
  reply_value.classList.add("received");

  if (message.type === "image") {
    replyimage(message, reply_value);
  } else {
    const usernameSpan = document.createElement("span");
    usernameSpan.className = "message-username";
    usernameSpan.textContent = message["user_name"];
    reply_value.appendChild(usernameSpan);

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    if (message.AIresponse) {
      contentDiv.innerHTML = message.message;
    } else if (message.type === "message") {
      contentDiv.textContent = message["message"];
    }
    reply_value.appendChild(contentDiv);
  }

  chatBox.appendChild(reply_value);
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 50);
}

function copyRoomIdToClipboard() {
  const roomId = document.getElementById('generatedRoomId').innerText.trim();
  if (roomId === "Generating room ID...") {
    return;
  }
  navigator.clipboard.writeText(roomId)
    .then(() => {
      const tooltip = document.getElementById('copyTooltip');
      tooltip.classList.add('show');
      setTimeout(() => {
        tooltip.classList.remove('show');
      }, 2000);
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
      alert('Failed to copy room ID');
    });
}