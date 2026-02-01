function createCustomer(id, name, email) {
    return {
        id: id,
        name: name,
        email: email,
        status: "active",
        address: {
            street: "123 Main St",
            city: "Springfield",
            zipCode: "12345"
        },
        orders: []
    };
}
function createOrder(orderId, customerId) {
    return {
        orderId: orderId,
        amount: 0,
        date: "2024-01-01",
        items: []
    };
}
function addOrderItem(order, item) {
    order.items.push(item);
    order.amount = order.amount + (item.price * item.quantity);
    return order;
}
function calculateCustomerTotal(customer) {
    let total = 0;
    for (let i = 0; i < customer.orders.length; i++) {
        total = total + customer.orders[i].amount;
    }
    return total;
}
// Run complex benchmark
let customers = [];
for (let i = 0; i < 500; i++) {
    let customer = createCustomer(i, "Customer " + i, "customer" + i + "@example.com");
    for (let j = 0; j < 3; j++) {
        let order = createOrder(i * 100 + j, i);
        for (let k = 0; k < 5; k++) {
            let item = {
                productId: k,
                name: "Product " + k,
                quantity: k + 1,
                price: 10 + k
            };
            order = addOrderItem(order, item);
        }
        customer.orders.push(order);
    }
    customers.push(customer);
}
let grandTotal = 0;
for (let i = 0; i < customers.length; i++) {
    grandTotal = grandTotal + calculateCustomerTotal(customers[i]);
}
console.log("Processed", customers.length, "customers");
console.log("Grand total:", grandTotal);
export {};
