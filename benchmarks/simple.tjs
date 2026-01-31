// Simple benchmark - basic types and functions
interface User {
  id: number;
  name: string;
  email: string;
}

function createUser(id: number, name: string, email: string): User {
  return { id, name, email };
}

function calculateTotal(prices: Array<number>): number {
  let total: number = 0;
  for (let i: number = 0; i < prices.length; i++) {
    total = total + prices[i];
  }
  return total;
}

// Run benchmark
let users: Array<User> = [];
for (let i: number = 0; i < 1000; i++) {
  let user: User = createUser(i, "User" + i, "user" + i + "@test.com");
  users.push(user);
}

let prices: Array<number> = [10, 20, 30, 40, 50];
let total: number = calculateTotal(prices);

console.log("Created", users.length, "users");
console.log("Total price:", total);
