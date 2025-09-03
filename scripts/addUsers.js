import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Track usernames to avoid duplicates (optional, can fetch from Supabase if needed)
const existingUsernames = new Set();

function generateUsername(first, last) {
  let username = (first[0] + last).toLowerCase();
  let i = 1;
  while (existingUsernames.has(username)) {
    i++;
    username = (first[0] + last + i).toLowerCase();
  }
  existingUsernames.add(username);
  return username;
}

// Create a single user
async function addUser(first, last, password, role, squad_id) {
  const username = generateUsername(first, last);
  const email = `${username}@example.com`;

  // Check if user exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  if (existingUsers.users && existingUsers.users.find(u => u.email === email)) {
    console.log(`User ${username} already exists!`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { username, role, squad_id, first_name: first, last_name: last },
  });

  if (error) console.error("Error:", error.message);
  else console.log("Created user:", username);
}

addUser("Henry", "Liang", "changeme", "coach", 6);
