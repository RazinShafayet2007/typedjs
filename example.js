interface User {
  name: string;
  age: number;
}

// Case 1: Wrong type inside object
let person1: User = {
  name: "Razin",
  age: "twenty" // Should error: Expected 'number' but got 'string'
};

// Case 2: Missing property
let person2: User = {
  name: "Shafayet"
  // Should error: Property 'age' is missing in type 'User'
};