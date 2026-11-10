import { openDatabase, resetDatabase } from "./db.js";

const db = openDatabase();
resetDatabase(db);
db.close();
console.log("Demo data restored.");
