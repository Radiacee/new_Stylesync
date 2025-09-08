# StyleSync

A sophisticated AI-powered writing assistant that learns your unique writing style and applies it to paraphrasing tasks. Built with ethical AI use and academic integrity in mind.

## 🎯 Project Overview

StyleSync is a modern web application that allows users to:
- Create detailed personal writing style profiles through guided onboarding
- Analyze writing samples to extract style patterns and preferences
- Paraphrase text while maintaining the user's unique voice and writing style
- View detailed style transformation analysis and AI transparency reports
- Manage multiple style profiles with cloud synchronization

## ✨ Key Features

### 🎨 **Style Profile Management**
- **Guided Onboarding**: Step-by-step questionnaire to build style profiles
- **Multiple Profiles**: Create and manage different writing styles for various contexts
- **Cloud Sync**: Automatic synchronization across devices with Supabase
- **Style Analysis**: AI-powered analysis of writing samples to extract patterns

### 🔄 **Intelligent Paraphrasing**
- **AI-Powered**: Uses Groq's Llama3-70B model for high-quality paraphrasing
- **Style Preservation**: Maintains your unique voice, tone, and writing patterns
- **Heuristic Fallback**: Local paraphrasing engine when AI is unavailable
- **Real-time Processing**: Fast, responsive paraphrasing with progress indicators

### 📊 **Advanced Analytics**
- **Style Transformation Analysis**: Detailed comparison of original vs. paraphrased text
- **AI Transparency Panel**: Shows how AI applied your style preferences
- **Visual Diff**: Highlights changed words and transformation patterns
- **Writing Metrics**: Sentence length, complexity, tone, and vocabulary analysis

### 🔐 **Enterprise-Ready Features**
- **User Authentication**: Secure sign-up/sign-in with email confirmation
- **Admin Panel**: Comprehensive user and database management
- **History Tracking**: Save and manage paraphrasing history with notes
- **Rate Limiting**: Built-in API protection and usage controls

## 🛠 Technology Stack

### **Frontend**
- **Next.js 14.2.5** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Modern utility-first styling
- **Glass Morphism UI** - Contemporary design with backdrop blur effects

### **Backend & Database**
- **Supabase** - PostgreSQL database with real-time features
- **Row Level Security** - Fine-grained access control
- **Email Authentication** - Secure user management

### **AI & Processing**
- **Groq API** - Fast inference with Llama3-70B model
- **Local Heuristics** - Fallback processing engine
- **Style Analysis** - Advanced pattern recognition algorithms

### **Development Tools**
- **Vitest** - Modern testing framework
- **ESLint** - Code quality and consistency
- **TypeScript** - Static type checking

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (for cloud features)
- Groq API key (for AI features)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/stylesync.git
   cd stylesync
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your API keys and database URLs:
   ```env
   GROQ_API_KEY=your_groq_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database:**
   - Create a new Supabase project
   - Run the SQL scripts in `SUPABASE_ADMIN_SETUP.sql`
   - Configure Row Level Security policies

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   Navigate to http://localhost:3000

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Landing page
│   ├── about/             # About and ethics information
│   ├── admin/             # Admin panel (users, database)
│   ├── auth/              # Authentication pages
│   ├── paraphrase/        # Main paraphrasing interface
│   └── style/onboarding/  # Style profile creation
├── components/            # Reusable UI components
│   ├── StyleProfileManager.tsx
│   ├── AITransparencyPanel.tsx
│   └── StyleComparisonPanel.tsx
├── lib/                   # Core business logic
│   ├── paraphrase.ts      # Paraphrasing engine
│   ├── styleProfile.ts    # Profile management
│   ├── styleComparison.ts # Analysis algorithms
│   └── supabaseClient.ts  # Database connection
└── __tests__/             # Test files
```

## 🔧 Configuration

### Environment Variables

#### Required for Production:
```env
GROQ_API_KEY=              # Groq API key for AI processing
NEXT_PUBLIC_SUPABASE_URL=  # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anonymous key
```

#### Optional (with defaults):
```env
GROQ_MODEL=llama3-70b-8192    # AI model to use
GROQ_TEMPERATURE=0.3          # AI creativity level
NODE_ENV=production           # Environment mode
```

### Database Setup

The application requires several database tables. Run these SQL commands in your Supabase SQL editor:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Style profiles table
create table if not exists public.style_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tone text not null,
  formality real not null check (formality >= 0 and formality <= 1),
  pacing real not null check (pacing >= 0 and pacing <= 1),
  descriptiveness real not null check (descriptiveness >= 0 and descriptiveness <= 1),
  directness real not null check (directness >= 0 and directness <= 1),
  sample_excerpt text,
  custom_lexicon text[] default '{}',
  notes text,
  style_analysis jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Paraphrase history table
create table if not exists public.paraphrase_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input text not null,
  output text not null,
  note text default '',
  used_model boolean default false,
  created_at timestamptz default now()
);

-- Row Level Security policies
alter table style_profiles enable row level security;
alter table paraphrase_history enable row level security;

-- Policies for style_profiles
create policy "Users can read own profiles" on style_profiles
  for select using (auth.uid() = user_id);
create policy "Users can insert own profiles" on style_profiles
  for insert with check (auth.uid() = user_id);
create policy "Users can update own profiles" on style_profiles
  for update using (auth.uid() = user_id);
create policy "Users can delete own profiles" on style_profiles
  for delete using (auth.uid() = user_id);

-- Policies for paraphrase_history
create policy "Users can read own history" on paraphrase_history
  for select using (auth.uid() = user_id);
create policy "Users can insert own history" on paraphrase_history
  for insert with check (auth.uid() = user_id);
create policy "Users can update own history" on paraphrase_history
  for update using (auth.uid() = user_id);
create policy "Users can delete own history" on paraphrase_history
  for delete using (auth.uid() = user_id);
```

## 🚀 Deployment

StyleSync can be deployed to various platforms. See `DEPLOYMENT.md` for detailed platform-specific instructions.

### Quick Deploy Options:

**Vercel (Recommended):**
```bash
npm run build
vercel --prod
```

**Netlify:**
```bash
npm run build
netlify deploy --prod --dir=.next
```

**Railway:**
```bash
railway up
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## 📈 Admin Features

StyleSync includes a comprehensive admin panel for managing users and monitoring the system:

- **User Management**: View, edit, and delete user accounts
- **Database Browser**: Execute queries and view table data
- **System Analytics**: Monitor usage and performance metrics
- **Security Controls**: Admin-only access with email-based authentication

See `ADMIN_PANEL_GUIDE.md` for detailed setup instructions.

## 🎓 Academic Guidelines

This project is designed with academic integrity in mind:

### ✅ **Ethical Use**
- Always disclose AI assistance in your work
- Cite sources appropriately
- Respect institutional AI policies
- Use for learning and improvement, not deception

### ⚠️ **Important Notes**
- This tool is NOT designed to evade AI detection
- Users must follow their institution's AI use policies
- All paraphrasing should be transparently disclosed
- Original authorship and sources must be credited

## 🔒 Privacy & Security

- **Data Encryption**: All data is encrypted in transit and at rest
- **User Privacy**: No data sharing with third parties
- **Secure Authentication**: Email-based verification system
- **API Protection**: Rate limiting and abuse prevention
- **Local Fallback**: Works offline with local processing

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License. See `LICENSE` file for details.

## 🆘 Support

- **Documentation**: Check our comprehensive guides
- **Issues**: Report bugs on GitHub Issues
- **Email**: Contact the development team

---

**Built with ❤️ for ethical AI use and academic excellence**
