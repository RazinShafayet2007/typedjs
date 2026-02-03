// Hand-written baseline to represent AOT codegen output.
export function checkSmall(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new TypeError('data expected object');
  if (typeof data.name !== 'string') throw new TypeError('name expected string');
  if (typeof data.age !== 'number') throw new TypeError('age expected number');
  if (typeof data.active !== 'boolean') throw new TypeError('active expected boolean');
  return data;
}

export function checkMedium(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new TypeError('data expected object');
  if (typeof data.id !== 'number') throw new TypeError('id expected number');
  if (typeof data.name !== 'string') throw new TypeError('name expected string');
  if (!Array.isArray(data.tags)) throw new TypeError('tags expected array');
  for (let i = 0; i < data.tags.length; i++) {
    if (typeof data.tags[i] !== 'string') throw new TypeError('tags[i] expected string');
  }
  const addr = data.address;
  if (typeof addr !== 'object' || addr === null || Array.isArray(addr)) throw new TypeError('address expected object');
  if (typeof addr.street !== 'string') throw new TypeError('address.street expected string');
  if (typeof addr.zip !== 'string') throw new TypeError('address.zip expected string');
  return data;
}
