import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Replace with the Supabase user ID you want to edit
const userId = "87dd3c5c-5d27-4782-a863-e36ed4aaff2a"; // araja user ID

// Update the metadata here to match createUsers.js format
const newMetadata = {
  firstName: "Arnav",    // changed from first_name to match createUsers
  lastName: "Raja",      // changed from last_name to match createUsers
  username: "araja",     
  role: "coach",         // "athlete", "captain", or "coach"
  squadId: 3,           // changed from squad_id to squadId to match createUsers
  weapon: "epee",       // add weapon field to match createUsers
  gender: "male"        // add gender field to match createUsers
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
