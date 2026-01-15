type Direction = "up" | "down" | "left" | "right";

type Status = "idle" | "loading" | true;

let dir: Direction = "up"; // good

let badDir: Direction = "diagonal"; // warn

let status: Status = true; // good

let badStatus: Status = 42; // warn

function move(d: Direction): Direction {
  return d;
}

console.log(move("left")); // good
console.log(move("down")); // good
console.log(move("oops")); // warn on param + return