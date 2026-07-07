export {}; // Ensure this file is treated as a module

declare global {
    interface Response {
        // We add a generic overload. By defaulting to `any`,
        // it perfectly matches the original native behavior if no type is passed.
        json<T = any>(): Promise<T>;
    }
}
