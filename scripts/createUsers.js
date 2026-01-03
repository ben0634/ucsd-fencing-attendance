// scripts/createUsers.js
import fs from "fs";
import { parse } from "csv-parse";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Path to your CSV file
const csvFilePath = "./team.csv";

// Function to generate username: first name + last initial, with collision handling
const generateUsername = (firstName, lastName, existingUsernames) => {
  let username = `${firstName.toLowerCase()}${lastName[0].toLowerCase()}`;
  let counter = 1;
  
  // Handle collisions by adding a number suffix
  while (existingUsernames.has(username)) {
    counter++;
    username = `${firstName.toLowerCase()}${lastName[0].toLowerCase()}${counter}`;
  }
  
  existingUsernames.add(username);
  return username;
};

const createUsers = async () => {
  // Track existing usernames to prevent collisions
  const existingUsernames = new Set();
  
  // First, get existing users to avoid conflicts
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  if (existingUsers && existingUsers.users) {
    existingUsers.users.forEach(user => {
      if (user.user_metadata && user.user_metadata.username) {
        existingUsernames.add(user.user_metadata.username);
      }
    });
  }

  const parser = fs.createReadStream(csvFilePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
    })
  );

  for await (const record of parser) {
    const { firstName, lastName, password, role, squad_id, weapon, gender } =
      record;

    const username = generateUsername(firstName, lastName, existingUsernames);
    const email = `${username}@localhost`;

    // Skip if user already exists
    if (existingUsers && existingUsers.users.find(u => u.email === email)) {
      console.log(`User ${username} (${firstName} ${lastName}) already exists, skipping...`);
      continue;
    }

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          firstName,
          lastName,
          username,
          role,
          squadId: squad_id,
          weapon,
          gender,
        },
      });

      if (error) {
        console.error(`Error creating ${username} (${firstName} ${lastName}):`, error.message);
      } else {
        console.log(`Created user: ${username} (${firstName} ${lastName})`);
      }
    } catch (err) {
      console.error(`Failed for ${username} (${firstName} ${lastName}):`, err);
    }
  }

  console.log("All users processed.");
};

createUsers();
