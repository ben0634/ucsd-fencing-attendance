import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Track usernames to avoid duplicates (optional, can fetch from Supabase if needed)
const existingUsernames = new Set();

function generateUsername(firstName, lastName) {
  let username = (firstName[0] + lastName).toLowerCase();
  let i = 1;
  while (existingUsernames.has(username)) {
    i++;
    username = (firstName[0] + lastName + i).toLowerCase();
  }
  existingUsernames.add(username);
  return username;
}

// Create a single user
async function addUser(firstName, lastName, password, role, squadId, weapon = "foil", gender = "male") {
  const username = generateUsername(firstName, lastName);
  const email = `${username}@ucsd-fencing.edu`; // Match createUsers email format

  // Check if user exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  if (existingUsers.users && existingUsers.users.find(u => u.email === email)) {
    console.log(`User ${username} already exists!`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Match createUsers
    user_metadata: { 
      firstName,    // Match createUsers field names
      lastName,     // Match createUsers field names
      username, 
      role, 
      squadId,      // Match createUsers field name
      weapon,       // Add weapon field to match createUsers
      gender        // Add gender field to match createUsers
    },
  });

  if (error) console.error("Error:", error.message);
  else console.log("Created user:", username);
}

addUser("Kevin", "Kim", "changeme", "athlete", 32, "epee", "male");
