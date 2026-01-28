import express from 'express'
import morgan from 'morgan'
import cors from 'cors'
import 'dotenv/config'
import routes from './routes/index.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'
import authRoutes from './routes/authRoutes.js';
import path from 'path'; // Add this import
import { fileURLToPath } from 'url'; // Add this import
import device from './routes/deviceRoutes.js';
import master from './routes/masterRoutes.js';
const app = express()

/* ----------------------------- Global Middleware ---------------------------- */

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Request logging (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}
app.use(cors({
  origin: "http://127.0.0.1:5500", 
}));

app.get('/api/data', (req, res) => {
  res.json({ message: "Success! You bypassed CORS." });
});
// Parse JSON & URL-encoded bodies
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// Serve static files from 'public' or 'shell' directory if needed
app.use(express.static(path.join(__dirname, 'public')));
app.use('/shell', express.static(path.join(__dirname, 'shell')));

/* --------------------------------- Routes ---------------------------------- */

// Redirect root to shell.html
app.get('/', (req, res) => {
  res.redirect('/shell/shell.html');
});

// Serve shell.html directly
app.get('/shell', (req, res) => {
  res.sendFile(path.join(__dirname, 'shell', 'shell.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use('/api', routes)
app.use('/api/auth', authRoutes);
app.use('/api/devices', device);
app.use('/api/master', master);
/* ------------------------------ Error Handling ------------------------------ */

// 404 handler
app.use(notFound)

// Central error handler
app.use(errorHandler)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`)
  console.log(`Test server at http://localhost:${PORT}/health`)
  console.log(`Web interface at http://localhost:${PORT}/`)
})


export default app