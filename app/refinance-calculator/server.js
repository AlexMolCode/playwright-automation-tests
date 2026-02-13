const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4200;

const server = http.createServer((req, res) => {
  // Serve static files for GET requests
  if (req.method === 'GET') {
    const fileMap = {
      '/': { file: 'index.html', type: 'text/html' },
      '/styles.css': { file: 'styles.css', type: 'text/css' },
      '/app.js': { file: 'app.js', type: 'application/javascript' },
    };
    const entry = fileMap[req.url] || fileMap['/'];
    const filePath = path.join(__dirname, entry.file);
    const content = fs.readFileSync(filePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': entry.type });
    res.end(content);
    return;
  }

  // For POST /api/rates — this would normally be a real backend.
  // In tests, this route gets intercepted by page.route() so it never hits here.
  // But if it does (running the app manually), return a sample response.
  if (req.method === 'POST' && req.url === '/api/rates') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        offers: [
          { lender: 'Sample Credit Union', newRate: 4.2, termMonths: 48, monthlySavings: 47 },
          { lender: 'Sample Bank', newRate: 3.9, termMonths: 60, monthlySavings: 62 },
        ]
      }));
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Refinance Calculator running at http://localhost:${PORT}`);
});
