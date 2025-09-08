# StyleSync API Documentation

## 📊 API Overview

StyleSync provides a RESTful API for paraphrasing text while maintaining user-defined writing styles. All API endpoints are located under `/api/` and return JSON responses.

---

## 🔐 Authentication

### Authentication Methods
- **Session-based**: Via Supabase authentication
- **JWT Tokens**: Automatically handled by Supabase client
- **Admin Access**: Email-based admin validation

### Headers Required
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <supabase-jwt-token>"
}
```

---

## 📝 Core API Endpoints

### **1. Paraphrase Text**

Transform text using AI while preserving user's writing style.

```http
POST /api/paraphrase
```

#### Request Body
```json
{
  "text": "The text you want to paraphrase",
  "useModel": true,
  "profile": {
    "id": "uuid",
    "name": "Academic Writing",
    "tone": "formal",
    "formality": 0.8,
    "pacing": 0.6,
    "descriptiveness": 0.7,
    "directness": 0.9,
    "sampleExcerpt": "Sample of user's writing...",
    "customLexicon": ["terminology", "specific", "words"],
    "styleAnalysis": {
      "avgSentenceLength": 18,
      "vocabularyComplexity": 0.25,
      "usesContractions": false,
      "voicePerspective": "third-person"
    }
  },
  "debug": false
}
```

#### Response
```json
{
  "result": "The paraphrased text with preserved style",
  "usedModel": true,
  "actions": [
    {"code": "FORMAL_TONE", "meta": {"applied": true}},
    {"code": "ADJUST_PACING", "meta": {"target": 0.6}}
  ],
  "metrics": {
    "sentenceCount": 3,
    "avgLength": 16.7,
    "stdDev": 4.2,
    "uniqueTokenRatio": 0.85,
    "aiPhraseHits": 2,
    "repeatedStartsRatio": 0.1
  }
}
```

#### Error Response
```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "details": "Additional debugging information"
}
```

---

### **2. Style Comparison Analysis**

Analyze the transformation between original and paraphrased text.

```http
POST /api/style-comparison
```

#### Request Body
```json
{
  "userSampleText": "User's writing sample for baseline",
  "originalText": "The original text before paraphrasing",
  "paraphrasedText": "The text after paraphrasing"
}
```

#### Response
```json
{
  "transformation": {
    "overallAlignment": 0.85,
    "sentenceStructure": {
      "originalAvgLength": 15.2,
      "paraphrasedAvgLength": 14.8,
      "alignment": 0.92
    },
    "vocabularyAlignment": {
      "formalityScore": 0.78,
      "complexityMatch": 0.81,
      "lexiconUsage": 0.75
    },
    "tonePreservation": {
      "originalTone": "professional",
      "paraphrasedTone": "professional",
      "consistency": 0.88
    },
    "stylisticElements": {
      "contractionUsage": true,
      "voicePerspective": "first-person",
      "descriptiveness": 0.72
    }
  }
}
```

---

## 🔧 Admin API Endpoints

### **3. Admin Authentication Check**

Verify admin access for protected routes.

```http
GET /api/admin
```

#### Response
```json
{
  "isAdmin": true,
  "email": "admin@example.com",
  "permissions": ["user_management", "database_access"]
}
```

---

### **4. Delete User Account**

Remove a user account and all associated data.

```http
DELETE /api/deleteUser
```

#### Request Body
```json
{
  "userId": "uuid-of-user-to-delete"
}
```

#### Response
```json
{
  "success": true,
  "message": "User and all associated data deleted successfully",
  "deletedRecords": {
    "profiles": 3,
    "history": 47,
    "user": 1
  }
}
```

---

## 📊 Data Models

### **StyleProfile Interface**
```typescript
interface StyleProfile {
  id: string;
  name: string;
  tone: string;
  formality: number;        // 0.0 to 1.0
  pacing: number;          // 0.0 to 1.0
  descriptiveness: number; // 0.0 to 1.0
  directness: number;      // 0.0 to 1.0
  sampleExcerpt?: string;
  customLexicon: string[];
  notes?: string;
  styleAnalysis?: StyleAnalysis;
  createdAt: number;
  updatedAt: number;
  userId?: string;
}
```

### **StyleAnalysis Interface**
```typescript
interface StyleAnalysis {
  avgSentenceLength: number;
  vocabularyComplexity: number;
  usesContractions: boolean;
  questionRatio: number;
  exclamatoryRatio: number;
  voicePerspective: 'first-person' | 'second-person' | 'third-person';
  toneBalance: 'positive' | 'negative' | 'neutral';
  conjunctionDensity: number;
  descriptiveRatio: number;
  commonStarters: string[];
  preferredAdverbs: string[];
}
```

### **ParaphraseEntry Interface**
```typescript
interface ParaphraseEntry {
  id: string;
  userId?: string;
  input: string;
  output: string;
  note: string;
  usedModel: boolean;
  createdAt: string;
  pending?: boolean;
  localOnly?: boolean;
}
```

---

## ⚡ Rate Limiting

### Current Limits
- **Paraphrase API**: 60 requests per hour per user
- **Style Analysis**: 30 requests per hour per user
- **Admin APIs**: 100 requests per hour per admin
- **General APIs**: 200 requests per hour per user

### Rate Limit Headers
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

### Rate Limit Exceeded Response
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "resetTime": 1640995200,
  "limit": 60
}
```

---

## 🛡️ Error Handling

### Standard Error Response Format
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "details": "Additional context or debugging information",
  "timestamp": "2024-01-01T12:00:00Z",
  "requestId": "uuid-for-tracking"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_INPUT` | 400 | Request body validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server-side error |
| `AI_SERVICE_ERROR` | 502 | External AI service error |
| `DATABASE_ERROR` | 503 | Database connectivity issue |

---

## 🧪 Testing the API

### **Using cURL**

#### Test Paraphrasing:
```bash
curl -X POST http://localhost:3000/api/paraphrase \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a test sentence.",
    "useModel": true,
    "profile": {
      "tone": "casual",
      "formality": 0.3,
      "pacing": 0.7,
      "descriptiveness": 0.5,
      "directness": 0.8
    }
  }'
```

#### Test Style Analysis:
```bash
curl -X POST http://localhost:3000/api/style-comparison \
  -H "Content-Type: application/json" \
  -d '{
    "userSampleText": "I really think this is great!",
    "originalText": "This is excellent.",
    "paraphrasedText": "I believe this is really excellent!"
  }'
```

### **Using JavaScript/TypeScript**

```typescript
// Paraphrase API call
const response = await fetch('/api/paraphrase', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Your text here',
    useModel: true,
    profile: styleProfile,
    debug: false
  })
});

const result = await response.json();
console.log(result);
```

### **Using Postman**

1. **Import Collection**: Use the provided Postman collection
2. **Set Environment Variables**:
   - `baseUrl`: http://localhost:3000 (or your deployed URL)
   - `authToken`: Your Supabase JWT token
3. **Run Tests**: Execute the pre-configured test suite

---

## 📈 Performance Considerations

### **Response Times**
- **Paraphrase API**: ~500-2000ms (depends on AI service)
- **Style Analysis**: ~200-500ms
- **Admin APIs**: ~100-300ms
- **Auth Check**: ~50-100ms

### **Optimization Tips**
1. **Cache Style Profiles**: Reduce database calls
2. **Batch Requests**: Combine multiple operations
3. **Use Compression**: Enable gzip for responses
4. **CDN Integration**: Cache static responses

### **Monitoring**
```typescript
// Add performance monitoring
console.time('api-paraphrase');
// ... API call
console.timeEnd('api-paraphrase');
```

---

## 🔧 Development & Debugging

### **Local Development Setup**
```bash
# Start development server with API debugging
DEBUG=api:* npm run dev

# Test API endpoints
npm run test:api

# Validate API schemas
npm run validate:schemas
```

### **Debug Mode**
Enable debug mode for detailed processing information:
```json
{
  "text": "Test text",
  "debug": true
}
```

Debug response includes:
- Processing steps and timing
- AI prompt construction details
- Style rule applications
- Performance metrics

---

## 📝 API Changelog

### **Version 1.2.0** (Current)
- ✅ Added style comparison analysis endpoint
- ✅ Enhanced error handling with detailed codes
- ✅ Improved rate limiting implementation
- ✅ Added admin user management APIs

### **Version 1.1.0**
- ✅ Implemented style analysis in paraphrase requests
- ✅ Added debug mode for development
- ✅ Enhanced authentication flow

### **Version 1.0.0**
- ✅ Initial API release
- ✅ Basic paraphrasing functionality
- ✅ Style profile integration

---

**For additional support or questions about the API, please refer to the main documentation or contact the development team.**
