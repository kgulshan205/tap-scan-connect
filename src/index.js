const express = require("express");
//const bcrypt = require("bcrypt");
const path = require("path");
const CustomerModel = require("./config");
const session = require("express-session");
const crypto = require("crypto");
const http = require("http");
const socketIo = require("socket.io");

const fs = require("fs");

const { Users } = require("@azure/cosmos");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));

app.use("/images", express.static(__dirname + "/images"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

// Store active user sessions with their room IDs
const activeSessions = {};

// Generate a random secret key
const secretKey = crypto.randomBytes(32).toString("hex");

// Generate a unique room ID for the session
function generateRoomID() {
  return crypto.randomBytes(6).toString("hex").toUpperCase(); // Generating a 12-character room ID
}

// Middleware to prevent caching of sensitive pages
const preventCache = (req, res, next) => {};

// Use the generated secret key in the session configuration
app.use(
  session({
    secret: secretKey,
    resave: false,
    saveUninitialized: false,
  })
);

// User authentication middleware
const requireLogin = (req, res, next) => {
  if (req.session && req.session.user) {
    // User is authenticated, proceed to next middleware or route handler
    next();
  } else {
    // User is not authenticated, redirect to login page
    res.redirect("/login");
  }
};

// Define routes from the first project
app.get("/", (req, res) => {
  res.render("login");
});

app.get("/login", (req, res) => {
  // Clear the session to log out the user
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.status(500).send("Internal Server Error");
    } else {
      // Render the login page
      res.render("login");
    }
  });
});

app.get("/register", (req, res) => {
  // Render profile page (assuming profile.ejs)
  res.render("register");
});

app.post("/register", async (req, res) => {
  // Your registration logic here
  const data = {
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    mobile: req.body.mobile,
    vehiclenumber: req.body.vehiclenumber,
  };

  try {
    // Check if password and confirm password match
    if (data.password !== data.confirmPassword) {
      return res.send("Password and Confirm Password do not match.");
    }

    // Check if the email is already registered
    const existingUser = await CustomerModel.findOne({ email: data.email });
    if (existingUser) {
      // Email is already registered, display alert
      return res.render("register", { error: "Email is already registered." });
    }

    // Generate a unique room ID for the user
    const roomId = generateRoomID();

    // Create a new user with roomId
    const newUser = await CustomerModel.create({ ...data, roomId });

    // Store the room ID in the session
    req.session.roomId = roomId;

    console.log(newUser);
    //res.send("User registered successfully!");
    res.render("home");
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const user = await CustomerModel.findOne({ email: req.body.email });
    if (!user) {
      res.send("User with this email not found");
    } else {
      // Compare the plaintext password from the database with the password provided by the user
      const isPasswordMatch = req.body.password === user.password;
      if (!isPasswordMatch) {
        // Send response indicating incorrect password
        res.status(401).json({ error: "Incorrect password" });
      } else {
        // Set session variable to indicate user is logged in
        req.session.user = user;

        // If user doesn't have a roomId, generate one
        if (!user.roomId) {
          user.roomId = generateRoomID();
          await user.save();
        }

        // Store the user's room ID in the session
        req.session.roomId = user.roomId;

        res.render("home");
      }
    }
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Socket.IO logic
io.on("connection", (socket) => {
  console.log("New client connected");

  // Receive join room request from user
  socket.on("join room", (roomId) => {
    socket.join(roomId); // Join the room
  });

  // Receive message from a client
  socket.on("chat message", (data) => {
    const { roomId, message, sender } = data;
    io.to(roomId).emit("chat message", { message, sender }); // Broadcast message to all clients in the room
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

app.get("/home", requireLogin, (req, res) => {
  // Render home page (assuming home.ejs)
  res.render("home");
});

// Assuming you have a route handler for serving the public.html file
app.get("/public.html", (req, res) => {
  // Extract the roomId from the query parameters
  const roomId = req.query.roomId;

  // Render the public.html file and inject the roomId
  res.render("public", { roomId });
});

app.get("/about", requireLogin, (req, res) => {
  // Render about page (assuming about.ejs)
  res.render("about");
});

app.get("/contact", requireLogin, (req, res) => {
  // Render contact page (assuming contact.ejs)
  res.render("contact");
});

// Assuming you have already set up your Express app and connected to MongoDB using Mongoose

//post qr

// Assuming you have already defined your CustomerModel
const qrCode = require("qrcode");
const qr = require("qr-image");

app.post("/profile", requireLogin, async (req, res) => {
  try {
    const roomId = req.body.roomId;
    const publicUserLink = req.body.publicUserLink;
    // Fetch user details from MongoDB using Mongoose
    const user = await CustomerModel.findById(req.session.user._id);

    if (user) {
      // Construct the session data string for QR code generation
      const sessionData = `${user.name}, ${user.email}, ${user.vehicleNumber}, ${user.roomId}, ${user.vehiclenumber}, ${user.mobile}}`;

      // Generate the QR code
      const qrCodeData = await qrCode.toDataURL(sessionData);

      // Render the profile template and pass the user object and QR code data
      res.render("profile", { user, qrCodeData });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//QR code
// app.get("/profile", requireLogin, async (req, res) => {
//   try {
//     // Fetch user details from MongoDB using Mongoose
//     const user = await CustomerModel.findById(req.session.user._id);

//     if (user) {
//       // Construct the session data string for QR code generation
//       const sessionData = `${user.name}, ${user.email}, ${user.vehiclenumber}, ${user.roomId}, ${user.mobile}`;

//       // Generate the QR code
//       const qrCodeData = await qrCode.toDataURL(sessionData);

//       // Render the profile template and pass the user object and QR code data
//       res.render("profile", { user, qrCodeData });
//     } else {
//       res.status(404).json({ error: "User not found" });
//     }
//   } catch (error) {
//     console.error("Error fetching user profile:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

app.get("/profile", requireLogin, async (req, res) => {
  try {
    // Fetch user details from MongoDB using Mongoose
    const user = await CustomerModel.findById(req.session.user._id);

    if (user) {
      // Construct the session data string for QR code generation
      const sessionData = `${user.name}, ${user.email}, ${user.vehiclenumber}, ${user.roomId}, ${user.mobile}`;

      // Construct the link for the webpage with query parameters
      const roomId = user.roomId;
      const webpageLink = `/public.html?roomId=${roomId}`;

      // Add the link to the session data string
      const sessionDataWithLink = `${sessionData}, ${webpageLink}`;

      // Generate the QR code with the modified session data
      const qrCodeData = await qrCode.toDataURL(sessionDataWithLink);

      // Render the profile template and pass the user object and QR code data
      res.render("profile", { user, qrCodeData });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//logout
app.get("/logout", (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.status(500).send("Internal Server Error");
    } else {
      // Redirect to the login page after logout
      res.redirect("/login");
    }
  });
});

// Route to handle updating user profile
app.post("/profile", requireLogin, async (req, res) => {
  try {
    // Get the user ID from the session
    const userId = req.session.user._id;

    // Get the updated user data from the request body
    const updatedUserData = {
      name: req.body.name,
      email: req.body.email,
      vehiclenumber: req.body.vehiclenumber,
      mobile: req.body.mobile,
      // Add other fields as needed
    };

    // Update the user profile in MongoDB
    const updatedUser = await CustomerModel.findByIdAndUpdate(
      userId,
      updatedUserData,
      { new: true }
    );

    // Send a success response
    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/aboutll", (req, res) => {
  // Render profile page (assuming profile.ejs)
  res.render("aboutll");
});

app.get("/contactll", (req, res) => {
  // Render profile page (assuming profile.ejs)
  res.render("contactll");
});

///
app.post("/sendPublicUserLink", (req, res) => {
  // Retrieve the room ID and public user link from the request body
  const roomId = req.body.roomId;
  const publicUserLink = req.body.publicUserLink;

  // Do something with the room ID and public user link (e.g., store them in the database)
  console.log("Received room ID:", roomId);
  console.log("Received public user link:", publicUserLink);

  // Here you can perform database operations or any other necessary processing with the received data

  // Send response to the client
  res.sendStatus(200);
});

////

// Start the server
const port = process.env.PORT || 8080; // Use port 8080 if not provided by environment 8080
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
