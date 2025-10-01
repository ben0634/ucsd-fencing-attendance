import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function confirmAllUsers() {
  // Fetch all users
  const { data: users, error: fetchError } = await supabase.auth.admin.listUsers();
  if (fetchError) {
    console.error("Error fetching users:", fetchError.message);
    return;
  }

  // Confirm each user
  for (const user of users) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true
    });
    if (error) console.error(`Error confirming ${user.id}:`, error.message);
    else console.log(`Confirmed user: ${user.email}`);
  }

  console.log("All users confirmed!");
}

confirmAllUsers();
