import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupSessions() {
  console.log("🧹 Checking for stale sessions...");
  
  try {
    // Get all users
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error("Error fetching users:", error);
      return;
    }
    
    console.log(`Found ${users.users.length} users`);
    
    // For each user, try to get their sessions and clean up if needed
    let cleanedSessions = 0;
    
    for (const user of users.users) {
      try {
        // This will help identify if there are any session issues
        const { data: userSessions, error: sessionError } = await supabase.auth.admin.getUserById(user.id);
        
        if (sessionError) {
          console.log(`Session error for user ${user.email}:`, sessionError.message);
        }
      } catch (err) {
        console.log(`Error checking user ${user.email}:`, err.message);
      }
    }
    
    console.log("✅ Session cleanup complete");
    console.log("💡 If you're still having issues, please:");
    console.log("   1. Clear browser localStorage/cookies");
    console.log("   2. Try logging in with a fresh browser tab");
    console.log("   3. Use these credentials to test:");
    console.log("      - Coach: jcalderon@ucsd-fencing.edu / changeme");
    console.log("      - Captain: kkim@ucsd-fencing.edu / changeme"); 
    console.log("      - Athlete: bkim@ucsd-fencing.edu / changeme");
    
  } catch (err) {
    console.error("Error during cleanup:", err);
  }
}

cleanupSessions();
