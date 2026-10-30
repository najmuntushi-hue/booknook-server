
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const verifyToken = require("./middleware/verifyToken");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let booksCollection;
let borrowsCollection;

async function connectDB() {
  await client.connect();
  const db = client.db("booknook");
  booksCollection = db.collection("books");
  borrowsCollection = db.collection("borrows");
  console.log("MongoDB connected");
}

app.get("/", (req, res) => {
  res.send("BookNook server is running");
});

// GET /books (public)
app.get("/books", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 0;
    const books = await booksCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    res.send(books);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch books" });
  }
});

// GET /books/:id
app.get("/books/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid book id" });
    }
    const book = await booksCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!book) return res.status(404).send({ message: "Book not found" });
    res.send(book);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch book" });
  }
});

// POST /books
app.post("/books", verifyToken, async (req, res) => {
  try {
    const { title, author, category, image, description, totalCopies } = req.body;
    if (!title || !author || !category || !image || !description) {
      return res.status(400).send({ message: "All fields are required" });
    }
    const copies = Number(totalCopies) || 1;
    const book = {
      title,
      author,
      category,
      image,
      description,
      totalCopies: copies,
      copies,
      userName: req.user.name,
      userEmail: req.user.email,
      createdAt: new Date(),
    };
    const result = await booksCollection.insertOne(book);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to add book" });
  }
});

// PATCH /books/:id
app.patch("/books/:id", verifyToken, async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const book = await booksCollection.findOne({ _id });
    if (!book) return res.status(404).send({ message: "Book not found" });
    if (book.userEmail !== req.user.email) {
      return res.status(403).send({ message: "Forbidden" });
    }
    const { title, author, category, image, description } = req.body;
    const result = await booksCollection.updateOne(
      { _id },
      { $set: { title, author, category, image, description } }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to update book" });
  }
});

// DELETE /books/:id
app.delete("/books/:id", verifyToken, async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const book = await booksCollection.findOne({ _id });
    if (!book) return res.status(404).send({ message: "Book not found" });
    if (book.userEmail !== req.user.email) {
      return res.status(403).send({ message: "Forbidden" });
    }
    const result = await booksCollection.deleteOne({ _id });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to delete book" });
  }
});

// POST /borrows
app.post("/borrows", verifyToken, async (req, res) => {
  try {
    const { bookId } = req.body;
    if (!ObjectId.isValid(bookId)) {
      return res.status(400).send({ message: "Invalid book id" });
    }
    const userEmail = req.user.email;

    const already = await borrowsCollection.findOne({ bookId, userEmail });
    if (already) {
      return res.status(400).send({ message: "You have already borrowed this book" });
    }

    const updated = await booksCollection.findOneAndUpdate(
      { _id: new ObjectId(bookId), copies: { $gt: 0 } },
      { $inc: { copies: -1 } },
      { returnDocument: "after" }
    );
    if (!updated) {
      return res.status(400).send({ message: "Book is not available" });
    }

    const borrowDate = new Date();
    const returnDate = new Date(borrowDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const result = await borrowsCollection.insertOne({
      bookId,
      bookTitle: updated.title,
      bookImage: updated.image,
      userEmail,
      userName: req.user.name,
      borrowDate,
      returnDate,
    });
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to borrow book" });
  }
});

// GET /borrows
app.get("/borrows", verifyToken, async (req, res) => {
  try {
    const borrows = await borrowsCollection
      .find({ userEmail: req.user.email })
      .sort({ borrowDate: -1 })
      .toArray();
    res.send(borrows);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch borrows" });
  }
});

// DELETE /borrows/:id
app.delete("/borrows/:id", verifyToken, async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const borrow = await borrowsCollection.findOne({ _id, userEmail: req.user.email });
    if (!borrow) return res.status(404).send({ message: "Borrow not found" });

    await borrowsCollection.deleteOne({ _id });
    await booksCollection.updateOne(
      { _id: new ObjectId(borrow.bookId) },
      { $inc: { copies: 1 } }
    );
    res.send({ message: "Book returned" });
  } catch (error) {
    res.status(500).send({ message: "Failed to return book" });
  }
});

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });

module.exports = app;