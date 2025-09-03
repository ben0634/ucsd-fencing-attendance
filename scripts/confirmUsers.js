import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function confirmAllUsers() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error.message);
    return;
  }
  for (const user of data.users) {
    const { error: confirmError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true
    });
    if (confirmError) console.error(`Error confirming ${user.id}:`, confirmError.message);
    else console.log(`Confirmed user ${user.id}`);
  }
}

confirmAllUsers();
