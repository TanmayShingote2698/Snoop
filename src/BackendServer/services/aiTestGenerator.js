const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
class AITestGenerator {
  constructor() {
    this.llmService = process.env.LLM_SERVICE || 'groq';
    this.apiKey = process.env[`${this.llmService.toUpperCase()}_API_KEY`] || '';
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env[`${this.llmService.toUpperCase()}_MODEL`] || 'mixtral-8x7b-32768';
  }
  async generateQuestions(requirements) {
    try {
      const { subject, topic, numberOfQuestions, difficultyLevel, questionTypes } = requirements;
      const prompt = this.buildPrompt(requirements);
      let result;
      switch (this.llmService.toLowerCase()) {
        case 'ollama':
          result = await this.callOllama(prompt);
          break;
        case 'groq':
          result = await this.callGroq(prompt, requirements);
          break;
        case 'huggingface':
          result = await this.callHuggingFace(prompt);
          break;
        case 'together':
          result = await this.callTogether(prompt);
          break;
        default:
          return {
            success: false,
            error: `Unknown LLM service: ${this.llmService}`
          };
      }
      if (!result.success) {
        return result;
      }
      // Parse and validate questions
      const questions = this.parseQuestions(result.text);
      return {
        success: true,
        questions: questions,
        service: this.llmService,
        tokenUsage: result.tokenUsage || null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  calculateTokenRequirements(numberOfQuestions, questionTypes) {
    // Token estimates per question type
    const tokenPerQuestion = {
      mcq: 300,        // MCQ: question + 4 options + answer + explanation
      subjective: 200, // Subjective: question + answer + explanation
      default: 250     // Average estimate
    };
    // Analyze question types
    const normalizedTypes = questionTypes.map(t => t.toLowerCase());
    let totalQuestionTokens = 0;
    let avgTokenPerQuestion = 250;
    if (normalizedTypes.length === 0) {
      // Default to MCQ if no types specified
      totalQuestionTokens = numberOfQuestions * tokenPerQuestion.mcq;
      avgTokenPerQuestion = tokenPerQuestion.mcq;
    } else {
      // Calculate based on mix of types
      const tokensPerQuestion = normalizedTypes.map(type => {
        if (type.includes('mcq')) return tokenPerQuestion.mcq;
        if (type.includes('subjective') || type.includes('subjec')) return tokenPerQuestion.subjective;
        return tokenPerQuestion.default;
      });
      avgTokenPerQuestion = tokensPerQuestion.reduce((a, b) => a + b, 0) / tokensPerQuestion.length;
      totalQuestionTokens = Math.ceil(numberOfQuestions * avgTokenPerQuestion);
    }
    // Add overhead for system instructions, formatting, etc.
    const overhead = 300;
    const totalTokens = totalQuestionTokens + overhead;
    // Ensure minimum and maximum boundaries
    const minTokens = 2000;
    const maxTokens = 8000;
    const final = Math.max(minTokens, Math.min(maxTokens, totalTokens));
    return final;
  }
  buildPrompt(requirements) {
    const { subject, topic, numberOfQuestions, difficultyLevel, questionTypes, additionalInstructions } = requirements;
    return `You must generate EXACTLY ${numberOfQuestions} exam questions for ${subject} - ${topic} at ${difficultyLevel} difficulty level.
Question Types Required: ${questionTypes.join(', ')}
IMPORTANT: Return ONLY a JSON array with NO markdown, NO explanation before/after, just the pure JSON array.
The array MUST contain exactly ${numberOfQuestions} question objects.
Example format for a JSON array with 2 questions:
[
  {
    "ind": 1,
    "question": "First question text?",
    "type": "mcq",
    "op1": "Option A",
    "op2": "Option B",
    "op3": "Option C",
    "op4": "Option D",
    "answer": "Option B",
    "explanation": "Explanation here"
  },
  {
    "ind": 2,
    "question": "Second question text?",
    "type": "mcq",
    "op1": "Option A",
    "op2": "Option B",
    "op3": "Option C",
    "op4": "Option D",
    "answer": "Option A",
    "explanation": "Explanation here"
  }
]
Now generate exactly ${numberOfQuestions} questions following this exact format.
Special Instructions: ${additionalInstructions || 'None'}
Reminder: You MUST return a JSON array with ${numberOfQuestions} objects. Each object must have all fields.`;
  }
  async callOllama(prompt) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        temperature: 0.7
      }, {
        timeout: 60000
      });
      // Try to extract JSON from response
      const text = response.data.response || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return {
          success: false,
          error: 'No valid JSON found in Ollama response. Try different prompt.',
          text: ''
        };
      }
      return {
        success: true,
        text: jsonMatch[0],
        tokenUsage: null
      };
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Ollama not running. Start Ollama application first (http://localhost:11434)'
        };
      }
      throw error;
    }
  }
  async callGroq(prompt, requirements = {}) {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'GROQ_API_KEY not set in .env'
        };
      }
      // Calculate appropriate token limit based on number of questions AND types
      let maxTokens = 3000; // Default
      if (requirements.numberOfQuestions && requirements.questionTypes) {
        maxTokens = this.calculateTokenRequirements(
          requirements.numberOfQuestions,
          requirements.questionTypes
        );
      } else {
        // Fallback: estimate from prompt
        const numQuestions = parseInt(prompt.match(/EXACTLY (\d+)/)?.[1] || '1');
        maxTokens = Math.max(2000, (numQuestions * 300) + 500);
      }
      const payload = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert exam question generator. ALWAYS return ONLY a complete JSON array with no markdown, no code blocks, no explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: maxTokens
      };
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000,
          validateStatus: () => true  // Don't throw on any status
        }
      );
      // Check if response is HTML (error page)
      if (typeof response.data === 'string') {
        if (response.data.includes('<!DOCTYPE') || response.data.includes('<html')) {
          return {
            success: false,
            error: 'Groq API returned an error page. Check your API key or try again later.'
          };
        }
      }
      // Check for API error response
      if (response.status !== 200) {
        if (response.data?.error?.message) {
          return {
            success: false,
            error: `Groq Error: ${response.data.error.message}`
          };
        }
        return {
          success: false,
          error: `API Error ${response.status}: Check your Groq API key or internet connection`
        };
      }
      const content = response.data?.choices?.[0]?.message?.content || '';
      if (!content) {
        return {
          success: false,
          error: 'Empty response from Groq API'
        };
      }
      // Extract JSON from response - handle markdown code blocks
      let jsonString = content.trim();
      // Remove markdown code blocks if present
      jsonString = jsonString.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
      // Extract JSON array
      const jsonMatch = jsonString.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        // Try to extract individual objects
        const objMatches = content.match(/\{[\s\S]*?\}/g);
        if (objMatches && objMatches.length > 0) {
          jsonString = '[' + objMatches.join(',') + ']';
        } else {
          return {
            success: false,
            error: 'AI response did not contain valid JSON questions'
          };
        }
      } else {
        jsonString = jsonMatch[0];
      }
      // Validate JSON is parseable
      let parsedJSON;
      try {
        parsedJSON = JSON.parse(jsonString);
      } catch (parseErr) {
        return {
          success: false,
          error: 'Generated content is not valid JSON'
        };
      }
      // Ensure it's an array
      if (!Array.isArray(parsedJSON)) {
        console.warn('Response is object, wrapping in array');
        parsedJSON = [parsedJSON];
      }
      return {
        success: true,
        text: JSON.stringify(parsedJSON),
        tokenUsage: null
      };
    } catch (error) {
      // Log the full error response for debugging
      if (error.response?.data) {
      }
      if (error.response?.status === 400) {
        return {
          success: false,
          error: `Invalid request: ${error.response.data?.error?.message || 'Bad Request'}`
        };
      }
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Invalid Groq API key. Check GROQ_API_KEY in .env file.'
        };
      }
      if (error.response?.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please wait a moment and try again.'
        };
      }
      if (error.response?.status === 500) {
        return {
          success: false,
          error: 'Groq API server error. Please try again later.'
        };
      }
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Cannot connect to Groq API. Check your internet connection.'
        };
      }
      return {
        success: false,
        error: `Groq API Error: ${error.message}`
      };
    }
  }
  async callHuggingFace(prompt) {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'HUGGINGFACE_API_KEY not set in .env'
        };
      }
      // Updated endpoint: router.huggingface.co
      const response = await axios.post(
        'https://router.huggingface.co/api/models/meta-llama/Llama-2-7b-chat-hf',
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: 2000,
            temperature: 0.7,
            top_p: 0.9
          }
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000,
          validateStatus: function (status) {
            return status < 500; // Don't throw on 4xx errors
          }
        }
      );
      // Check if response is HTML (error page)
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
        return {
          success: false,
          error: 'Hugging Face API error: Model not available or API key invalid. Please verify your Hugging Face API key.'
        };
      }
      // Check if response is an array
      if (!Array.isArray(response.data)) {
        // Check for error response
        if (response.data?.error) {
          return {
            success: false,
            error: `Hugging Face error: ${response.data.error}`
          };
        }
        return {
          success: false,
          error: 'Invalid response format from Hugging Face. API key may be invalid or model not found.'
        };
      }
      const text = response.data[0]?.generated_text || '';
      if (!text) {
        return {
          success: false,
          error: 'Empty response from Hugging Face. Model might be loading. Please try again.'
        };
      }
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('No JSON array found in response. Response preview:', text.substring(0, 300));
        // Try to extract as object
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) {
          return {
            success: true,
            text: `[${objMatch[0]}]`,
            tokenUsage: response.data[0]?.token_count || null
          };
        }
        return {
          success: false,
          error: 'AI response did not contain valid JSON questions. Please try again.'
        };
      }
      return {
        success: true,
        text: jsonMatch[0],
        tokenUsage: response.data[0]?.token_count || null
      };
    } catch (error) {
      if (error.response?.status === 410) {
        return {
          success: false,
          error: 'Hugging Face model endpoint is unavailable (410). Check if API has migrated.'
        };
      }
      if (error.response?.status === 503) {
        return {
          success: false,
          error: 'Hugging Face model is loading. Please wait and try again.'
        };
      }
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Invalid Hugging Face API key. Verify your token in .env file.'
        };
      }
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Cannot connect to Hugging Face. Check internet connection.'
        };
      }
      return {
        success: false,
        error: `Hugging Face Error: ${error.message}`
      };
    }
  }
  async callTogether(prompt) {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'TOGETHER_API_KEY not set in .env'
        };
      }
      const response = await axios.post(
        'https://api.together.xyz/inference',
        {
          model: this.model || 'mistralai/Mistral-7B-Instruct-v0.1',
          prompt: prompt,
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.9,
          top_k: 50,
          repeats_penalty: 1.2,
          safety_model: ''
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );
      const text = response.data.output?.choices[0]?.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return {
          success: false,
          error: 'Could not parse questions from Together.ai response'
        };
      }
      return {
        success: true,
        text: jsonMatch[0],
        tokenUsage: response.data.output?.usage || null
      };
    } catch (error) {
      throw error;
    }
  }
  parseQuestions(jsonString) {
    try {
      let questions = JSON.parse(jsonString);
      // Ensure it's an array
      if (!Array.isArray(questions)) {
        questions = [questions];
      }
      // Validate and clean questions
      const parsed = questions.map((q, index) => ({
        ind: q.ind || (index + 1),
        question: q.question || '',
        type: (q.type || 'mcq').toLowerCase(),
        op1: q.op1 || q.options?.[0] || '',
        op2: q.op2 || q.options?.[1] || '',
        op3: q.op3 || q.options?.[2] || '',
        op4: q.op4 || q.options?.[3] || '',
        answer: q.answer || '',
        explanation: q.explanation || '',
        generatedByAI: true
      })).filter(q => q.question && q.answer);
      if (parsed.length === 0) {
        throw new Error('No valid questions extracted after parsing');
      }
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }
}
module.exports = AITestGenerator;
