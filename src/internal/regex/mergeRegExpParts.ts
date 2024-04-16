export default function mergeRegExpParts(parts: string[]) {
    return parts.length === 1 ? parts[0] : `(?:${parts.join('|')})`;
}
