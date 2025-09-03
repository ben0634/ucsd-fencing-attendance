# User Management Scripts

This folder contains scripts to manage users for the UCSD Fencing attendance system.

## 📋 List Users

### View all users organized by squad:
```bash
node scripts/listAllUsers.js
```

### View only captains:
```bash
node scripts/listAllUsers.js captain
```

### View only athletes:
```bash
node scripts/listAllUsers.js athlete
```

## 🎯 Update User Role

### Update a user's role by their full name:
```bash
node scripts/updateUserByName.js "Full Name" newRole
```

### Examples:
```bash
# Make someone a captain
node scripts/updateUserByName.js "Erenei Ligh" captain

# Make someone an athlete  
node scripts/updateUserByName.js "Ben Kim" athlete

# Make someone a coach
node scripts/updateUserByName.js "John Doe" coach
```

**Valid roles:** `athlete`, `captain`, `coach`

## 🔄 Bulk Operations

### Delete all users and recreate from CSV:
```bash
node scripts/deleteAllUsers.js
node scripts/createUsers.js
```

### Sync users table with auth.users:
```bash
node scripts/populateUsersTable.js
```

## � Attendance Data Management

### Clear all attendance data (for season reset):
```bash
# See what would be deleted (dry run)
node scripts/clearAttendanceData.js --dry-run

# Actually delete all data
node scripts/clearAttendanceData.js --confirm

# Delete attendance before a specific date
node scripts/clearAttendanceData.js --before-date 2025-09-01 --confirm
```

### Granular attendance management:
```bash
# Show attendance statistics
node scripts/resetAttendanceData.js show-stats

# Clear attendance for a specific week
node scripts/resetAttendanceData.js clear-week 2025-09-02

# Clear attendance for a specific month  
node scripts/resetAttendanceData.js clear-month 2025-09

# Clear attendance for a specific athlete
node scripts/resetAttendanceData.js clear-athlete bkim@ucsd.edu

# Clear test data (records before today)
node scripts/resetAttendanceData.js clear-test-data
```

## �📁 Other Scripts

- `createUsers.js` - Create users from team.csv
- `deleteAllUsers.js` - Delete all users (⚠️ destructive)
- `listUsers.js` - Simple user list  
- `updateUserMetadata.js` - Update metadata for existing users
- `populateUsersTable.js` - Sync users table with auth.users
- `verifyAttendanceTable.js` - Check attendance table setup
- `clearAttendanceData.js` - Clear attendance data (⚠️ destructive)
- `resetAttendanceData.js` - Granular attendance data management

## 💡 Tips

1. **Find the exact name**: Use `listAllUsers.js` to see exact name formatting
2. **Case insensitive**: The update script works with any case
3. **Squad changes**: When promoting to captain, you'll see the updated squad
4. **Backup first**: Always backup before bulk operations
5. **Season reset**: Use attendance scripts to clear test data before real season
6. **Test safely**: Always use `--dry-run` before destructive operations

## ⚠️ Destructive Operations

These scripts can delete data permanently:
- `deleteAllUsers.js` - Deletes ALL users
- `clearAttendanceData.js` - Deletes attendance records
- `resetAttendanceData.js` - Various attendance cleanup options

Always backup your database before running these!

## 🏆 Current Squad Structure

- **Men's Epee**: Dayus Gohel (👑), Ben Kim, Sunny Sharma
- **Men's Foil**: Zander Vazquez (👑), Jacob Levy, Scott Lao  
- **Men's Saber**: Ryan Kim-Cogan (👑), Arnav Raja, Hananiah So, Sam Zubatiy
- **Women's Epee**: Lily Nelson-Love (👑), Alice Lan, Bella Balogh, Natalie Gebala, Pia Huber, Renee Zuhars
- **Women's Foil**: Katherine Kim (👑), Ella Tang, Neta Korol, Zehra Anbarlilar
- **Women's Saber**: Erenei Ligh (👑), Alexandra Cody, Emily Naka, Maya Barnovitz, Zara Fearns
