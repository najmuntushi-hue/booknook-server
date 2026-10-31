# BookNook Server

Express.js and MongoDB REST API for BookNook, a small online library.

## API Routes

- GET /books - get all books (supports ?limit=)
- GET /books/:id - get one book
- POST /books - add a book (JWT)
- PATCH /books/:id - update own book (JWT)
- DELETE /books/:id - delete own book (JWT)
- POST /borrows - borrow a book (JWT)
- GET /borrows - get my borrows (JWT)
- DELETE /borrows/:id - return a book (JWT)

## Environment Variables

- MONGODB_URI
- JWKS_URL
- PORT
