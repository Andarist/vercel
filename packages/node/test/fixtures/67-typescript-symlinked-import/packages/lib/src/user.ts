export class User {
  private readonly brand = true;

  constructor(public readonly name: string) {}
}

export function createUser(name: string) {
  return new User(name);
}
