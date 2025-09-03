import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listUsers() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error.message);
    return;
  }
  
  console.log("Users in database:");
  data.users.forEach(user => {
    console.log(`ID: ${user.id}, Email: ${user.email}, Username: ${user.user_metadata?.username || 'N/A'}`);
  });
}

listUsers();
