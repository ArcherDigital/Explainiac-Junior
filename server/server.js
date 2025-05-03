const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const OpenAI = require('openai');
const rateLimit = require('express-rate-limit');

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please try again soon." }
});
app.use('/api/', limiter);

// Prompt style interpreter
function getSystemPrompt(style) {
  switch (style) {
    case 'age5':
      return "You are an explainer bot. Explain the user's input in very simple language, as if you're talking to a 5-year-old. Use short sentences, everyday examples, and analogies.";
    case 'age12':
      return "Explain the user's input in clear but slightly more advanced language, as if you're talking to a 12-year-old. Use concrete examples.";
    case 'story':
      return "Explain the user's input as a short, engaging story with characters and a simple plot.";
    case 'analogy':
      return "Explain the user's input using a single, clear analogy that relates it to everyday life.";
    default:
      return "Explain the user's input simply.";
  }
}

// Main explain route
app.post('/api/explain', async (req, res) => {
  const { prompt, style } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required and must be a string.' });
  }

  const systemPrompt = getSystemPrompt(style);
  console.log(`[${new Date().toISOString()}] Prompt received: "${prompt}" with style "${style}"`);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    const response = completion.choices?.[0]?.message?.content;

    if (!response) {
      console.error('OpenAI returned no message content.');
      return res.status(502).json({ error: 'OpenAI did not return a valid response.' });
    }

    res.json({ response });
  } catch (e) {
    const errorMsg = e.response?.data?.error?.message || e.message || 'Unknown error';
    console.error('OpenAI API Error:', errorMsg);
    res.status(500).json({ error: 'An error occurred while generating the explanation.' });
  }
});

// System prompt debug route
app.get('/api/system-prompt/:style', (req, res) => {
  const style = req.params.style;
  const systemPrompt = getSystemPrompt(style);
  res.json({ systemPrompt });
});

// Healthcheck
app.get('/api/health', (req, res) => res.send('OK'));

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
