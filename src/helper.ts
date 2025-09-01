export function addToConfig(
    target: Record<string, string | number | boolean>,
    key: string,
    value: string | number | boolean,
) {
    if (!(key in target)) {
        target[key] = value;
    }
}
