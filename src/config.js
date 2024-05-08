const mongoose = require("mongoose");

const config = {
  dbName: "tappayscan",
  connectionString:
    "mongodb+srv://kgulshan205:123%40Golu@tappayscan.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000", // Replace this with your actual connection string
};

// Connect to Cosmos DB
mongoose
  .connect(config.connectionString)
  .then(() => {
    console.log("Database Connected Successfully");
  })
  .catch((error) => {
    console.error("Database Connection Error:", error);
  });

/// Define schema
const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  vehiclenumber: {
    type: String,
    required: false, // Make optional
  },
  mobile: {
    type: String,
    required: false, // Make optional
  },
  roomId: {
    type: String,
    default: function () {
      // Auto-generate room ID
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    },
    unique: true,
  },
  // Define other fields
});

// Create model
const CustomerModel = mongoose.model("Customer", customerSchema);

module.exports = CustomerModel;
