let subMenu = document.getElementById("subMenu");

function toggleMenu() {
  subMenu.classList.toggle("open-menu");
}

/*CHATBOX JS */

// script.js

function sendMessage() {
  const inputElement = document.querySelector("input");
  const messageText = inputElement.value;

  if (messageText.trim() !== "") {
    const messagesContainer = document.getElementById("messages");
    const newMessage = document.createElement("div");
    newMessage.className = "message sent";
    newMessage.textContent = messageText;
    messagesContainer.appendChild(newMessage);

    inputElement.value = "";

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

//bacnkend js for chatboc
