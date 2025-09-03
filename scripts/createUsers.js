import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import csvParser from "csv-parser";
import dotenv from "dotenv";

dotenv.config();

// Supabase client using Service Role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Track usernames to avoid duplicates
const existingUsernames = new Set();

// Function to generate username from first + last name
function generateUsername(first, last) {
  let username = (first[0] + last).toLowerCase();

  // Handle duplicates
  let i = 1;
  while (existingUsernames.has(username)) {
    i++;
    username = (first[0] + last + i).toLowerCase();
  }

  existingUsernames.add(username);
  return username;
}

// Function to create a Supabase user
async function createUser({ first_name, last_name, password, role, squad_id }) {
  try {
    if (!first_name || !last_name) {
      console.error(`Missing name for user:`, { first_name, last_name });
      return;
    }
    const full_name = `${first_name} ${last_name}`;
    const username = generateUsername(first_name, last_name);
    const email = `${username}@example.com`; // required by Supabase

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { username, role, squad_id, full_name },
    });

    if (error) {
      console.error(`Error creating ${username}:`, error.message);
    } else {
      console.log(`Created user: ${username}`);
    }
  } catch (err) {
    console.error(`Unexpected error for ${first_name} ${last_name}:`, err.message);
  }
}

// Read CSV and create users
function readCSVAndCreateUsers() {
  const users = [];
  fs.createReadStream("team.csv")
    .pipe(csvParser())
    .on("data", (row) => users.push(row))
    .on("end", async () => {
      console.log(`Read ${users.length} users from CSV`);
      for (const user of users) {
        await createUser(user);
      }
      console.log("All users created!");
    });
}

readCSVAndCreateUsers();
