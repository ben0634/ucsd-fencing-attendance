import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addKevinKim() {
  const username = "kkim2"; // Kevin Kim (to avoid collision with Katherine Kim's kkim)
  const email = `${username}@ucsd-fencing.edu`;

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  if (existingUsers.users && existingUsers.users.find(u => u.email === email)) {
    console.log(`User ${username} already exists!`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "changeme",
    email_confirm: true,
    user_metadata: { 
      firstName: "Kevin",
      lastName: "Kim",
      username, 
      role: "athlete", 
      squadId: 32,
      weapon: "epee",
      gender: "male"
    },
  });

  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Created user:", username, "(Kevin Kim)");
    
    // Also add to users table
    const { error: dbError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email: email,
        username: username,
        first_name: "Kevin",
        last_name: "Kim", 
        full_name: "Kevin Kim",
        role: "athlete",
        squad_id: 32,
        weapon: "epee",
        gender: "male"
      });
      
    if (dbError) {
      console.error("Error adding to users table:", dbError.message);
    } else {
      console.log("Successfully added Kevin Kim to users table");
    }
  }
}

addKevinKim();
