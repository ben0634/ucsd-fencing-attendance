import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function removeDuplicateKimCogan() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Error fetching users:", error.message);
    return;
  }

  // Find Ryan Kim-Cogan duplicates
  const kimCoganUsers = users.users.filter(user => {
    const metadata = user.user_metadata;
    return metadata && metadata.firstName === 'Ryan' && metadata.lastName === 'Kim-Cogan';
  });

  if (kimCoganUsers.length > 1) {
    console.log(`Found ${kimCoganUsers.length} duplicates for Ryan Kim-Cogan:`);
    kimCoganUsers.forEach(user => {
      console.log(`  - ${user.user_metadata.username} (${user.email})`);
    });

    // Keep the one without numbers
    const keepUser = kimCoganUsers.find(user => !user.user_metadata.username.includes('2')) || kimCoganUsers[0];
    const removeUsers = kimCoganUsers.filter(user => user.id !== keepUser.id);

    console.log(`Keeping: ${keepUser.user_metadata.username}`);
    
    for (const userToRemove of removeUsers) {
      console.log(`Removing: ${userToRemove.user_metadata.username}`);
      
      try {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userToRemove.id);
        if (deleteError) {
          console.error(`Failed to delete ${userToRemove.user_metadata.username}:`, deleteError.message);
        } else {
          console.log(`Successfully deleted ${userToRemove.user_metadata.username}`);
        }
      } catch (err) {
        console.error(`Error deleting ${userToRemove.user_metadata.username}:`, err);
      }
    }
  }

  console.log("Kim-Cogan cleanup complete.");
}

removeDuplicateKimCogan();
