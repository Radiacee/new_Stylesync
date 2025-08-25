# **StyleSync Admin Panel Setup Guide**

## **🚀 Quick Setup Instructions**

### **Step 1: Update Admin Emails**
Edit the admin email list in these files to include your email:
- `src/app/admin/AdminLayout.tsx` (line 11)
- `src/app/api/admin/route.ts` (line 4)

```typescript
const ADMIN_EMAILS = [
  'your-email@domain.com', // Replace with your actual email
  'banluytachristiandave2@gmail.com',
];
```

### **Step 2: Set Up Database Functions**
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of `SUPABASE_ADMIN_SETUP.sql`
4. Click **Run** to create all necessary functions and tables

### **Step 3: Deploy and Test**
1. Deploy your updated application
2. Sign in with your admin email
3. Navigate to `/admin` to access the admin panel

## **🎛️ Admin Panel Features**

### **Dashboard** (`/admin`)
- **User Statistics**: Total users, confirmed accounts, recent activity
- **Quick Navigation**: Access to all management tools
- **System Overview**: Real-time metrics and performance data

### **User Management** (`/admin/users`)
- ✅ **View All Users**: Complete user list with status and details
- ✅ **Edit User**: Update email addresses and user information
- ✅ **Delete User**: Remove users and their data (with confirmation)
- ✅ **Search & Filter**: Find users by email or ID
- ✅ **User Status**: See confirmation status and last login

### **Database Management** (`/admin/database`)
- ✅ **SQL Query Editor**: Execute SELECT queries safely
- ✅ **Table Browser**: View all database tables and structure
- ✅ **Quick Queries**: Pre-built queries for common tasks
- ✅ **Export Data**: Download query results as CSV
- ✅ **Real-time Results**: See query execution time and row counts

### **Security Features**
- 🔒 **Admin-Only Access**: Email-based admin authentication
- 🔒 **Query Restrictions**: Only SELECT queries allowed for safety
- 🔒 **Activity Logging**: All admin actions are logged
- 🔒 **Session Management**: Secure authentication flow

## **🛠️ Database Schema**

### **New Tables Created**
```sql
admin_activity_log
├── id (UUID, Primary Key)
├── admin_email (TEXT)
├── action (TEXT)
├── details (JSONB)
├── ip_address (INET)
└── created_at (TIMESTAMP)
```

### **RPC Functions Available**
- `get_table_info()` - Returns database table information
- `execute_admin_query(query)` - Safely executes SELECT queries
- `log_admin_activity()` - Logs admin actions
- `get_user_statistics()` - Returns user metrics
- `get_paraphrase_statistics()` - Returns usage metrics
- `admin_delete_user_data(user_id)` - Safely removes user data

### **Views Created**
- `admin_dashboard_summary` - Real-time dashboard statistics

## **📊 Common Admin Queries**

### **User Analytics**
```sql
-- Total user count
SELECT COUNT(*) FROM auth.users;

-- New users this week
SELECT COUNT(*) FROM auth.users 
WHERE created_at >= NOW() - INTERVAL '7 days';

-- User confirmation rate
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL) as confirmed_users,
  ROUND(COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL) * 100.0 / COUNT(*), 2) as confirmation_rate
FROM auth.users;
```

### **Usage Statistics**
```sql
-- Paraphrases by day (last 7 days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as paraphrases
FROM paraphrase_history 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Most active users
SELECT 
  user_id,
  COUNT(*) as paraphrase_count
FROM paraphrase_history
GROUP BY user_id
ORDER BY paraphrase_count DESC
LIMIT 10;
```

## **🔧 Customization Options**

### **Adding New Admin Sections**
1. Create new directory in `src/app/admin/[section-name]/`
2. Add page.tsx with AdminLayout wrapper
3. Update navigation in main dashboard
4. Add API routes if needed in `src/app/api/admin/[endpoint]/`

### **Extending Database Tools**
1. Add new RPC functions to `SUPABASE_ADMIN_SETUP.sql`
2. Update the database management page
3. Add new quick query templates

### **Custom Statistics**
1. Create new RPC functions for your metrics
2. Update the dashboard to fetch and display them
3. Add visualization components as needed

## **⚠️ Security Considerations**

### **Admin Access Control**
- Only users with emails in `ADMIN_EMAILS` array can access admin panel
- Authentication is verified on both client and server side
- Admin actions should be logged for audit trail

### **Database Security**
- Only SELECT queries are allowed in the query editor
- All RPC functions use SECURITY DEFINER for controlled access
- Input validation prevents SQL injection

### **Best Practices**
- Regularly review admin activity logs
- Keep the admin email list updated
- Test all admin functions in development first
- Monitor database performance with admin queries

## **🧪 Testing Your Admin Panel**

### **Local Testing**
1. Start development server: `npm run dev`
2. Sign in with your admin email
3. Navigate to `http://localhost:3000/admin`
4. Test each section: Users, Database, Dashboard

### **Production Testing**
1. Deploy with updated admin emails
2. Ensure Supabase functions are installed
3. Test admin access with production URLs
4. Verify all CRUD operations work correctly

## **📈 Monitoring & Maintenance**

### **Regular Tasks**
- Review admin activity logs weekly
- Monitor database query performance
- Check user statistics for growth trends
- Backup database regularly

### **Troubleshooting**
- If admin access is denied: Check email in ADMIN_EMAILS array
- If queries fail: Verify RPC functions are installed in Supabase
- If stats don't load: Check API routes and database connections
- If exports fail: Verify data format and browser permissions

Your admin panel is now fully functional with comprehensive CRUD operations and security features!
