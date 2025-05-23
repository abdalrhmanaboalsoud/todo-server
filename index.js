const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Client } = require("pg");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const app = express();
const port = process.env.PORT;
const url = process.env.DATABASE_URL;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const client = new Client({
  connectionString: url,
  ssl: {
    rejectUnauthorized: false,
  },
});

function readTodosFile() {
  const rawData = fs.readFileSync("./todos.json");
  return JSON.parse(rawData);
}

// Routes
app.post("/addtodo", addTodoHandler);
app.get("/todos", getTodosHandler);
app.delete("/dtodo/:id", deleteTodoHandler);
app.patch("/utodo/:id", updateTodoHandler);
app.get("/todo/api", apiHandler);
app.get("/local-todos", localApiHandler);
app.get("/spesific-todo/:id", specificTodoHandler);
app.get("/addtodo", completedHandler);

// Add this with your other routes
app.get("/", (req, res) => {
  res.status(200).json({ message: "Todo API Server Running" });
});

// functions handlers
function addTodoHandler(req, res) {
  const { title, description } = req.body;
  const sql =
    "INSERT INTO todo (title, description) VALUES ($1, $2) RETURNING *";
  const values = [title, description];

  client
    .query(sql, values)
    .then((result) => {
      console.log("Todo added:", result.rows[0]);
      res.status(201).json(result.rows[0]);
    })
    .catch((err) => {
      console.error("Error adding todo:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

function getTodosHandler(req, res) {
  const keyword = req.query.keyword;
  let sql = "SELECT * FROM todo";
  const values = [];
  if (keyword) {
    sql += " WHERE title ILIKE $1";
    values.push(`%${keyword}%`);
  }
  client
    .query(sql, values)
    .then((result) => {
      console.log("Todos retrieved:", result.rows);
      res.status(200).json(result.rows);
    })
    .catch((err) => {
      console.error("Error retrieving todos:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

function deleteTodoHandler(req, res) {
  const todoId = req.params.id;
  const sql = "DELETE FROM todo WHERE id = $1";
  const vlaues = [todoId];
  client
    .query(sql, vlaues)
    .then((result) => {
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Todo not found" });
      }
      console.log("Todo deleted:", todoId);
      res.status(200).json({ message: "Todo deleted successfully" });
    })
    .catch((err) => {
      console.error("Error deleting todo:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

function updateTodoHandler(req, res) {
  const todoId = req.params.id;
  const { title, description, completed } = req.body;

  const sql = `
  UPDATE todo 
  SET title = COALESCE($1, title),
  description = COALESCE($2, description),
  completed = COALESCE($3, completed)
  WHERE id = $4 
  RETURNING *`;

  const values = [title, description, completed, todoId];

  client
    .query(sql, values)
    .then((result) => {
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Todo not found" });
      }
      res.status(200).json(result.rows[0]);
    })
    .catch((err) => {
      console.error("Error updating todo:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

function apiHandler(req, res) {
  const keyword = req.query.keyword;
  const url = `https://jsonplaceholder.typicode.com/todos?keyword= ${encodeURIComponent(keyword)}`;
  if (!keyword) {
    axios
      .get(url)
      .then((response) => {
        const todos = response.data;
        // console.log("Todos fetched from API:", todos);
        res.status(200).json(todos);
      })
      .catch((error) => {
        console.error("Error fetching todos from API:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  }else{
    axios
      .get(url)
      .then((response) => {
        const todos = response.data;
        const filteredTodos = todos.filter((todo) =>
          todo.title.toLowerCase().includes(keyword.toLowerCase().trim())
        );
        // console.log("Filtered Todos:", filteredTodos);
        res.status(200).json(filteredTodos);
      })
      .catch((error) => {
        console.error("Error fetching todos from API:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  }
}

function localApiHandler(req, res) {
  try {
    const data = readTodosFile();
    res.status(200).json(data.todos);
  } catch (error) {
    console.error("Error reading todos:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

function specificTodoHandler(req, res) {
  const todoId = req.params.id;
  const sql = "SELECT * FROM todo WHERE id = $1";
  const values = [todoId];
  client
    .query(sql, values)
    .then((result) => {
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Todo not found" });
      }
      res.status(200).json(result.rows[0]);
    })
    .catch((err) => {
      console.error("Error retrieving todo:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

function completedHandler(req, res) {
  const keyword = req.query.keyword;
  const sql = "SELECT * FROM todo WHERE completed = $1";
  const values = [keyword];
  client
    .query(sql, values)
    .then((result) => {
      console.log("Completed todos retrieved:", result.rows);
      res.status(200).json(result.rows);
    })
    .catch((err) => {
      console.error("Error retrieving completed todos:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

client
  .connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch((err) => console.error("Connection error", err.stack));

console.log("DB URL:", process.env.DATABASE_URL, "PORT:", process.env.PORT);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
