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

// Function to generate username: first initial + last name
const generateUsername = (firstName, lastName) =>
  `${firstName[0].toLowerCase()}${lastName.toLowerCase()}`;

const createUsers = async () => {
  const parser = fs.createReadStream(csvFilePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
    })
  );

  for await (const record of parser) {
    const { firstName, lastName, password, role, squad_id, weapon, gender } =
      record;

    const username = generateUsername(firstName, lastName);

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: `${username}@ucsd-fencing.edu`, // placeholder email
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
        console.error(`Error creating ${username}:`, error.message);
      } else {
        console.log(`Created user: ${username}`);
      }
    } catch (err) {
      console.error(`Failed for ${username}:`, err);
    }
  }

  console.log("All users processed.");
};

createUsers();
