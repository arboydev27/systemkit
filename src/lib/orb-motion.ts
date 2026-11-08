// The curves the course's links and chapter threads follow through the space the dive goes into.

export function foldPoint(a: number[], first: number[], second: number[], b: number[], t: number): [number, number, number] {
  const u = 1 - t;
  const [w0, w1, w2, w3] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [
    w0 * a[0] + w1 * first[0] + w2 * second[0] + w3 * b[0],
    w0 * a[1] + w1 * first[1] + w2 * second[1] + w3 * b[1],
    w0 * a[2] + w1 * first[2] + w2 * second[2] + w3 * b[2],
  ];
}

export function arcPoint(a: number[], control: number[], b: number[], t: number): [number, number, number] {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * control[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * control[1] + t * t * b[1],
    u * u * a[2] + 2 * u * t * control[2] + t * t * b[2],
  ];
}

