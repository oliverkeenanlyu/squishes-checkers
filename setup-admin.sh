#!/bin/bash

# Add Admin to Allowed Emails Migration Script

echo "🚀 Running migration to add admin functionality..."

# Run the drizzle migration
npm run db:migrate || {
    echo "❌ Migration failed. Please check your database connection."
    exit 1
}

echo "✅ Migration completed successfully!"

# Prompt to create first admin user
echo ""
echo "📝 To create your first admin user, please:"
echo "1. Go to your PostgreSQL database"
echo "2. Run this SQL command to make your email an admin:"
echo ""
echo "   UPDATE \"squishes-checkers_allowed_email\" SET \"isAdmin\" = true WHERE email = 'your-email@example.com';"
echo ""
echo "   (Replace 'your-email@example.com' with your actual email)"
echo ""
echo "3. Then you can access the admin panel in the app and add more users!"
echo ""
echo "🎉 Admin functionality is now ready to use!"