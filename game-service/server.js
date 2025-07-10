const express = require('express');
const app = express();
app.use(express.json());

// Mock database
let games = [
  { id: 1, name: "Assassin's Creed", category: "Adventure", releaseDate: "2023-10-05", price: 59.99 },
  { id: 2, name: "FIFA 24", category: "Sports", releaseDate: "2023-09-29", price: 49.99 }
];

// Get all games
app.get('/api/games', (req, res) => {
  res.json(games);
});

// Add new game
app.post('/api/games', (req, res) => {
  const game = req.body;
  games.push(game);
  res.status(201).send();
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Game service running on port ${PORT}`);
});