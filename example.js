let staticBad: number | bigint = "wrong"; // Static error (string literal)

function badReturn(): bigint {
  return 42n; // good
}

function worseReturn(): symbol {
  return "not symbol"; // Static error
}