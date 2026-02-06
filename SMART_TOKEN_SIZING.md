# Smart Token Sizing for AI Question Generation

## Overview
The system now dynamically calculates the optimal token limit for the Groq API based on:
1. **Number of questions** requested
2. **Question type** (MCQ vs Subjective)
3. **System requirements** (overhead for formatting & instructions)

## Token Calculation Logic

### Per-Question Token Estimates

| Question Type | Tokens/Question | Components |
|---|---|---|
| **MCQ** | ~300 | Question text + 4 options (A,B,C,D) + correct answer + explanation |
| **Subjective** | ~200 | Question text + answer/sample response + explanation |
| **Mixed/Other** | ~250 | Average estimate |

### Calculation Formula

```
Total Tokens = (Count × Avg Tokens per Type) + Overhead

Where:
- Count = number of questions requested
- Avg Tokens = Average of selected question types
- Overhead = 300 (system instructions & formatting buffer)

Final = Clamp(Total, Min: 2000, Max: 8000)
```

### Examples

**Scenario 1: 5 MCQ Questions**
```
= (5 × 300) + 300
= 1500 + 300
= 1800 tokens
→ Final: 2000 tokens (minimum applied)
```

**Scenario 2: 10 MCQ Questions**
```
= (10 × 300) + 300
= 3000 + 300
= 3300 tokens
→ Final: 3300 tokens
```

**Scenario 3: 5 Subjective Questions**
```
= (5 × 200) + 300
= 1000 + 300
= 1300 tokens
→ Final: 2000 tokens (minimum applied)
```

**Scenario 4: 4 Mixed (MCQ + Subjective)**
```
Average per question = (300 + 200) / 2 = 250 tokens
= (4 × 250) + 300
= 1000 + 300
= 1300 tokens
→ Final: 2000 tokens (minimum applied)
```

## Implementation Details

### Code Location
File: `src/BackendServer/services/aiTestGenerator.js`

### Key Methods

#### 1. `calculateTokenRequirements(numberOfQuestions, questionTypes)`
Calculates the appropriate max_tokens value based on:
- Question count
- Question types
- Fixed overhead (300 tokens)
- Min/Max boundaries (2000-8000)

**Returns:** Integer token count for API request

**Example:**
```javascript
const tokens = generator.calculateTokenRequirements(5, ['MCQ']);
// Returns: 2000 (minimum applied)
```

#### 2. `callGroq(prompt, requirements = {})`
Updated to accept requirements object and use dynamic token sizing:
```javascript
// Old way (deprecated)
result = await this.callGroq(prompt);

// New way (smart sizing)
result = await this.callGroq(prompt, requirements);
```

#### 3. `generateQuestions(requirements)`
Passes requirements to callGroq for intelligent token calculation:
```javascript
const requirements = {
  numberOfQuestions: 5,
  questionTypes: ['MCQ'],
  subject: 'Math',
  topic: 'Algebra',
  difficultyLevel: 'Medium',
  additionalInstructions: '...'
};

const result = await generator.generateQuestions(requirements);
```

## Benefits

✅ **No Truncated Questions**
- Enough tokens for all requested questions
- Previously: 5 questions → might get only 1-2
- Now: 5 questions → always get 5

✅ **Type-Aware**
- MCQ gets more tokens (more complex)
- Subjective gets less (simpler structure)
- Mixed gets balanced allocation

✅ **Automatic Scaling**
- 3 questions: 2000 tokens
- 5 questions: 2000-2500 tokens
- 10 questions: 3000-3500 tokens
- 20 questions: 6000-8000 tokens

✅ **Groq API Optimized**
- Respects Groq's token limits
- Efficient use of API quota
- Fast responses due to adequate allocation

✅ **Prevents Waste**
- Doesn't over-allocate tokens
- Cost-effective (less wasted token budget)
- Stays within Groq's fair limits

## Testing

Test the token calculation with:
```bash
cd src/BackendServer
node test-token-sizing.js
```

Output shows:
```
Test: 5 MCQ Questions
Token Calculation:
   Questions: 5 x ~300 tokens/question
   Subtotal: 1500 tokens
   Overhead: 300 tokens
   Final Max Tokens: 2000
✅ Calculated max_tokens: 2000
```

## Configuration

No configuration needed! The system:
- Automatically detects question count
- Analyzes question types
- Calculates optimal tokens
- Applies smart sizing

## Future Improvements

Potential enhancements:
- [ ] Track actual token usage from Groq API
- [ ] Learn from real responses to refine estimates
- [ ] Add question difficulty modifier to token calculation
- [ ] Cache frequently used question patterns
- [ ] Log token efficiency metrics

## Troubleshooting

**Q: Questions are still getting truncated?**
A: Check that requirements object is properly passed to callGroq with numberOfQuestions and questionTypes

**Q: Token limit is too high?**
A: Max is capped at 8000. For more questions, split into multiple API calls

**Q: Getting fewer questions than requested?**
A: Verify:
1. numberOfQuestions is passed correctly
2. questionTypes array is populated
3. Check server logs for token calculation details

## Related Files

- `services/aiTestGenerator.js` - Main implementation
- `routers/teacher.js` - Route that calls generator
- `views/createTest2.ejs` - Frontend form
- `test-token-sizing.js` - Token calculation tests

See `AI_GENERATION_FIX.md` for overall AI generation improvements.
