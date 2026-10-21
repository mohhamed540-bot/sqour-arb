# sqour-arb

A production-ready-ready Node.js chat server with Express, Socket.IO, room support, authentication, and local JSON persistence.

## Features
- Express server with static file hosting
- Socket.IO real-time messaging
- Authenticated users and route protection
- Room-based chat and history
- Rate limiting and security headers
- Health check endpoint
- Local JSON database for users, rooms, and messages

## Run
```bash
npm install
npm start
```

Then open:
- http://localhost:3000/
- http://localhost:3000/chat
- http://localhost:3000/admin

## API examples
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"123456","displayName":"Demo User"}'
```

## Notes
- The project is structured for extension and can be upgraded to MongoDB/PostgreSQL later.
- Sensitive settings should be placed in `.env` instead of hardcoded values.
