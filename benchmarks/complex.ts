// Complex benchmark - nested types, generics, unions
type Status = "active" | "inactive" | "pending";
type ID = string | number;

interface Address {
  street: string;
  city: string;
  zipCode: string;
}

interface Customer {
  id: ID;
  name: string;
  email: string;
  status: Status;
  address: Address;
  orders: Array<Order>;
}

interface Order {
  orderId: ID;
  amount: number;
  date: string;
  items: Array<OrderItem>;
}

interface OrderItem {
  productId: ID;
  name: string;
  quantity: number;
  price: number;
}

function createCustomer(id: ID, name: string, email: string): Customer {
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

function createOrder(orderId: ID, customerId: ID): Order {
  return {
    orderId: orderId,
    amount: 0,
    date: "2024-01-01",
    items: []
  };
}

function addOrderItem(order: Order, item: OrderItem): Order {
  order.items.push(item);
  order.amount = order.amount + (item.price * item.quantity);
  return order;
}

function calculateCustomerTotal(customer: Customer): number {
  let total: number = 0;
  for (let i: number = 0; i < customer.orders.length; i++) {
    total = total + customer.orders[i].amount;
  }
  return total;
}

// Run complex benchmark
let customers: Array<Customer> = [];

for (let i: number = 0; i < 500; i++) {
  let customer: Customer = createCustomer(
    i,
    "Customer " + i,
    "customer" + i + "@example.com"
  );
  
  for (let j: number = 0; j < 3; j++) {
    let order: Order = createOrder(i * 100 + j, i);
    
    for (let k: number = 0; k < 5; k++) {
      let item: OrderItem = {
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

let grandTotal: number = 0;
for (let i: number = 0; i < customers.length; i++) {
  grandTotal = grandTotal + calculateCustomerTotal(customers[i]);
}

console.log("Processed", customers.length, "customers");
console.log("Grand total:", grandTotal);

export {};
