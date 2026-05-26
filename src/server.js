import express from 'express';

const app = express();

app.use(express.json());
app.use(express.static('.'));

app.post('/api/claude', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({
      error: { message: err.message },
    });
  }
});

app.listen(3000, () => {
  console.log('Dashboard running at http://localhost:3000');
});