import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAllUsers() {
  try {
    // First, get all users
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error("Error listing users:", error.message);
      return;
    }

    if (data.users.length === 0) {
      console.log("No users found to delete.");
      return;
    }

    console.log(`Found ${data.users.length} users. Deleting all...`);

    // Delete each user
    for (const user of data.users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      
      if (deleteError) {
        console.error(`Error deleting user ${user.email}:`, deleteError.message);
      } else {
        console.log(`Deleted user: ${user.email} (${user.user_metadata?.username || 'N/A'})`);
      }
    }

    console.log("All users deleted successfully!");
    
  } catch (err) {
    console.error("Unexpected error:", err.message);
  }
}

// Uncomment the line below to run the script
deleteAllUsers();

console.log("⚠️  WARNING: This script will delete ALL users from your Supabase project!");
console.log("Deleting all users now...");
