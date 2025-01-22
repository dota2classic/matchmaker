export function createDateComparator<T>(getDate: (e: T) => Date, desc: boolean = false) {
  return (a: T, b: T) => (getDate(a).getTime() - getDate(b).getTime()) * (desc ? -1 : 1);
}
