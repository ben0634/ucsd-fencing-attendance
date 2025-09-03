import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listUsers() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Error fetching users:", error.message);
    return;
  }

  console.log("Current users in database:");
  console.log("Email | Username | Name | Role");
  console.log("------|----------|------|-----");
  
  users.users.forEach(user => {
    const metadata = user.user_metadata;
    console.log(`${user.email} | ${metadata.username} | ${metadata.firstName} ${metadata.lastName} | ${metadata.role}`);
  });
  
  console.log(`\nTotal users: ${users.users.length}`);
}

listUsers();
