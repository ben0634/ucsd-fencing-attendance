import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Replace with the Supabase user ID you want to edit
const userId = "43305218-8d20-4d6a-beac-7026071910b0";

// Update the metadata here
const newMetadata = {
  username: "araja",    // optional, can leave unchanged
  role: "captain",     // "athlete", "captain", or "coach"
  squad_id: 3,         // squad number
  first_name: "Arnav",
  last_name: "Raja"
};

async function updateMetadata() {
  try {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: newMetadata
    });

    if (error) {
      console.error("Error updating metadata:", error.message);
    } else {
      console.log("Metadata updated successfully:", data.user_metadata);
    }
  } catch (err) {
    console.error("Unexpected error:", err.message);
  }
}

updateMetadata();
