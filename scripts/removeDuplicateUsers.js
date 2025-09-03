import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function removeDuplicateUsers() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Error fetching users:", error.message);
    return;
  }

  // Group users by full name to find duplicates
  const usersByName = {};
  
  users.users.forEach(user => {
    const metadata = user.user_metadata;
    if (metadata && metadata.firstName && metadata.lastName) {
      const fullName = `${metadata.firstName} ${metadata.lastName}`;
      if (!usersByName[fullName]) {
        usersByName[fullName] = [];
      }
      usersByName[fullName].push(user);
    }
  });

  // Find and remove duplicates - keep the one with the simpler username
  for (const [fullName, userList] of Object.entries(usersByName)) {
    if (userList.length > 1) {
      console.log(`Found ${userList.length} duplicates for ${fullName}:`);
      userList.forEach(user => {
        console.log(`  - ${user.user_metadata.username} (${user.email})`);
      });

      // Keep the user with the shortest/simplest username (no numbers)
      userList.sort((a, b) => {
        const usernameA = a.user_metadata.username;
        const usernameB = b.user_metadata.username;
        
        // Prefer usernames without numbers
        const aHasNumbers = /\d/.test(usernameA);
        const bHasNumbers = /\d/.test(usernameB);
        
        if (aHasNumbers && !bHasNumbers) return 1;
        if (!aHasNumbers && bHasNumbers) return -1;
        
        // If both have numbers or both don't, prefer shorter
        return usernameA.length - usernameB.length;
      });

      const keepUser = userList[0];
      const removeUsers = userList.slice(1);

      console.log(`  Keeping: ${keepUser.user_metadata.username}`);
      
      for (const userToRemove of removeUsers) {
        console.log(`  Removing: ${userToRemove.user_metadata.username}`);
        
        try {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(userToRemove.id);
          if (deleteError) {
            console.error(`    Failed to delete ${userToRemove.user_metadata.username}:`, deleteError.message);
          } else {
            console.log(`    Successfully deleted ${userToRemove.user_metadata.username}`);
          }
        } catch (err) {
          console.error(`    Error deleting ${userToRemove.user_metadata.username}:`, err);
        }
      }
      console.log('');
    }
  }

  console.log("Duplicate cleanup complete.");
}

removeDuplicateUsers();
