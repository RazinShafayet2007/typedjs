function createUser(id, name, email) {
    return { id, name, email };
}
function calculateTotal(prices) {
    let total = 0;
    for (let i = 0; i < prices.length; i++) {
        total = total + prices[i];
    }
    return total;
}
// Run benchmark
let users = [];
for (let i = 0; i < 1000; i++) {
    let user = createUser(i, "User" + i, "user" + i + "@test.com");
    users.push(user);
}
let prices = [10, 20, 30, 40, 50];
let total = calculateTotal(prices);
console.log("Created", users.length, "users");
console.log("Total price:", total);
export {};
